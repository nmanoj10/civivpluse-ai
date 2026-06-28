import { Issue } from '../issues/issue.model';
import { Department } from './department.model';
import { Ward } from './ward.model';
import { Assignment } from './assignment.model';
import { User } from '../users/user.model';
import { ISSUE_STATUS, USER_ROLES } from '../../config/constants';
import { createSLA } from '../sla/sla.service';
import { transitionStatus } from '../../utils/issueStateMachine';
import { createTimelineEvent } from '../issues/timeline.service';
import { createNotification } from '../notifications/notification.service';
import { createAuditLog } from '../audit/audit.service';
import { emitToUser, emitToRoom } from '../../config/socket';
import { logger } from '../../utils/logger';

export const assignIssueToAuthority = async (issueId: string) => {
  const issue = await Issue.findById(issueId);
  if (!issue) return null;

  logger.info('AssignmentService', `Attempting auto-assignment for issue: ${issueId}`);

  // 1. Find matching Department based on category and city
  const department = await Department.findOne({
    issueCategoriesHandled: issue.predictedCategory || issue.reportedCategory,
    city: issue.location.city || 'Metropolis'
  });

  // 2. Find matching Ward based on ward string
  let ward = null;
  if (issue.location.ward) {
    ward = await Ward.findOne({ wardName: issue.location.ward, city: issue.location.city });
  }

  // 3. Dynamic Officer Lookup (Find User by city and ward with role WARD_OFFICER)
  let officer = await User.findOne({
    role: USER_ROLES.WARD_OFFICER,
    city: issue.location.city,
    ward: issue.location.ward
  });

  // Fallback to any officer in the same city if ward officer isn't registered
  if (!officer) {
    officer = await User.findOne({
      role: USER_ROLES.WARD_OFFICER,
      city: issue.location.city
    });
  }

  const officerId = officer ? officer._id : (ward && ward.officers && ward.officers.length > 0 ? ward.officers[0] : null);

  if (!officerId) {
    logger.warn('AssignmentService', `No available officer found for city: ${issue.location.city}, ward: ${issue.location.ward}`);
  }

  // 4. Create Assignment document
  const assignment = await Assignment.create({
    issueId: issue._id,
    departmentId: department?._id,
    wardId: ward?._id,
    officerId: officerId
  });

  // 5. Update Issue state and assigned details
  const previousStatus = issue.status;
  transitionStatus(issue, ISSUE_STATUS.ASSIGNED_TO_AUTHORITY);
  
  issue.assignedOfficer = officerId as any;
  issue.assignedDepartment = department?._id as any;
  issue.assignedAt = new Date();
  issue.assignment = {
    departmentId: department?._id as any,
    wardId: ward?._id as any,
    officerId: officerId as any
  };

  await issue.save();
  
  await createTimelineEvent(
    issue._id,
    'ASSIGNED',
    'Assigned to Authority',
    `Assigned to ${department?.name || 'Department'} (Officer: ${officer ? officer.name : 'Unassigned'})`
  );

  await createAuditLog(
    null,
    'system',
    'ISSUE_ASSIGNED',
    'Issue',
    issue._id,
    previousStatus,
    ISSUE_STATUS.ASSIGNED_TO_AUTHORITY,
    { departmentId: department?._id, wardId: ward?._id, officerId }
  );

  // 6. Create SLA (Module 8)
  try {
    await createSLA(issue);
  } catch (slaErr) {
    logger.error('AssignmentService', 'Failed to generate SLA SLA for assignment', { error: slaErr });
  }

  // 7. Store notifications in MongoDB for reporter & officer
  try {
    // Notify Citizen Reporter
    await createNotification(
      issue.reportedBy.toString(),
      'ASSIGNED_TO_AUTHORITY',
      'Issue Assigned to Authority',
      `Your reported issue "${issue.title}" has been assigned to ${department?.name || 'an authority'} for resolution.`,
      issue._id.toString()
    );

    // Notify Assigned Officer
    if (officerId) {
      await createNotification(
        officerId.toString(),
        'ASSIGNED_TO_AUTHORITY',
        'New Task Assigned',
        `A new civic issue "${issue.title}" in your jurisdiction has been assigned to you.`,
        issue._id.toString()
      );

      // Emit Socket event directly and only to the assigned officer's private user room
      emitToUser(officerId.toString(), 'ISSUE_ASSIGNED', issue);
    }
  } catch (notifErr: any) {
    logger.error('AssignmentService', 'Failed to generate database/socket notifications during assignment', { error: notifErr?.message });
  }

  return assignment;
};
