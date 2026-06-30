import { SLA } from './sla.model';
import { Escalation } from './escalation.model';
import { Issue, IIssue } from '../issues/issue.model';
import { SEVERITY_LEVELS, ISSUE_STATUS } from '../../config/constants';
import { createNotification } from '../notifications/notification.service';
import { sendEscalationEmail } from '../notifications/email.service';
import { User } from '../users/user.model';
import { logger } from '../../utils/logger';

export const createSLA = async (issue: IIssue) => {
  let slaDays = 7; // default

  if (issue.severity === SEVERITY_LEVELS.CRITICAL) slaDays = 1;
  else if (issue.severity === SEVERITY_LEVELS.HIGH) slaDays = 3;
  else if (issue.severity === SEVERITY_LEVELS.MEDIUM) slaDays = 7;
  else if (issue.severity === SEVERITY_LEVELS.LOW) slaDays = 14;

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + slaDays);

  // Remove any previous SLA for this issue
  await SLA.deleteMany({ issueId: issue._id });

  const sla = await SLA.create({
    issueId: issue._id,
    slaDays,
    dueDate
  });

  return sla;
};

export const checkOverdueIssues = async () => {
  const now = new Date();
  
  // Find active issues
  const activeIssues = await Issue.find({
    status: { $in: [
      ISSUE_STATUS.ASSIGNED_TO_AUTHORITY,
      ISSUE_STATUS.IN_PROGRESS,
      ISSUE_STATUS.REOPENED,
      ISSUE_STATUS.REQUIRES_FOLLOWUP,
      ISSUE_STATUS.ESCALATED
    ] }
  });

  for (const issue of activeIssues) {
    const sla = await SLA.findOne({ issueId: issue._id });
    if (!sla) continue;

    let isBreached = false;
    let breachReason = '';

    // 1. Resolve SLA check (dueDate exceeded)
    const dueDateExceeded = now > new Date(sla.dueDate);
    
    // 2. Accept SLA check (If in ASSIGNED_TO_AUTHORITY for more than 2 hours)
    const timeSinceAssignmentMs = now.getTime() - new Date(issue.assignedAt || issue.createdAt).getTime();
    const hoursSinceAssignment = timeSinceAssignmentMs / (1000 * 60 * 60);
    const acceptBreached = issue.status === ISSUE_STATUS.ASSIGNED_TO_AUTHORITY && hoursSinceAssignment > 2;

    // 3. Update SLA check (If in IN_PROGRESS for more than 48 hours without update)
    const timeSinceLastUpdateMs = now.getTime() - new Date(issue.updatedAt || issue.createdAt).getTime();
    const hoursSinceLastUpdate = timeSinceLastUpdateMs / (1000 * 60 * 60);
    const updateBreached = issue.status === ISSUE_STATUS.IN_PROGRESS && hoursSinceLastUpdate > 48;

    if (dueDateExceeded) {
      isBreached = true;
      breachReason = 'Exceeded target resolution SLA due date.';
    } else if (acceptBreached) {
      isBreached = true;
      breachReason = 'Officer failed to accept issue (mark in progress) within 2 hours of assignment.';
    } else if (updateBreached) {
      isBreached = true;
      breachReason = 'Officer failed to update progress status for over 48 hours.';
    }

    if (isBreached) {
      sla.overdueFlag = true;
      
      const timeSinceLastEscalationMs = sla.lastReminderAt ? now.getTime() - new Date(sla.lastReminderAt).getTime() : Infinity;
      const hoursSinceLastEscalation = timeSinceLastEscalationMs / (1000 * 60 * 60);

      // Dev mode allows immediate progressive levels increments for fast verification
      const devMode = true;
      const shouldIncrementLevel = !sla.lastReminderAt || hoursSinceLastEscalation > (devMode ? 0.01 : 24);

      if (shouldIncrementLevel) {
        sla.escalationLevel = Math.min(sla.escalationLevel + 1, 5);
        sla.lastReminderAt = now;
        await sla.save();

        let escalatedToRoleName = 'Officer Reminder';
        if (sla.escalationLevel === 2) escalatedToRoleName = 'Ward Supervisor';
        if (sla.escalationLevel === 3) escalatedToRoleName = 'Municipality Admin';
        if (sla.escalationLevel === 4) escalatedToRoleName = 'District Admin';
        if (sla.escalationLevel === 5) escalatedToRoleName = 'System Escalation';

        logger.warn('SLAService', `Escalating issue: ${issue.title} to Level ${sla.escalationLevel} (${escalatedToRoleName})`);

        // Record Escalation Log
        await Escalation.create({
          issueId: issue._id,
          level: sla.escalationLevel,
          reason: `${breachReason} Escalated to ${escalatedToRoleName}.`,
          status: 'ACTIVE'
        });

        // Update issue status to ESCALATED
        const previousStatus = issue.status;
        issue.status = ISSUE_STATUS.ESCALATED;
        await issue.save();

        // Emit Socket.IO events and notifications
        try {
          const { emitToRoom, emitToGlobal } = await import('../../config/socket');
          const wardName = issue.location.ward || 'Default';
          const cityName = issue.location.city || 'Default';
          
          emitToRoom(`ward:${wardName}`, 'ESCALATED', issue);
          emitToRoom(`city:${cityName}`, 'ESCALATED', issue);
          emitToRoom('admin', 'ESCALATED', issue);
          emitToGlobal('ESCALATED', issue);

          // 1. Notify Officer
          if (issue.assignedOfficer) {
            await createNotification(
              issue.assignedOfficer.toString(),
              'ESCALATED',
              `🚨 TASK ESCALATED (Level ${sla.escalationLevel})`,
              `Your assigned task "${issue.title}" was escalated to ${escalatedToRoleName} due to: ${breachReason}`,
              issue._id.toString()
            );

            // Send Email to Officer
            const officer = await User.findById(issue.assignedOfficer).select('email').lean();
            if (officer?.email) {
              await sendEscalationEmail(officer.email, issue.title, issue._id.toString(), sla.escalationLevel, breachReason);
            }
          }

          // 2. Notify Reporter
          await createNotification(
            issue.reportedBy.toString(),
            'ESCALATED',
            `Status Update: Issue Escalated`,
            `Your reported issue "${issue.title}" has been escalated to ${escalatedToRoleName}.`,
            issue._id.toString()
          );
          const reporter = await User.findById(issue.reportedBy).select('email').lean();
          if (reporter?.email) {
            await sendEscalationEmail(reporter.email, issue.title, issue._id.toString(), sla.escalationLevel, breachReason);
          }

          // 3. Notify Admin
          const admins = await User.find({ role: 'admin' }).select('_id email').lean();
          for (const admin of admins) {
            await createNotification(
              admin._id.toString(),
              'ESCALATED',
              `🚨 SLA BREACH: Level ${sla.escalationLevel} Escalation`,
              `Issue "${issue.title}" escalated to ${escalatedToRoleName}. Reason: ${breachReason}`,
              issue._id.toString()
            );
            if (admin.email) {
              await sendEscalationEmail(admin.email, issue.title, issue._id.toString(), sla.escalationLevel, breachReason);
            }
          }
        } catch (socketErr: any) {
          logger.error('SLAService', 'Failed to emit socket/notifications for escalation', { error: socketErr?.message });
        }
      }
    }
  }
};
