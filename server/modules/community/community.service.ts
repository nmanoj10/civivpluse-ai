import { CommunityVote } from './communityVote.model';
import { Issue } from '../issues/issue.model';
import { User } from '../users/user.model';
import { CitizenScore } from '../users/citizenScore.model';
import { ApiError } from '../../utils/ApiError';
import { ISSUE_STATUS, VOTE_TYPES } from '../../config/constants';
import { assignIssueToAuthority } from '../assignments/assignment.service';
import { transitionStatus } from '../../utils/issueStateMachine';
import { createTimelineEvent } from '../issues/timeline.service';
import { ManualReview } from '../admin/manualReview.model';
import { createAuditLog } from '../audit/audit.service';
import { logger } from '../../utils/logger';
import { fanOutTransitionEmails } from '../notifications/email.service';

/** Maximum geo-distance (metres) a voter may be from the issue location */
const MAX_VOTER_DISTANCE_METRES = 5000;

/**
 * Haversine distance between two lat/lng points in metres.
 */
const haversineMetres = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/**
 * Voter eligibility check (distance/ward)
 */
const checkVoterEligibility = async (voterId: string, issueId: string): Promise<void> => {
  const voter = await User.findById(voterId).select('lat lng ward city');
  const issue = await Issue.findById(issueId).select('location');
  if (!voter || !issue) throw new ApiError(404, 'Voter or issue not found during eligibility check');

  const issueLat = issue.location.lat;
  const issueLng = issue.location.lng;
  const issueWard = issue.location.ward;

  // 1. Geo check
  if (voter.lat != null && voter.lng != null && issueLat != null && issueLng != null) {
    const distanceM = haversineMetres(voter.lat, voter.lng, issueLat, issueLng);
    if (distanceM > MAX_VOTER_DISTANCE_METRES) {
      throw new ApiError(
        403,
        `You must be within ${MAX_VOTER_DISTANCE_METRES / 1000} km of the issue to vote on it (distance: ${(distanceM / 1000).toFixed(1)} km)`
      );
    }
    return;
  }

  // 2. Ward check
  if (voter.ward && issueWard) {
    if (voter.ward.trim().toLowerCase() !== issueWard.trim().toLowerCase()) {
      throw new ApiError(
        403,
        `You must be in the same ward as the reported issue to vote. Your ward: "${voter.ward}", issue ward: "${issueWard}".`
      );
    }
    return;
  }

  logger.warn('CommunityService', 'Voter eligibility check skipped: no ward/location data available', {
    voterId,
    issueId,
  });
};

/**
 * Submit vote (Support / Reject)
 */
export const submitVote = async (issueId: string, userId: string, voteData: any) => {
  const { voteType, comment } = voteData;

  const issue = await Issue.findById(issueId);
  if (!issue) throw new ApiError(404, 'Issue not found');

  if (issue.status !== ISSUE_STATUS.OPEN_FOR_COMMUNITY_VERIFICATION) {
    throw new ApiError(400, 'Issue is not currently open for community verification');
  }

  if (issue.reportedBy.toString() === userId.toString()) {
    throw new ApiError(400, 'You cannot verify your own reported issue');
  }

  // Enforce voter eligibility
  await checkVoterEligibility(userId, issueId);

  // Check duplicate vote
  const existingVote = await CommunityVote.findOne({ issueId, userId });
  if (existingVote) {
    throw new ApiError(400, 'You have already voted on this issue');
  }

  // Create vote
  const vote = await CommunityVote.create({
    issueId,
    userId,
    voteType,
    comment,
  });

  // Update verifiedUsers list and counts on Issue
  const isSupport = voteType === VOTE_TYPES.EXISTS;
  
  await Issue.findByIdAndUpdate(issueId, {
    $push: { verifiedUsers: userId },
    $inc: isSupport ? { supportCount: 1, supporterCount: 1 } : { rejectCount: 1 }
  });

  // Reward citizen points
  await CitizenScore.findOneAndUpdate(
    { userId },
    { $inc: { verificationsDone: 1, trustScore: 1 } }
  );

  // Evaluate verification state
  await evaluateIssueVerification(issueId);

  // Recalculate priority
  const { runPriorityEngineAndRoute } = await import('../issues/priorityEngine.service');
  const updatedIssue = await runPriorityEngineAndRoute(issueId);

  // Emit Real-time Socket.IO
  try {
    const { emitToRoom, emitToGlobal } = await import('../../config/socket');
    const wardName = issue.location.ward || 'Default';
    const cityName = issue.location.city || 'Default';
    const payload = { vote, issue: updatedIssue || issue };
    const eventName = isSupport ? 'NEW_SUPPORT' : 'NEW_REJECTION';
    emitToRoom(`ward:${wardName}`, eventName, payload);
    emitToRoom(`city:${cityName}`, eventName, payload);
    emitToRoom('admin', eventName, payload);
    emitToGlobal(eventName, payload);
    // Maintain legacy event for any backward compatibility
    emitToGlobal('COMMUNITY_VOTE_ADDED', payload);
  } catch (err: any) {
    logger.error('CommunityService', 'Failed to broadcast community vote event', { error: err?.message });
  }

  return vote;
};

