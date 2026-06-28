import { Issue } from '../issues/issue.model';
import { IssueMedia } from '../issues/issueMedia.model';
import { ISSUE_STATUS } from '../../config/constants';
import { classifyIssue } from './classifier.service';
import { evaluateIssueTrust } from './verifier.service';
import { findPotentialDuplicate } from './duplicate.service';
import { calculateSeverity } from './severity.service';
import { transitionStatus } from '../../utils/issueStateMachine';
import { createTimelineEvent } from '../issues/timeline.service';
import { createAuditLog } from '../audit/audit.service';
import { ManualReview } from '../admin/manualReview.model';
import { logger } from '../../utils/logger';

/**
 * DECISION ENGINE - Runs after media is uploaded.
 * Evaluates everything and transitions issue status.
 */
export const processIssuePostAnalysis = async (issueId: string) => {
  const issue = await Issue.findById(issueId);
  if (!issue) throw new Error('Issue not found');

  logger.info('AIService', 'AI Analysis Started', { issueId });

  const previousStatus = issue.status;
  transitionStatus(issue, ISSUE_STATUS.AI_ANALYSIS_RUNNING);
  await issue.save();

  await createAuditLog(
    null,
    'system',
    'AI_ANALYSIS_RUNNING',
    'Issue',
    issue._id,
    previousStatus,
    ISSUE_STATUS.AI_ANALYSIS_RUNNING
  );

  try {
    const media = await IssueMedia.find({ issueId: issue._id });

    // Extract ImageKit CDN URLs for AI analysis
    const imageUrls = media
      .filter(m => m.mediaType === 'image' && m.url)
      .map(m => m.url);

    logger.info('AIService', 'Processing with media', {
      issueId,
      mediaCount: media.length,
      imageUrlCount: imageUrls.length,
      imageUrls
    });

    // 1. Classify Category — pass ImageKit URLs for vision analysis
    const classification = await classifyIssue(issue, media, imageUrls);
    issue.predictedCategory = classification.predictedCategory;

    // 2. Validate Trust — ImageKit URLs signal authentic cloud-uploaded media
    const trustEval = await evaluateIssueTrust(issue, media, issue.reportedBy.toString(), imageUrls);
    issue.trustScore = trustEval.finalTrustScore;
    issue.trustBreakdown = {
      authenticityScore: trustEval.authenticityScore,
      geoScore: trustEval.geoScore,
      userTrustWeight: trustEval.userTrustWeight,
      suspicionFlags: trustEval.suspicionFlags
    };

    // 3. Find Duplicates
    const duplicateEval = await findPotentialDuplicate(issue);

    // 4. Calculate Severity
    const severityEval = await calculateSeverity(issue, classification.predictedCategory);
    issue.severity = severityEval.severity;
    issue.priorityScore = severityEval.priorityScore;

    logger.info('AIService', 'AI sub-services completed', {
      issueId,
      predictedCategory: issue.predictedCategory,
      trustScore: issue.trustScore,
      severity: issue.severity
    });

    // DECISION LOGIC
    // Design principle: community verification is the primary anti-fraud gate.
    // AI trust signals are SUPPORTING EVIDENCE only — they must never silently auto-reject
    // or auto-bypass community confirmation.
    //
    // The ONLY true auto-rejects are hard technical failures (no file attached, corrupt upload).
    // Low trust scores route to human moderation — the human decides, not the AI pipeline.

    // Rule 1: Hard technical failure → human moderation (never silent auto-reject)
    if (trustEval.suspicionFlags.includes('NO_MEDIA_ATTACHED')) {
      transitionStatus(issue, ISSUE_STATUS.NEEDS_MANUAL_REVIEW);
      await ManualReview.create({
        issueId: issue._id,
        reason: 'No media attached — cannot verify issue authenticity',
        reviewStatus: 'PENDING'
      });
    }
    // Rule 2: Low or medium trust → human moderation queue
    else if (trustEval.finalTrustScore < 60) {
      transitionStatus(issue, ISSUE_STATUS.NEEDS_MANUAL_REVIEW);
      await ManualReview.create({
        issueId: issue._id,
        reason: `AI trust score below threshold (${trustEval.finalTrustScore}/100). Flags: ${trustEval.suspicionFlags.join(', ') || 'none'}`,
        reviewStatus: 'PENDING'
      });
    }
    // Rule 3: Merged Duplicate
    else if (duplicateEval.isDuplicate && duplicateEval.duplicateIssueId) {
      transitionStatus(issue, ISSUE_STATUS.MERGED_WITH_EXISTING_ISSUE);
      issue.duplicateOf = duplicateEval.duplicateIssueId;

      // Update Master Issue
      await Issue.findByIdAndUpdate(duplicateEval.duplicateIssueId, {
        $inc: { supporterCount: 1 },
        $push: { mergedIssueIds: issue._id }
      });

      await createTimelineEvent(
        issue._id,
        'DUPLICATE_MERGED',
        'Merged as Duplicate',
        `AI detected this is a duplicate of issue #${duplicateEval.duplicateIssueId}.`
      );
    }
    // Rule 4: Valid Unique Issue - Send to community!
    else {
      transitionStatus(issue, ISSUE_STATUS.OPEN_FOR_COMMUNITY_VERIFICATION);
    }

    await issue.save();

    await createTimelineEvent(
      issue._id,
      'AI_ANALYZED',
      'AI Analysis Completed',
      `Category: ${issue.predictedCategory}, Trust: ${issue.trustScore}, Severity: ${issue.severity}`
    );

    await createAuditLog(
      null,
      'system',
      'AI_ANALYSIS_COMPLETE',
      'Issue',
      issue._id,
      ISSUE_STATUS.AI_ANALYSIS_RUNNING,
      issue.status,
      { trustScore: issue.trustScore, severity: issue.severity, predictedCategory: issue.predictedCategory }
    );

    logger.success('AIService', 'AI Analysis Completed', {
      issueId,
      finalStatus: issue.status,
      trustScore: issue.trustScore,
      severity: issue.severity
    });

    // Run priority evaluation and auto-routing engine
    const { runPriorityEngineAndRoute } = await import('../issues/priorityEngine.service');
    await runPriorityEngineAndRoute(issue._id.toString());

    return issue;

  } catch (error: any) {
    logger.error('AIService', 'AI Analysis Pipeline Failed', {
      issueId,
      error: error?.message || 'Unknown error'
    });

    const failPrevStatus = issue.status;
    issue.status = ISSUE_STATUS.NEEDS_MANUAL_REVIEW;
    await issue.save();
    await ManualReview.create({
      issueId: issue._id,
      reason: `AI Pipeline failure: ${error?.message || 'Unknown error'}`,
      reviewStatus: 'PENDING'
    }).catch(console.error);

    await createAuditLog(
      null,
      'system',
      'AI_ANALYSIS_FAILED',
      'Issue',
      issue._id,
      failPrevStatus,
      ISSUE_STATUS.NEEDS_MANUAL_REVIEW,
      { error: error?.message || 'Unknown error' }
    );

    throw error;
  }
};

