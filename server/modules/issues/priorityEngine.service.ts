import { Issue } from './issue.model';
import { CommunityVote } from '../community/communityVote.model';
import { assignIssueToAuthority } from '../assignments/assignment.service';
import { ISSUE_STATUS, SEVERITY_LEVELS, VOTE_TYPES } from '../../config/constants';
import { transitionStatus } from '../../utils/issueStateMachine';
import { emitToRoom, emitToUser, emitToGlobal } from '../../config/socket';
import { logger } from '../../utils/logger';

/**
 * PHASE 1.1 CONSTRAINT: fastTrackFlag behaviour:
 *   TRUE = sets fastTrackDeadline only (shortens the community review time window).
 *   Has ZERO effect on vote counts. Minimum 3 EXISTS votes always required.
 *   The routing check reads ONLY from CommunityVote records, never from this flag.
 *
 * Calculates priority score and routes issue to ward officer ONLY when the
 * community has provided >= 3 positive EXISTS votes.
 */
export const runPriorityEngineAndRoute = async (issueId: string): Promise<any> => {
  const issue = await Issue.findById(issueId);
  if (!issue) {
    logger.warn('PriorityEngine', `Issue not found: ${issueId}`);
    return null;
  }

  logger.info('PriorityEngine', 'Running priority evaluation', { issueId: issue._id.toString() });

  // 1. AI Severity base score (max 50)
  let severityPoints = 5;
  if (issue.severity === SEVERITY_LEVELS.CRITICAL) severityPoints = 50;
  else if (issue.severity === SEVERITY_LEVELS.HIGH) severityPoints = 30;
  else if (issue.severity === SEVERITY_LEVELS.MEDIUM) severityPoints = 15;

  // 2. Trust Score weight (max 20)
  const trustWeightPoints = Math.min(((issue.trustScore || 0) * 0.2), 20);

  // 3. Community Votes weight — derived from real vote records (max 20)
  const votes = await CommunityVote.find({ issueId: issue._id });
  const positiveVotesCount = votes.filter(v => v.voteType === VOTE_TYPES.EXISTS).length;
  const negativeVotesCount = votes.filter(v => v.voteType === VOTE_TYPES.NOT_FOUND).length;
  const communityVotePoints = Math.min(positiveVotesCount * 5, 20);

  // 4. Duplicate Reports weight (max 30)
  const duplicatesCount = issue.mergedIssueIds ? issue.mergedIssueIds.length : 0;
  const duplicatePoints = Math.min(duplicatesCount * 10, 30);

  // 5. Sensitive Location detection bonus (max 15)
  let sensitiveLocationBonus = 0;
  const sensitiveKeywords = ['school', 'hospital', 'highway', 'main road', 'market', 'metro', 'subway', 'station', 'bridge', 'railway'];
  const textToScan = `${issue.title} ${issue.description} ${issue.location.address || ''}`.toLowerCase();
  if (sensitiveKeywords.some(kw => textToScan.includes(kw))) sensitiveLocationBonus = 15;

  // 6. Issue Age weight (max 15)
  const hoursSinceCreation = Math.abs(Date.now() - new Date(issue.createdAt).getTime()) / (1000 * 60 * 60);
  const agePoints = Math.min(Math.floor(hoursSinceCreation), 15);

  // Final capped priority score
  const priorityScore = Math.min(
    severityPoints + trustWeightPoints + communityVotePoints + duplicatePoints + sensitiveLocationBonus + agePoints,
    100
  );

  issue.priorityScore = Math.round(priorityScore);

  // Persist per-component breakdown (Phase 3.1 — publicly exposed)
  issue.priorityBreakdown = {
    severityPoints: Math.round(severityPoints),
    trustWeightPoints: Math.round(trustWeightPoints),
    communityVotePoints: Math.round(communityVotePoints),
    duplicatePoints: Math.round(duplicatePoints),
    sensitiveLocationBonus,
    agePoints: Math.round(agePoints),
  };

  // Recalculate Severity label from computed score
  if (priorityScore >= 75) issue.severity = SEVERITY_LEVELS.CRITICAL;
  else if (priorityScore >= 50) issue.severity = SEVERITY_LEVELS.HIGH;
  else if (priorityScore >= 30) issue.severity = SEVERITY_LEVELS.MEDIUM;

  // FAST-TRACK FLAG (Phase 1.1 — flag-only, no vote-count effect):
  // For high/critical severity, flag the issue and set an expedited deadline.
  // This ONLY shortens the community review time window — the vote threshold is
  // still 3 EXISTS votes, hardcoded in isCommunityRoute below and never read from this flag.
  const isHighSeverity = (issue.severity === SEVERITY_LEVELS.HIGH || issue.severity === SEVERITY_LEVELS.CRITICAL);
  if (isHighSeverity && !issue.fastTrackFlag) {
    issue.fastTrackFlag = true;
    issue.fastTrackDeadline = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2-hour window
    logger.info('PriorityEngine', 'Fast-track flag set — vote count requirement unchanged (still 3)', {
      issueId: issue._id.toString(),
      fastTrackDeadline: issue.fastTrackDeadline,
    });
  }

  await issue.save();

  logger.success('PriorityEngine', 'Priority evaluation completed', {
    issueId: issue._id.toString(),
    score: issue.priorityScore,
    severity: issue.severity,
    breakdown: issue.priorityBreakdown,
    positiveVotes: positiveVotesCount,
    duplicates: duplicatesCount,
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // ROUTING RULE — Community gate is the ONLY path to ASSIGNED_TO_AUTHORITY.
  //
  // REMOVED (Phase 1.1 compliance):
  //   ✗ isEmergencyRoute:  high severity + trust >= 70  → skips community gate  REMOVED
  //   ✗ isPriorityCritical: score >= 75                 → skips community gate  REMOVED
  //
  // RETAINED:
  //   ✓ isCommunityRoute: >= 3 EXISTS votes + trust >= 50
  //     NOTE: fastTrackFlag does NOT appear in this check by design.
  // ─────────────────────────────────────────────────────────────────────────────
  const REQUIRED_COMMUNITY_VOTES = 3;
  const REQUIRED_TRUST_FOR_ROUTING = 50;

  const isCommunityRoute =
    positiveVotesCount >= REQUIRED_COMMUNITY_VOTES &&
    (issue.trustScore || 0) >= REQUIRED_TRUST_FOR_ROUTING;

  const routableStatuses: string[] = [
    ISSUE_STATUS.OPEN_FOR_COMMUNITY_VERIFICATION,
    ISSUE_STATUS.COMMUNITY_VERIFIED,
  ];

  if (isCommunityRoute && routableStatuses.includes(issue.status)) {
    logger.info('PriorityEngine', 'Community routing criteria met. Proceeding to assignment.', {
      issueId: issue._id.toString(),
      positiveVotes: positiveVotesCount,
      trustScore: issue.trustScore,
    });

    if (issue.status !== ISSUE_STATUS.COMMUNITY_VERIFIED) {
      transitionStatus(issue, ISSUE_STATUS.COMMUNITY_VERIFIED);
      issue.verifiedAt = new Date(); // Exposed publicly for escalation visibility (Phase 3.2)
      await issue.save();
    }

    try {
      const assignment = await assignIssueToAuthority(issue._id.toString());
      if (assignment) {
        const assignedIssue = await Issue.findById(issue._id)
          .populate('assignment.officerId', 'name email phone')
          .populate('assignment.departmentId', 'name');

        const wardName = issue.location.ward || 'Default';
        const city = issue.location.city || 'Default';

        emitToRoom(`ward:${wardName}`, 'ISSUE_ASSIGNED', assignedIssue);
        emitToRoom(`city:${city}`, 'ISSUE_ASSIGNED', assignedIssue);
        emitToRoom('admin', 'ISSUE_ASSIGNED', assignedIssue);
        emitToUser(issue.reportedBy.toString(), 'ISSUE_ASSIGNED', assignedIssue);

        logger.success('PriorityEngine', 'Issue auto-assignment complete', {
          issueId: issue._id.toString(),
          officerId: (assignment as any).officerId?.toString(),
        });
      }
    } catch (err: any) {
      logger.error('PriorityEngine', 'Auto-assignment failed', {
        issueId: issue._id.toString(),
        error: err?.message,
      });
    }
  } else {
    const wardName = issue.location.ward || 'Default';
    emitToRoom(`ward:${wardName}`, 'ISSUE_UPDATED', issue);
    emitToGlobal('ISSUE_UPDATED', issue);
  }

  return issue;
};
