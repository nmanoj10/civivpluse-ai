import mongoose, { Schema, Document } from 'mongoose';
import { FEEDBACK_TYPES } from '../../config/constants';

export interface IResolutionFeedback extends Document {
  issueId: mongoose.Types.ObjectId;
  resolutionId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  feedbackType: string;
  comment?: string;
  mediaUrls?: string[];
  createdAt: Date;
}

const resolutionFeedbackSchema = new Schema(
  {
    issueId: { type: Schema.Types.ObjectId, ref: 'Issue', required: true },
    resolutionId: { type: Schema.Types.ObjectId, ref: 'Resolution', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    feedbackType: { 
      type: String, 
      enum: Object.values(FEEDBACK_TYPES),
      required: true
    },
    comment: { type: String },
    mediaUrls: { type: [String], default: [] }
  },
  { timestamps: { updatedAt: false } }
);

// One feedback per user per resolution
resolutionFeedbackSchema.index({ resolutionId: 1, userId: 1 }, { unique: true });

export const ResolutionFeedback = mongoose.model<IResolutionFeedback>('ResolutionFeedback', resolutionFeedbackSchema);
