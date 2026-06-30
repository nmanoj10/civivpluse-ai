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

/**
 * Maps categories to target department names
 */
const getTargetDepartment = (category: string): string => {
  const cat = (category || '').toLowerCase();
  if (cat.includes('road') || cat.includes('transport')) return 'Road Maintenance';
  if (cat.includes('water') || cat.includes('sanitation')) return 'Water Supply';
  if (cat.includes('garbage') || cat.includes('waste')) return 'Garbage Management';
  if (cat.includes('drain') || cat.includes('sewer')) return 'Drainage';
  if (cat.includes('light') || cat.includes('electric') || cat.includes('power')) return 'Electricity';
  if (cat.includes('park') || cat.includes('garden')) return 'Parks';
  if (cat.includes('traffic') || cat.includes('signal')) return 'Traffic';
  if (cat.includes('street light') || cat.includes('street lighting')) return 'Street Lighting';
  return 'Public Health'; // default fallback
};

/**
 * Core dynamic officer routing engine
 */
export const assignIssueToAuthority = async (issueId: string) => {
  const issue = await Issue.findById(issueId);
  if (!issue) return null;

  logger.info('AssignmentService', `Running dynamic assignment for issue: ${issueId}`);

  const targetDeptName = getTargetDepartment(issue.predictedCategory || issue.reportedCategory || 'Other');
  
  // Find Department ID (create if missing for seed consistency)
  let department = await Department.findOne({ name: targetDeptName });
  if (!department) {
    department = await Department.create({
      name: targetDeptName,
      issueCategoriesHandled: [issue.predictedCategory || issue.reportedCategory || 'Other'],
      city: issue.location.city || 'Metropolis'
    });
  }

  let ward = null;
  if (issue.location.ward) {
    ward = await Ward.findOne({ wardName: issue.location.ward, city: issue.location.city });
  }

  // 1. Dynamic Officer Lookup: Ward, Department (District fallback matches address/city)
  let matchingOfficers = await User.find({
    role: USER_ROLES.WARD_OFFICER,
    ward: issue.location.ward,
    city: issue.location.city,
    department: targetDeptName
  });

  // Fallback 1: match ward and department only
  if (matchingOfficers.length === 0) {
    matchingOfficers = await User.find({
      role: USER_ROLES.WARD_OFFICER,
      ward: issue.location.ward,
      department: targetDeptName
    });
  }

  // Fallback 2: match department in the same city
  if (matchingOfficers.length === 0) {
    matchingOfficers = await User.find({
      role: USER_ROLES.WARD_OFFICER,
      city: issue.location.city,
      department: targetDeptName
    });
  }

  // Fallback 3: match department anywhere
  if (matchingOfficers.length === 0) {
    matchingOfficers = await User.find({
      role: USER_ROLES.WARD_OFFICER,
      department: targetDeptName
    });
  }

  // Fallback 4: any ward officer in the same ward
  if (matchingOfficers.length === 0) {
    matchingOfficers = await User.find({
      role: USER_ROLES.WARD_OFFICER,
      ward: issue.location.ward
    });
  }

  // Fallback 5: any ward officer in the same city
  if (matchingOfficers.length === 0) {
    matchingOfficers = await User.find({
      role: USER_ROLES.WARD_OFFICER,
      city: issue.location.city
    });
  }

  let assignedOfficerId = null;
  let assignedOfficerName = 'Unassigned';

  // 2. Resolve workload if multiple officers exist (Least Busy Officer algorithm)
  if (matchingOfficers.length > 0) {
    const officerWorkloads = await Promise.all(
      matchingOfficers.map(async (officer) => {
        const count = await Issue.countDocuments({
          assignedOfficer: officer._id,
          status: { $in: [
            ISSUE_STATUS.ASSIGNED_TO_AUTHORITY,
            ISSUE_STATUS.IN_PROGRESS,
            ISSUE_STATUS.REOPENED,
            ISSUE_STATUS.REQUIRES_FOLLOWUP,
            ISSUE_STATUS.ESCALATED
          ] }
        });
        return { officer, count };
      })
    );

    // Sort by workload ascending
    officerWorkloads.sort((a, b) => a.count - b.count);
    const chosen = officerWorkloads[0].officer;
    assignedOfficerId = chosen._id;
    assignedOfficerName = chosen.name;
    logger.info('AssignmentService', `Lowest workload officer selected: ${assignedOfficerName} with ${officerWorkloads[0].count} active issues`);
  }

  // 3. Store Assignment History (mark previous ACTIVE assignments as REASSIGNED)
  await Assignment.updateMany(
    { issueId: issue._id, status: 'ACTIVE' },
    { status: 'REASSIGNED' }
  );

  // Create new active assignment
  const assignment = await Assignment.create({
    issueId: issue._id,
    departmentId: department?._id,
    wardId: ward?._id,
    officerId: assignedOfficerId,
    status: 'ACTIVE'
  });

  // 4. Update Issue Fields
  const previousStatus = issue.status;
  transitionStatus(issue, ISSUE_STATUS.ASSIGNED_TO_AUTHORITY);
  
  issue.assignedOfficer = assignedOfficerId as any;
  issue.assignedDepartment = department?._id as any;
  issue.assignedAt = new Date();
  issue.assignment = {
    departmentId: department?._id as any,
    wardId: ward?._id as any,
    officerId: assignedOfficerId as any
  };

  await issue.save();
  
  // 5. Audit & Timeline Logging
  await createTimelineEvent(
    issue._id,
    'ASSIGNED',
    'Assigned to Authority',
    `Assigned to ${targetDeptName} (Officer: ${assignedOfficerName})`
  );

  await createAuditLog(
    null,
    'system',
    'ISSUE_ASSIGNED',
    'Issue',
    issue._id,
    previousStatus,
    ISSUE_STATUS.ASSIGNED_TO_AUTHORITY,
    { departmentId: department?._id, wardId: ward?._id, officerId: assignedOfficerId }
  );

  // 6. Create SLA
  try {
    await createSLA(issue);
  } catch (slaErr) {
    logger.error('AssignmentService', 'Failed to generate SLA for assignment', { error: slaErr });
  }

  // 7. Send Notifications & Real-Time Broadcasts
  try {
    // Notify Citizen
    await createNotification(
      issue.reportedBy.toString(),
      'ASSIGNED_TO_AUTHORITY',
      'Issue Assigned to Authority',
      `Your reported issue "${issue.title}" has been assigned to ${targetDeptName} (Officer: ${assignedOfficerName}) for resolution.`,
      issue._id.toString()
    );

    // Notify Officer
    if (assignedOfficerId) {
      await createNotification(
        assignedOfficerId.toString(),
        'ASSIGNED_TO_AUTHORITY',
        'New Task Assigned',
        `A new civic issue "${issue.title}" in your jurisdiction has been assigned to you.`,
        issue._id.toString()
      );

      // Socket Emit directly to the officer
      emitToUser(assignedOfficerId.toString(), 'ISSUE_ASSIGNED', issue);
    }
  } catch (notifErr: any) {
    logger.error('AssignmentService', 'Failed to generate notifications during assignment', { error: notifErr?.message });
  }

  return assignment;
};
