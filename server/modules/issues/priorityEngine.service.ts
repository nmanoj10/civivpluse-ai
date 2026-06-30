import { Issue } from './issue.model';
import { CommunityVote } from '../community/communityVote.model';
import { assignIssueToAuthority } from '../assignments/assignment.service';
import { ISSUE_STATUS, SEVERITY_LEVELS, VOTE_TYPES } from '../../config/constants';
import { transitionStatus } from '../../utils/issueStateMachine';
import { emitToRoom, emitToUser, emitToGlobal } from '../../config/socket';
import { logger } from '../../utils/logger';

/**
 * Calculates priority score, level, and reasons, and triggers auto-assignment
 * when community verification threshold is met.
 */
export const runPriorityEngineAndRoute = async (issueId: string): Promise<any> => {
  const issue = await Issue.findById(issueId);
  if (!issue) {
    logger.warn('PriorityEngine', `Issue not found: ${issueId}`);
    return null;
  }

  logger.info('PriorityEngine', 'Running priority evaluation', { issueId: issue._id.toString() });

  // 1. AI Severity points (max 30)
  let severityPoints = 5;
  if (issue.severity === SEVERITY_LEVELS.CRITICAL) severityPoints = 30;
  else if (issue.severity === SEVERITY_LEVELS.HIGH) severityPoints = 20;
  else if (issue.severity === SEVERITY_LEVELS.MEDIUM) severityPoints = 10;

  // 2. Trust Score weight (max 10)
  const trustWeightPoints = Math.min(((issue.trustScore || 0) * 0.1), 10);

  // 3. Community Votes weight (max 15)
  // Derived from support/reject counts on the issue
  const supportCount = issue.supportCount || 0;
  const rejectCount = issue.rejectCount || 0;
  const communityVotePoints = Math.max(Math.min((supportCount * 5) - (rejectCount * 3), 15), 0);

  // 4. Duplicate Reports weight (max 15)
  const duplicatesCount = issue.mergedIssueIds ? issue.mergedIssueIds.length : 0;
  const duplicatePoints = Math.min(duplicatesCount * 5, 15);

  // 5. Sensitive Location detection bonus (max 15)
  const nearbyContextScore = issue.nearbyContextScore || 0;
  const sensitiveLocationBonus = Math.min((nearbyContextScore * 0.15), 15);

  // 6. Issue Age weight (max 5)
  const hoursSinceCreation = Math.abs(Date.now() - new Date(issue.createdAt).getTime()) / (1000 * 60 * 60);
  const agePoints = Math.min(Math.floor(hoursSinceCreation / 24) * 0.5, 5);

  // 7. Citizens Affected weight (max 5)
  const citizensAffected = issue.citizensAffected || 1;
  const citizensPoints = Math.min(citizensAffected * 0.5, 5);

  // 8. Traffic Impact weight (max 5)
  let trafficPoints = 1;
  if (issue.trafficImpact === 'HIGH') trafficPoints = 5;
  else if (issue.trafficImpact === 'MEDIUM') trafficPoints = 3;

  // Final priority score (0-100)
  const priorityScore = Math.min(
    severityPoints +
    trustWeightPoints +
    communityVotePoints +
    duplicatePoints +
    sensitiveLocationBonus +
    agePoints +
    citizensPoints +
    trafficPoints,
    100
  );

  issue.priorityScore = Math.round(priorityScore);

  // Determine Priority Level
  if (priorityScore >= 80) issue.priorityLevel = 'CRITICAL';
  else if (priorityScore >= 60) issue.priorityLevel = 'HIGH';
  else if (priorityScore >= 40) issue.priorityLevel = 'MEDIUM';
  else issue.priorityLevel = 'LOW';

  // Save breakdown details
  issue.priorityBreakdown = {
    severityPoints: Math.round(severityPoints),
    trustWeightPoints: Math.round(trustWeightPoints),
    communityVotePoints: Math.round(communityVotePoints),
    duplicatePoints: Math.round(duplicatePoints),
    sensitiveLocationBonus: Math.round(sensitiveLocationBonus),
    agePoints: Math.round(agePoints)
  };

  // Generate Priority Reasons
  const reasons: string[] = [];
  
  // Landmark checks
  if (issue.landmarks && issue.landmarks.length > 0) {
    const hasHospital = issue.landmarks.some(lm => lm.type.includes('hospital') && lm.distance <= 150);
    const hasHighway = issue.landmarks.some(lm => (lm.type.includes('highway') || lm.type.includes('motorway') || lm.type.includes('primary')) && lm.distance <= 150);
    const hasSchool = issue.landmarks.some(lm => lm.type.includes('school') && lm.distance <= 150);
    
    if (hasHospital) reasons.push('Near Hospital');
    if (hasHighway) reasons.push('Highway Adjacent');
    if (hasSchool) reasons.push('Near School');
  }

  if (citizensAffected > 1) {
    reasons.push(`${citizensAffected} Citizens Affected`);
  }
  if (supportCount >= 3) {
    reasons.push('Community Verified');
  }
  if (duplicatesCount > 0) {
    reasons.push(`${duplicatesCount} Duplicate Reports`);
  }
  if (issue.trustScore && issue.trustScore > 80) {
    reasons.push('High Trust Reporter');
  }
  if (issue.trafficImpact === 'HIGH') {
    reasons.push('High Traffic Impact');
  }

  if (reasons.length === 0) {
    reasons.push('Standard Priority Evaluation');
  }
  issue.priorityReasons = reasons;

  await issue.save();

  logger.success('PriorityEngine', 'Priority evaluation completed successfully', {
    issueId: issue._id.toString(),
    score: issue.priorityScore,
    level: issue.priorityLevel,
    reasons: issue.priorityReasons
  });

  // Routing check
  const REQUIRED_COMMUNITY_VOTES = 3;
  const REQUIRED_TRUST_FOR_ROUTING = 50;

  const isCommunityRoute =
    supportCount >= REQUIRED_COMMUNITY_VOTES &&
    (issue.trustScore || 0) >= REQUIRED_TRUST_FOR_ROUTING;

  const routableStatuses: string[] = [
    ISSUE_STATUS.OPEN_FOR_COMMUNITY_VERIFICATION,
    ISSUE_STATUS.COMMUNITY_VERIFIED,
  ];

  if (isCommunityRoute && routableStatuses.includes(issue.status)) {
    logger.info('PriorityEngine', 'Community routing criteria met. Proceeding to assignment.', {
      issueId: issue._id.toString(),
      supportVotes: supportCount,
      trustScore: issue.trustScore,
    });

    if (issue.status !== ISSUE_STATUS.COMMUNITY_VERIFIED) {
      transitionStatus(issue, ISSUE_STATUS.COMMUNITY_VERIFIED);
      issue.verifiedAt = new Date();
      await issue.save();
      
      // Notify community verified event
      try {
        const { createNotification } = await import('../notifications/notification.service');
        await createNotification(
          issue.reportedBy.toString(),
          'COMMUNITY_VERIFIED',
          'Issue Verified by Community',
          `Your reported issue "${issue.title}" has been successfully verified by community consensus.`,
          issue._id.toString()
        );
      } catch (err) { /* non-fatal */ }
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
    // Just emit generic update event
    const wardName = issue.location.ward || 'Default';
    emitToRoom(`ward:${wardName}`, 'ISSUE_UPDATED', issue);
    emitToGlobal('ISSUE_UPDATED', issue);
  }

  return issue;
};
