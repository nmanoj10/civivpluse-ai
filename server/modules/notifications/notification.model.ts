import mongoose, { Schema, Document } from 'mongoose';
import { NOTIFICATION_TYPES } from '../../config/constants';

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  type: string;
  title: string;
  message: string;
  relatedIssueId?: mongoose.Types.ObjectId;
  relatedEntityType?: string;
  relatedEntityId?: mongoose.Types.ObjectId;
  isRead: boolean;
  metadata?: any;
  createdAt: Date;
}

const notificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { 
      type: String, 
      enum: Object.values(NOTIFICATION_TYPES),
      required: true 
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    relatedIssueId: { type: Schema.Types.ObjectId, ref: 'Issue' },
    relatedEntityType: { type: String },
    relatedEntityId: { type: Schema.Types.ObjectId },
    isRead: { type: Boolean, default: false },
    metadata: { type: Schema.Types.Mixed }
  },
  { timestamps: { updatedAt: false } }
);

export const Notification = mongoose.model<INotification>('Notification', notificationSchema);
