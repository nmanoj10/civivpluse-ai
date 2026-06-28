import mongoose, { Schema, Document } from 'mongoose';

export interface IManualReview extends Document {
  issueId: mongoose.Types.ObjectId;
  reason: string;
  flags: string[];
  reviewStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  assignedModerator?: mongoose.Types.ObjectId;
  reviewerId?: mongoose.Types.ObjectId;
  decision?: string;
  resolutionNote?: string;
  reviewedAt?: Date;
  /** Escalation level: 0 = normal queue, 1 = senior/admin reviewer (two-strike) */
  escalationLevel: number;
  createdAt: Date;
  updatedAt: Date;
}

const manualReviewSchema = new Schema(
  {
    issueId: { type: Schema.Types.ObjectId, ref: 'Issue', required: true },
    reason: { type: String, required: true },
    flags: { type: [String], default: [] },
    reviewStatus: { 
      type: String, 
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING'
    },
    assignedModerator: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewerId:         { type: Schema.Types.ObjectId, ref: 'User' },
    decision:           { type: String },
    resolutionNote:     { type: String },
    reviewedAt:         { type: Date },
    escalationLevel:    { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const ManualReview = mongoose.model<IManualReview>('ManualReview', manualReviewSchema);
