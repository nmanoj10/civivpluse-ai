import mongoose, { Schema, Document } from 'mongoose';

/**
 * Phase 3.3 — Issue Watcher (Follow/Watch feature)
 * Lets citizens subscribe to status updates on an issue without voting or reporting.
 * Compound unique index prevents duplicate watch records.
 */
export interface IIssueWatcher extends Document {
  issueId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  createdAt: Date;
}

const issueWatcherSchema = new Schema(
  {
    issueId: { type: Schema.Types.ObjectId, ref: 'Issue', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Prevents duplicate watch records (one watch per user per issue)
issueWatcherSchema.index({ issueId: 1, userId: 1 }, { unique: true });

export const IssueWatcher = mongoose.model<IIssueWatcher>('IssueWatcher', issueWatcherSchema);
