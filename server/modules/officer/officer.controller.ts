import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { ApiError } from '../../utils/ApiError';
import { Issue } from '../issues/issue.model';
import { ISSUE_STATUS } from '../../config/constants';
import { transitionStatus } from '../../utils/issueStateMachine';
import { createTimelineEvent } from '../issues/timeline.service';
import { createAuditLog } from '../audit/audit.service';
import { SLA } from '../sla/sla.model';
import { Resolution } from '../resolutions/resolution.model';

import { submitResolution } from '../resolutions/resolution.service';

export const getIssueDetailsForOfficer = asyncHandler(async (req: Request, res: Response) => {
  const { issueId } = req.params;
  const user = (req as any).user;
  const officerId = user._id;

  const query: any = { _id: issueId };

  if (user.role === 'admin') {
    // Admin can view anything
  } else if (user.role === 'ward_officer') {
    const orConditions: any[] = [
      { 'assignment.officerId': officerId },
      { 'assignedOfficer': officerId }
    ];
    if (user.ward) {
      orConditions.push({ 'location.ward': user.ward });
    }
    query.$or = orConditions;
  } else {
    if (user.city) {
      query['location.city'] = user.city;
    } else {
      query.$or = [
        { 'assignment.officerId': officerId },
        { 'assignedOfficer': officerId }
      ];
    }
  }

  const issue = await Issue.findOne(query).populate('assignment.departmentId assignment.wardId duplicateOf mergedIssueIds');

  if (!issue) {
    throw new ApiError(404, 'Issue not found or not assigned to you');
  }

  const sla = await SLA.findOne({ issueId: issue._id });
  const resolution = await Resolution.findOne({ issueId: issue._id });

  res.status(200).json(new ApiResponse(200, {
    ...issue.toObject(),
    sla,
    resolution
  }, 'Issue details retrieved'));
});

export const getMyAssignedIssues = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const officerId = user._id;

  const query: any = {
    status: { $in: [
      ISSUE_STATUS.ASSIGNED_TO_AUTHORITY, 
      ISSUE_STATUS.IN_PROGRESS, 
      ISSUE_STATUS.REOPENED, 
      ISSUE_STATUS.REQUIRES_FOLLOWUP, 
      ISSUE_STATUS.ESCALATED
    ] }
  };

  if (user.role === 'admin') {
    // Admins see all active issues across the system
  } else if (user.role === 'ward_officer') {
    // Ward Officers see issues in their assigned ward OR explicitly assigned to them
    const orConditions: any[] = [
      { 'assignment.officerId': officerId },
      { 'assignedOfficer': officerId }
    ];
    if (user.ward) {
      orConditions.push({ 'location.ward': user.ward });
    }
    query.$or = orConditions;
  } else {
    // Municipality officers (or other authority roles) see issues in their city
    if (user.city) {
      query['location.city'] = user.city;
    } else {
      query.$or = [
        { 'assignment.officerId': officerId },
        { 'assignedOfficer': officerId }
      ];
    }
  }

  const issues = await Issue.find(query)
    .populate('reportedBy', 'name email phone')
    .sort({ updatedAt: -1 });

  res.status(200).json(new ApiResponse(200, issues, 'Assigned/Jurisdiction issues retrieved'));
});

export const updateIssueStatus = asyncHandler(async (req: Request, res: Response) => {
  const { issueId } = req.params;
  const { status, note } = req.body;
  const officerId = (req as any).user._id;

  const user = (req as any).user;
  const query: any = { _id: issueId };

  if (user.role === 'admin') {
    // Admin has full access
  } else if (user.role === 'ward_officer') {
    const orConditions: any[] = [{ 'assignment.officerId': officerId }];
    if (user.ward) {
      orConditions.push({ 'location.ward': user.ward });
    }
    query.$or = orConditions;
  } else {
    if (user.city) {
      query['location.city'] = user.city;
    } else {
      query['assignment.officerId'] = officerId;
    }
  }

  const issue = await Issue.findOne(query);

  if (!issue) {
    throw new ApiError(404, 'Issue not found or not within your jurisdiction');
  }

  // Validate status transition
  if (status === ISSUE_STATUS.IN_PROGRESS) {
    const previousStatus = issue.status;
    transitionStatus(issue, status);
    await issue.save();
    
    await createTimelineEvent(
      issue._id,
      'IN_PROGRESS',
      'Work In Progress',
      note || 'Officer has started working on the issue.',
      officerId,
      'ward_officer'
    );
    
    await createAuditLog(officerId, 'ward_officer', 'STATUS_UPDATE', 'Issue', issue._id, previousStatus, status);
    
    // Broadcast status update
    try {
      const { emitToRoom, emitToGlobal } = await import('../../config/socket');
      const wardName = issue.location.ward || 'Default';
      const cityName = issue.location.city || 'Default';
      emitToRoom(`ward:${wardName}`, 'ISSUE_UPDATED', issue);
      emitToRoom(`city:${cityName}`, 'ISSUE_UPDATED', issue);
      emitToRoom('admin', 'ISSUE_UPDATED', issue);
      emitToGlobal('ISSUE_UPDATED', issue);
    } catch (err) {
      console.error('Failed to emit ISSUE_UPDATED on officer update:', err);
    }

    res.status(200).json(new ApiResponse(200, issue, 'Issue status updated'));
  } else {
    throw new ApiError(400, 'Invalid status update by officer via this endpoint. Use resolution submission for resolving.');
  }
});
