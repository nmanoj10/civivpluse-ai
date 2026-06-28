import { Issue } from '../issues/issue.model';
import { ISSUE_STATUS } from '../../config/constants';

export const calculateWardHealthScore = async (wardId: string) => {
  // A heuristic based engine
  
  const issues = await Issue.find({ 'assignment.wardId': wardId });
  
  const total = issues.length;
  if (total === 0) return { score: 100, message: "No issues reported" };

  const openCount = issues.filter(i => 
    i.status !== ISSUE_STATUS.CLOSED_RESOLVED && 
    i.status !== ISSUE_STATUS.REJECTED && 
    i.status !== ISSUE_STATUS.MERGED_WITH_EXISTING_ISSUE
  ).length;

  const resolvedCount = issues.filter(i => i.status === ISSUE_STATUS.CLOSED_RESOLVED).length;
  
  // Base score 100
  let score = 100;

  // Deduct based on open issue ratio
  const openRatio = openCount / total;
  score -= (openRatio * 40); // Max 40 points deducted for open issues

  // We could add overdue SLA checks here and deduct further

  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    wardId,
    score,
    metrics: { total, openCount, resolvedCount }
  };
};
