import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { Notification } from './notification.model';

export const getMyNotifications = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user._id;

  const notifications = await Notification.find({ userId }).sort({ createdAt: -1 }).limit(50);
  
  res.status(200).json(new ApiResponse(200, notifications, 'Notifications retrieved'));
});

export const markAsRead = asyncHandler(async (req: Request, res: Response) => {
  const { notificationId } = req.params;
  const userId = (req as any).user._id;

  await Notification.findOneAndUpdate(
    { _id: notificationId, userId },
    { isRead: true }
  );

  res.status(200).json(new ApiResponse(200, null, 'Notification marked as read'));
});

export const markAllAsRead = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user._id;

  await Notification.updateMany(
    { userId, isRead: false },
    { isRead: true }
  );

  res.status(200).json(new ApiResponse(200, null, 'All notifications marked as read'));
});
