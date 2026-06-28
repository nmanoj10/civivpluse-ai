import { SLA } from './sla.model';
import { Escalation } from './escalation.model';
import { Issue, IIssue } from '../issues/issue.model';
import { SEVERITY_LEVELS, ISSUE_STATUS } from '../../config/constants';

export const createSLA = async (issue: IIssue) => {
  let slaDays = 7; // default

  // Simple SLA rules based on severity
  if (issue.severity === SEVERITY_LEVELS.CRITICAL) slaDays = 1;
  else if (issue.severity === SEVERITY_LEVELS.HIGH) slaDays = 3;
  else if (issue.severity === SEVERITY_LEVELS.MEDIUM) slaDays = 5;

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + slaDays);

  const sla = await SLA.create({
    issueId: issue._id,
    slaDays,
    dueDate
  });

  return sla;
};

export const checkOverdueIssues = async () => {
  // In a real app, this would be a cron job
  const now = new Date();
  const overdueSLAs = await SLA.find({
    dueDate: { $lt: now },
    overdueFlag: false
  });

  for (const sla of overdueSLAs) {
    const issue = await Issue.findById(sla.issueId);
    if (!issue) continue;

    // Exclude resolved, closed, or rejected issues
    if (
      issue.status === ISSUE_STATUS.CLOSED_RESOLVED ||
      issue.status === ISSUE_STATUS.REJECTED ||
      issue.status === ISSUE_STATUS.MERGED_WITH_EXISTING_ISSUE
    ) {
      continue;
    }

    sla.overdueFlag = true;
    sla.escalationLevel += 1;
    await sla.save();

    await Escalation.create({
      issueId: sla.issueId,
      level: sla.escalationLevel,
      reason: 'SLA due date breached'
    });

    // Update issue status to ESCALATED
    issue.status = ISSUE_STATUS.ESCALATED;
    await issue.save();
  }
};
