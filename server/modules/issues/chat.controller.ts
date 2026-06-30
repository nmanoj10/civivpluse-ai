import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { ApiError } from '../../utils/ApiError';
import { ChatMessage } from './chatMessage.model';
import { Issue } from './issue.model';
import { createNotification } from '../notifications/notification.service';
import { emitToRoom } from '../../config/socket';

/**
 * GET /api/issues/:issueId/chat
 * Retrieves chat history for a specific issue
 */
export const getChatHistory = asyncHandler(async (req: Request, res: Response) => {
  const { issueId } = req.params;

  const issue = await Issue.findById(issueId);
  if (!issue) throw new ApiError(404, 'Issue not found');

  const messages = await ChatMessage.find({ issueId }).sort({ createdAt: 1 });
  res.status(200).json(new ApiResponse(200, messages, 'Chat history retrieved'));
});

/**
 * POST /api/issues/:issueId/chat
 * Posts a new chat message and broadcasts it in real-time
 */
export const postChatMessage = asyncHandler(async (req: Request, res: Response) => {
  const { issueId } = req.params;
  const { message, attachments, isSystemMessage } = req.body;
  const user = (req as any).user;

  if (!message || message.trim() === '') {
    throw new ApiError(400, 'Message body cannot be empty');
  }

  const issue = await Issue.findById(issueId);
  if (!issue) throw new ApiError(404, 'Issue not found');

  const chatMsg = await ChatMessage.create({
    issueId: issue._id,
    senderId: user._id,
    senderName: user.name,
    senderRole: user.role,
    message: message.trim(),
    attachments: Array.isArray(attachments) ? attachments : [],
    isSystemMessage: !!isSystemMessage
  });

  // Emit Socket.IO message to issue specific room (and global for active dashboards)
  try {
    emitToRoom(`issue:${issueId}`, 'NEW_MESSAGE', chatMsg);
    // Also emit to user-specific rooms so that notifications show up if not actively in chat
    const receiverId = user._id.toString() === issue.reportedBy.toString()
      ? (issue.assignedOfficer ? issue.assignedOfficer.toString() : null)
      : issue.reportedBy.toString();

    if (receiverId && !isSystemMessage) {
      emitToRoom(`user:${receiverId}`, 'NEW_MESSAGE', chatMsg);
      
      // Also trigger a database Notification
      await createNotification(
        receiverId,
        'CHAT_MESSAGE',
        `New Message from ${user.name}`,
        message.length > 60 ? `${message.substring(0, 60)}...` : message,
        issueId
      );
    }
  } catch (err: any) {
    console.error('Failed to broadcast chat message via socket/notification:', err?.message);
  }

  res.status(201).json(new ApiResponse(201, chatMsg, 'Message sent successfully'));
});
