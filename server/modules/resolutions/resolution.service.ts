import { Resolution } from './resolution.model';
import { ResolutionFeedback } from './resolutionFeedback.model';
import { Issue } from '../issues/issue.model';
import { ManualReview } from '../admin/manualReview.model';
import { ApiError } from '../../utils/ApiError';
import { ISSUE_STATUS, RESOLUTION_STATUS, FEEDBACK_TYPES } from '../../config/constants';
import { createAuditLog } from '../audit/audit.service';
import { notifyCitizenConfirmationRequired } from '../notifications/notification.service';
import { fanOutTransitionEmails } from '../notifications/email.service';
import { rewardResolutionConfirmation } from '../reputation/reputation.service';
import { transitionStatus } from '../../utils/issueStateMachine';
import { createTimelineEvent } from '../issues/timeline.service';
import { User } from '../users/user.model';


export const submitResolution = async (issueId: string, officerId: string, resolutionData: any) => {
  const issue = await Issue.findById(issueId);
  if (!issue) throw new ApiError(404, 'Issue not found');

  // transitionStatus will validate if it's allowed
  const previousStatus = issue.status;
  transitionStatus(issue, ISSUE_STATUS.RESOLUTION_SUBMITTED);

  // Ensure this officer is assigned to the issue
  if (issue.assignment?.officerId?.toString() !== officerId.toString()) {
    throw new ApiError(403, 'You are not assigned to this issue');
  }

  const { workSummary, internalNotes, beforeMedia, afterMedia, proofDocuments, estimatedCost, contractorDetails } = resolutionData;

  // Upsert resolution record
  let resolution = await Resolution.findOne({ issueId });
  
  if (resolution) {
    resolution.workSummary = workSummary || resolution.workSummary;
    resolution.internalNotes = internalNotes || resolution.internalNotes;
    resolution.beforeMedia = beforeMedia || resolution.beforeMedia;
    resolution.afterMedia = afterMedia || resolution.afterMedia;
    resolution.proofDocuments = proofDocuments || resolution.proofDocuments;
    resolution.estimatedCost = estimatedCost || resolution.estimatedCost;
    resolution.contractorDetails = contractorDetails || resolution.contractorDetails;
    resolution.resolutionStatus = RESOLUTION_STATUS.SUBMITTED;
    resolution.submittedAt = new Date();
    await resolution.save();
  } else {
    resolution = await Resolution.create({
      issueId,
      officerId,
      departmentId: issue.assignment?.departmentId,
      wardId: issue.assignment?.wardId,
      resolutionStatus: RESOLUTION_STATUS.SUBMITTED,
      workSummary,
      internalNotes,
      beforeMedia,
      afterMedia,
      proofDocuments,
      estimatedCost,
      contractorDetails,
      submittedAt: new Date()
    });
  }

  await issue.save();

  await createAuditLog(officerId, 'ward_officer', 'RESOLUTION_SUBMITTED', 'Issue', issue._id, previousStatus, ISSUE_STATUS.RESOLUTION_SUBMITTED);
  await createTimelineEvent(
    issue._id,
    'RESOLUTION_SUBMITTED',
    'Resolution Submitted',
    workSummary,
    officerId,
    'ward_officer'
  );

  // Auto transition to PENDING_CITIZEN_CONFIRMATION
  transitionStatus(issue, ISSUE_STATUS.PENDING_CITIZEN_CONFIRMATION);
  await issue.save();
  
  await notifyCitizenConfirmationRequired(issue.reportedBy.toString(), issue._id.toString());

  // Broadcast resolution submission event
  try {
    const { emitToRoom, emitToGlobal } = await import('../../config/socket');
    const wardName = issue.location.ward || 'Default';
    emitToRoom(`ward:${wardName}`, 'ISSUE_UPDATED', issue);
    emitToGlobal('ISSUE_UPDATED', issue);
  } catch (err) {
    console.error('Failed to emit on resolution submit:', err);
  }

  return resolution;
};