/**
 * Undo vote
 */
export const undoVote = async (issueId: string, userId: string) => {
  const issue = await Issue.findById(issueId);
  if (!issue) throw new ApiError(404, 'Issue not found');

  if (issue.status !== ISSUE_STATUS.OPEN_FOR_COMMUNITY_VERIFICATION) {
    throw new ApiError(400, 'Issue verification phase has already concluded');
  }

  const vote = await CommunityVote.findOne({ issueId, userId });
  if (!vote) {
    throw new ApiError(400, 'You have not voted on this issue');
  }

  const isSupport = vote.voteType === VOTE_TYPES.EXISTS;

  // Remove vote record
  await CommunityVote.deleteOne({ _id: vote._id });

  // Update verifiedUsers list and counts on Issue
  await Issue.findByIdAndUpdate(issueId, {
    $pull: { verifiedUsers: userId },
    $inc: isSupport ? { supportCount: -1, supporterCount: -1 } : { rejectCount: -1 }
  });

  // Deduct citizen points
  await CitizenScore.findOneAndUpdate(
    { userId },
    { $inc: { verificationsDone: -1, trustScore: -1 } }
  );

  // Recalculate priority
  const { runPriorityEngineAndRoute } = await import('../issues/priorityEngine.service');
  const updatedIssue = await runPriorityEngineAndRoute(issueId);

  // Emit Real-time Socket.IO
  try {
    const { emitToRoom, emitToGlobal } = await import('../../config/socket');
    const wardName = issue.location.ward || 'Default';
    const cityName = issue.location.city || 'Default';
    const payload = { voteDeleted: true, issueId, userId, issue: updatedIssue || issue };
    emitToRoom(`ward:${wardName}`, 'VOTE_UPDATED', payload);
    emitToRoom(`city:${cityName}`, 'VOTE_UPDATED', payload);
    emitToRoom('admin', 'VOTE_UPDATED', payload);
    emitToGlobal('VOTE_UPDATED', payload);
  } catch (err: any) {
    logger.error('CommunityService', 'Failed to broadcast VOTE_UPDATED event', { error: err?.message });
  }

  return { success: true };
};

/**
 * Evaluates counts to conclude verification
 */
const evaluateIssueVerification = async (issueId: string) => {
  const issue = await Issue.findById(issueId);
  if (!issue) return;

  const supportCount = issue.supportCount || 0;
  const rejectCount = issue.rejectCount || 0;

  const REQUIRED_VERIFICATIONS = 3;
  const REJECTION_THRESHOLD = 3;

  if (supportCount >= REQUIRED_VERIFICATIONS && issue.status === ISSUE_STATUS.OPEN_FOR_COMMUNITY_VERIFICATION) {
    const previousStatus = issue.status;
    transitionStatus(issue, ISSUE_STATUS.COMMUNITY_VERIFIED);
    issue.verifiedAt = new Date();
    await issue.save();

    await createTimelineEvent(
      issue._id,
      'COMMUNITY_VERIFIED',
      'Community Verified',
      'Issue has been verified by the community and is ready for authority assignment.'
    );
    await createAuditLog(null, 'system', 'COMMUNITY_VERIFIED', 'Issue', issue._id, previousStatus, ISSUE_STATUS.COMMUNITY_VERIFIED);
    
    // Assign to Officer
    assignIssueToAuthority(issue._id.toString()).catch(console.error);

    // Send emails
    try {
      const reporter = await User.findById(issue.reportedBy).select('email').lean();
      if (reporter?.email) {
        fanOutTransitionEmails(issue._id.toString(), issue.title, reporter.email, 'COMMUNITY_VERIFIED').catch(() => {});
      }
    } catch (err) { /* non-fatal */ }

  } else if (rejectCount >= REJECTION_THRESHOLD && issue.status === ISSUE_STATUS.OPEN_FOR_COMMUNITY_VERIFICATION) {
    const previousStatus = issue.status;
    transitionStatus(issue, ISSUE_STATUS.NEEDS_MANUAL_REVIEW);
    await issue.save();

    await ManualReview.create({
      issueId: issue._id,
      reason: `Community dispute: received ${rejectCount} "NOT_FOUND" votes`,
      reviewStatus: 'PENDING',
    });
    await createTimelineEvent(issue._id, 'NEEDS_MANUAL_REVIEW', 'Flagged for Manual Review', 'Community disputed the existence of this issue.');
    await createAuditLog(null, 'system', 'COMMUNITY_DISPUTED', 'Issue', issue._id, previousStatus, ISSUE_STATUS.NEEDS_MANUAL_REVIEW, { rejectCount });
  }
};
