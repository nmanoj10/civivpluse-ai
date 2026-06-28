import mongoose, { Schema, Document } from 'mongoose';

export interface IIssueTimeline extends Document {
  issueId: mongoose.Types.ObjectId;
  type: string; // e.g., 'STATUS_CHANGE', 'MEDIA_UPLOADED', 'AI_ANALYZED', 'VOTED', 'ASSIGNED', 'RESOLUTION_SUBMITTED', 'NOTE_ADDED'
  title: string;
  description: string;
  actorId?: mongoose.Types.ObjectId;
  actorRole?: string;
  metadata?: any;
  createdAt: Date;
}

const issueTimelineSchema = new Schema(
  {
    issueId: { type: Schema.Types.ObjectId, ref: 'Issue', required: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User' },
    actorRole: { type: String },
    metadata: { type: Schema.Types.Mixed }
  },
  { timestamps: { updatedAt: false } }
);

export const IssueTimeline = mongoose.model<IIssueTimeline>('IssueTimeline', issueTimelineSchema);
