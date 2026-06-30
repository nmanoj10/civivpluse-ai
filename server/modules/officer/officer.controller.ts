import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { ApiError } from '../../utils/ApiError';
import { Issue } from '../issues/issue.model';
import { IssueMedia } from '../issues/issueMedia.model';
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
    .sort({ updatedAt: -1 })
    .lean();

  const issuesWithMedia = await Promise.all(
    issues.map(async (issue: any) => {
      const mediaList = await IssueMedia.find({ issueId: issue._id })
        .select('url thumbnailUrl imageKitFileId uploadedBy mediaType mimeType')
        .sort({ uploadedAt: -1 })
        .lean();
      const mappedMedia = mediaList.map((m: any) => ({
        imageUrl: m.url,
        thumbnailUrl: m.thumbnailUrl || m.url,
        url: m.url,
        imageKitFileId: m.imageKitFileId,
        uploadedBy: m.uploadedBy,
        mediaType: m.mediaType,
        mimeType: m.mimeType
      }));
      return {
        ...issue,
        media: mappedMedia,
        thumbnail: mappedMedia[0]?.thumbnailUrl || null,
        previewUrl: mappedMedia[0]?.imageUrl || null
      };
    })
  );

  res.status(200).json(new ApiResponse(200, issuesWithMedia, 'Assigned/Jurisdiction issues retrieved'));
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
    
    // Auto-generate System Chat Message for Citizen Progress Chat
    try {
      const { ChatMessage } = await import('../issues/chatMessage.model');
      const chatMsg = await ChatMessage.create({
        issueId: issue._id,
        senderId: officerId,
        senderName: user.name,
        senderRole: 'system',
        message: `System Update: Issue status changed from ${previousStatus} to ${status}. Note: ${note || 'Work started.'}`,
        isSystemMessage: true
      });
      
      const { emitToRoom, emitToGlobal } = await import('../../config/socket');
      const wardName = issue.location.ward || 'Default';
      const cityName = issue.location.city || 'Default';
      emitToRoom(`ward:${wardName}`, 'ISSUE_UPDATED', issue);
      emitToRoom(`city:${cityName}`, 'ISSUE_UPDATED', issue);
      emitToRoom('admin', 'ISSUE_UPDATED', issue);
      emitToGlobal('ISSUE_UPDATED', issue);
      emitToRoom(`issue:${issue._id}`, 'NEW_MESSAGE', chatMsg);
    } catch (err) {
      console.error('Failed to emit ISSUE_UPDATED or create system chat message:', err);
    }

    res.status(200).json(new ApiResponse(200, issue, 'Issue status updated'));
  } else {
    throw new ApiError(400, 'Invalid status update by officer via this endpoint. Use resolution submission for resolving.');
  }
});

export const addProgressUpdate = asyncHandler(async (req: Request, res: Response) => {
  const { issueId } = req.params;
  const { progressStatus, note } = req.body;
  const officerId = (req as any).user._id;

  if (!progressStatus) {
    throw new ApiError(400, 'progressStatus is required');
  }

  const issue = await Issue.findById(issueId);
  if (!issue) {
    throw new ApiError(404, 'Issue not found');
  }

  const previousStatus = issue.status;
  
  if (issue.status === ISSUE_STATUS.ASSIGNED_TO_AUTHORITY) {
    transitionStatus(issue, ISSUE_STATUS.IN_PROGRESS);
    await issue.save();
  }

  await createTimelineEvent(
    issue._id,
    'IN_PROGRESS',
    progressStatus,
    note || `Officer updated progress: ${progressStatus}`,
    officerId,
    'ward_officer'
  );

  await createAuditLog(
    officerId,
    'ward_officer',
    'PROGRESS_UPDATE',
    'Issue',
    issue._id,
    previousStatus,
    issue.status,
    { progressStatus, note }
  );

  try {
    const { emitToRoom, emitToGlobal } = await import('../../config/socket');
    const wardName = issue.location.ward || 'Default';
    const cityName = issue.location.city || 'Default';
    
    // Auto-generate System Chat Message
    const { ChatMessage } = await import('../issues/chatMessage.model');
    const chatMsg = await ChatMessage.create({
      issueId: issue._id,
      senderId: officerId,
      senderName: (req as any).user.name,
      senderRole: 'system',
      message: `Progress Update: ${progressStatus}. Note: ${note || ''}`,
      isSystemMessage: true
    });

    // Emit OFFICER_UPDATED event as requested in Phase 11
    emitToRoom(`ward:${wardName}`, 'OFFICER_UPDATED', issue);
    emitToRoom(`city:${cityName}`, 'OFFICER_UPDATED', issue);
    emitToRoom('admin', 'OFFICER_UPDATED', issue);
    emitToGlobal('OFFICER_UPDATED', issue);
    emitToRoom(`issue:${issue._id}`, 'NEW_MESSAGE', chatMsg);

    const { createNotification } = await import('../notifications/notification.service');
    await createNotification(
      issue.reportedBy.toString(),
      'IN_PROGRESS',
      `Officer Update: ${progressStatus}`,
      note || `Your reported issue has been updated: ${progressStatus}`,
      issue._id.toString()
    );
  } catch (err: any) {
    console.error('Failed to emit/notify on progress update:', err?.message);
  }

  res.status(200).json(new ApiResponse(200, issue, 'Progress update logged successfully'));
});
