import { Notification } from './notification.model';
import { NOTIFICATION_TYPES } from '../../config/constants';

export const createNotification = async (userId: string, type: string, title: string, message: string, relatedIssueId?: string) => {
  const notification = await Notification.create({
    userId,
    type,
    title,
    message,
    relatedIssueId
  });

  // Emit real-time notification
  try {
    const { emitToUser } = await import('../../config/socket');
    emitToUser(userId.toString(), 'NOTIFICATION_RECEIVED', notification);
  } catch (err) {
    console.error('Failed to emit NOTIFICATION_RECEIVED:', err);
  }

  return notification;
};

export const notifyCitizenConfirmationRequired = async (userId: string, issueId: string) => {
  await createNotification(
    userId,
    NOTIFICATION_TYPES.CITIZEN_CONFIRMATION_REQUESTED,
    'Resolution Submitted',
    'An officer has submitted a resolution for your reported issue. Please confirm if it is resolved.',
    issueId
  );
};

export const notifyIssueAssigned = async (officerId: string, issueId: string) => {
  await createNotification(
    officerId,
    NOTIFICATION_TYPES.ASSIGNED_TO_AUTHORITY,
    'New Issue Assigned',
    'A new verified issue has been assigned to you.',
    issueId
  );
};