export const submitCitizenFeedback = async (issueId: string, userId: string, feedbackData: any) => {
  const issue = await Issue.findById(issueId);
  if (!issue) throw new ApiError(404, 'Issue not found');

  if (issue.status !== ISSUE_STATUS.PENDING_CITIZEN_CONFIRMATION) {
    throw new ApiError(400, 'Issue is not waiting for citizen confirmation');
  }

  const resolution = await Resolution.findOne({ issueId });
  if (!resolution) throw new ApiError(404, 'Resolution record not found');

  const { feedbackType, comment, mediaUrls } = feedbackData;

  const feedback = await ResolutionFeedback.create({
    issueId,
    resolutionId: resolution._id,
    userId,
    feedbackType,
    comment,
    mediaUrls
  });

  const previousStatus = issue.status;

  // Decision Logic for Confirmation
  if (feedbackType === FEEDBACK_TYPES.RESOLVED) {
    transitionStatus(issue, ISSUE_STATUS.CLOSED_RESOLVED);
    resolution.resolutionStatus = RESOLUTION_STATUS.ACCEPTED;
    resolution.resolvedAt = new Date();
    
    await rewardResolutionConfirmation(userId);
    
    await createTimelineEvent(
      issue._id,
      'CLOSED_RESOLVED',
      'Issue Resolved',
      'Citizen confirmed the issue is resolved.',
      userId,
      'citizen'
    );

    // Phase 3.5: Fan-out email to reporter + watchers
    try {
      const reporter = await User.findById(issue.reportedBy).select('email').lean();
      if (reporter?.email) {
        fanOutTransitionEmails(issue._id.toString(), issue.title, reporter.email, 'CLOSED_RESOLVED').catch(() => {});
      }
    } catch (err) { /* non-fatal */ }

  } else if (feedbackType === FEEDBACK_TYPES.STILL_UNRESOLVED || feedbackType === FEEDBACK_TYPES.WRONG_ISSUE) {
    resolution.resolutionStatus = RESOLUTION_STATUS.REJECTED;

    // Phase 2.2: Two-strike escalation
    // Increment the rejection counter on the issue
    const newRejectionCount = (issue.auditRejectionCount || 0) + 1;
    issue.auditRejectionCount = newRejectionCount;

    if (newRejectionCount >= 2) {
      // Second consecutive majority-reject — escalate to senior reviewer
      transitionStatus(issue, ISSUE_STATUS.NEEDS_MANUAL_REVIEW);

      await ManualReview.create({
        issueId: issue._id,
        reason: 'Resolution rejected by citizen audit twice — requires senior review',
        reviewStatus: 'PENDING',
        escalationLevel: 1, // Routes to senior/admin reviewer, not original officer
      });

      await createTimelineEvent(
        issue._id,
        'ESCALATED_SENIOR_REVIEW',
        'Escalated to Senior Review',
        `Citizen has rejected the resolution for this issue ${newRejectionCount} times. Routed to senior reviewer.`,
        userId,
        'citizen'
      );
    } else {
      // First rejection — reopen and requeue normally
      transitionStatus(issue, ISSUE_STATUS.REOPENED);

      await createTimelineEvent(
        issue._id,
        'REOPENED',
        'Issue Reopened',
        `Citizen marked the issue as ${feedbackType}. Reason: ${comment || 'No reason provided.'}`,
        userId,
        'citizen'
      );
    }
  } else if (feedbackType === FEEDBACK_TYPES.PARTIALLY_RESOLVED || feedbackType === FEEDBACK_TYPES.NEEDS_FOLLOWUP) {
    transitionStatus(issue, ISSUE_STATUS.REQUIRES_FOLLOWUP);
    resolution.resolutionStatus = RESOLUTION_STATUS.FOLLOWUP_REQUIRED;
    
    await createTimelineEvent(
      issue._id,
      'REQUIRES_FOLLOWUP',
      'Requires Follow-up',
      `Citizen marked the issue as ${feedbackType}. Reason: ${comment || 'No reason provided.'}`,
      userId,
      'citizen'
    );
  }

  await issue.save();
  await resolution.save();

  await createAuditLog(userId, 'citizen', 'RESOLUTION_FEEDBACK_SUBMITTED', 'Issue', issue._id, previousStatus, issue.status, { feedbackType });

  // Broadcast feedback submission event
  try {
    const { emitToRoom, emitToGlobal } = await import('../../config/socket');
    const wardName = issue.location.ward || 'Default';
    emitToRoom(`ward:${wardName}`, 'ISSUE_UPDATED', issue);
    emitToGlobal('ISSUE_UPDATED', issue);
  } catch (err) {
    console.error('Failed to emit on citizen feedback:', err);
  }

  return feedback;
};
