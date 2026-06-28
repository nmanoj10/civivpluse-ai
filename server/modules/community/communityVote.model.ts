import mongoose, { Schema, Document } from 'mongoose';
import { VOTE_TYPES } from '../../config/constants';

export interface ICommunityVote extends Document {
  issueId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  voteType: string;
  comment?: string;
  supportingMediaUrl?: string;
  createdAt: Date;
}

const communityVoteSchema = new Schema(
  {
    issueId: { type: Schema.Types.ObjectId, ref: 'Issue', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    voteType: { 
      type: String, 
      enum: Object.values(VOTE_TYPES), 
      required: true 
    },
    comment: { type: String },
    supportingMediaUrl: { type: String }
  },
  { timestamps: { updatedAt: false } }
);

// Ensure one vote per user per issue
communityVoteSchema.index({ issueId: 1, userId: 1 }, { unique: true });

export const CommunityVote = mongoose.model<ICommunityVote>('CommunityVote', communityVoteSchema);
