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
 * Phase 1.2 — Voter eligibility check.
 *
 * Priority 1 (geo): If both voter and issue have coordinates, voter must be within
 *   MAX_VOTER_DISTANCE_METRES of the issue.
 * Priority 2 (ward fallback): If coordinates are absent, voter's ward must match
 *   the issue's ward exactly (same-ward-only).
 *
 * Note: ward adjacency is a documented v2 upgrade — no adjacency dataset exists yet.
 *
 * If neither check can be performed (no coords, no ward data on either side), the
 * vote is allowed with a warning logged (open civic participation default).
 */
const checkVoterEligibility = async (voterId: string, issueId: string): Promise<void> => {
  const voter = await User.findById(voterId).select('lat lng ward city');
  const issue = await Issue.findById(issueId).select('location');
  if (!voter || !issue) throw new ApiError(404, 'Voter or issue not found during eligibility check');

  const issueLat = issue.location.lat;
  const issueLng = issue.location.lng;
  const issueWard = issue.location.ward;

  // Priority 1: geo-radius check when both sides have coordinates
  if (voter.lat != null && voter.lng != null && issueLat != null && issueLng != null) {
    const distanceM = haversineMetres(voter.lat, voter.lng, issueLat, issueLng);
    if (distanceM > MAX_VOTER_DISTANCE_METRES) {
      throw new ApiError(
        403,
        `You must be within ${MAX_VOTER_DISTANCE_METRES / 1000} km of the issue to vote on it (distance: ${(distanceM / 1000).toFixed(1)} km)`
      );
    }
    return; // Geo check passed
  }

  // Priority 2: ward-string fallback (same-ward-only, no adjacency — v2 future item)
  if (voter.ward && issueWard) {
    if (voter.ward.trim().toLowerCase() !== issueWard.trim().toLowerCase()) {
      throw new ApiError(
        403,
        `You must be in the same ward as the reported issue to vote. ` +
        `Your ward: "${voter.ward}", issue ward: "${issueWard}".`
      );
    }
    return; // Ward check passed
  }

  // No eligibility data available — allow with warning (open civic participation)
  logger.warn('CommunityService', 'Voter eligibility check skipped: neither voter nor issue have ward/location data', {
    voterId,
    issueId,
  });
};

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

  // Phase 1.2: Enforce voter eligibility before accepting the vote
  await checkVoterEligibility(userId, issueId);

  try {
    const vote = await CommunityVote.create({
      issueId,
      userId,
      voteType,
      comment,
    });

    await CitizenScore.findOneAndUpdate(
      { userId },
      { $inc: { verificationsDone: 1, trustScore: 1 } }
    );

    await evaluateIssueVerification(issueId);

    const { runPriorityEngineAndRoute } = await import('../issues/priorityEngine.service');
    const updatedIssue = await runPriorityEngineAndRoute(issueId);

    try {
      const { emitToRoom, emitToGlobal } = await import('../../config/socket');
      const wardName = issue.location.ward || 'Default';
      const cityName = issue.location.city || 'Default';
      const payload = { vote, issue: updatedIssue || issue };
      emitToRoom(`ward:${wardName}`, 'COMMUNITY_VOTE_ADDED', payload);
      emitToRoom(`city:${cityName}`, 'COMMUNITY_VOTE_ADDED', payload);
      emitToRoom('admin', 'COMMUNITY_VOTE_ADDED', payload);
      emitToGlobal('COMMUNITY_VOTE_ADDED', payload);
    } catch (err: any) {
      logger.error('CommunityService', 'Failed to broadcast community vote event', { error: err?.message });
    }

    return vote;
  } catch (error: any) {
    if (error.code === 11000) {
      throw new ApiError(400, 'You have already voted on this issue');
    }
    throw error;
  }
};

const evaluateIssueVerification = async (issueId: string) => {
  const votes = await CommunityVote.find({ issueId });
  const issue = await Issue.findById(issueId);
  if (!issue) return;

  const existsVotes = votes.filter(v => v.voteType === VOTE_TYPES.EXISTS).length;
  const notFoundVotes = votes.filter(v => v.voteType === VOTE_TYPES.NOT_FOUND).length;

  const REQUIRED_VERIFICATIONS = 3;
  const REJECTION_THRESHOLD = 3;

  if (existsVotes >= REQUIRED_VERIFICATIONS && issue.status === ISSUE_STATUS.OPEN_FOR_COMMUNITY_VERIFICATION) {
    const previousStatus = issue.status;
    transitionStatus(issue, ISSUE_STATUS.COMMUNITY_VERIFIED);
    issue.verifiedAt = new Date(); // Phase 3.2: publicly exposed
    await issue.save();

    await createTimelineEvent(
      issue._id,
      'COMMUNITY_VERIFIED',
      'Community Verified',
      'Issue has been verified by the community and is ready for authority assignment.'
    );
    await createAuditLog(null, 'system', 'COMMUNITY_VERIFIED', 'Issue', issue._id, previousStatus, ISSUE_STATUS.COMMUNITY_VERIFIED);
    assignIssueToAuthority(issue._id.toString()).catch(console.error);

    // Phase 3.5: Fan-out email to reporter + watchers
    try {
      const reporter = await User.findById(issue.reportedBy).select('email').lean();
      if (reporter?.email) {
        fanOutTransitionEmails(issue._id.toString(), issue.title, reporter.email, 'COMMUNITY_VERIFIED').catch(() => {});
      }
    } catch (err) { /* non-fatal */ }

  } else if (notFoundVotes >= REJECTION_THRESHOLD && issue.status === ISSUE_STATUS.OPEN_FOR_COMMUNITY_VERIFICATION) {
    const previousStatus = issue.status;
    transitionStatus(issue, ISSUE_STATUS.NEEDS_MANUAL_REVIEW);
    await issue.save();

    await ManualReview.create({
      issueId: issue._id,
      reason: `Community dispute: received ${notFoundVotes} "NOT_FOUND" votes`,
      reviewStatus: 'PENDING',
    });
    await createTimelineEvent(issue._id, 'NEEDS_MANUAL_REVIEW', 'Flagged for Manual Review', 'Community disputed the existence of this issue.');
    await createAuditLog(null, 'system', 'COMMUNITY_DISPUTED', 'Issue', issue._id, previousStatus, ISSUE_STATUS.NEEDS_MANUAL_REVIEW, { notFoundVotes });
  }
};
