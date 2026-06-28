import mongoose, { Schema, Document } from 'mongoose';

export interface ICitizenScore extends Document {
  userId: mongoose.Types.ObjectId;
  trustScore: number;
  contributionPoints: number;
  level: number;
  reportsSubmitted: number;
  verifiedReports: number;
  falseReports: number;
  verificationsDone: number;
  successfulConfirmations: number;
  badges: string[];
  createdAt: Date;
  updatedAt: Date;
}

const citizenScoreSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    trustScore: { type: Number, default: 50 }, // Base score of 50
    contributionPoints: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    reportsSubmitted: { type: Number, default: 0 },
    verifiedReports: { type: Number, default: 0 },
    falseReports: { type: Number, default: 0 },
    verificationsDone: { type: Number, default: 0 },
    successfulConfirmations: { type: Number, default: 0 },
    badges: { type: [String], default: [] }
  },
  { timestamps: true }
);

export const CitizenScore = mongoose.model<ICitizenScore>('CitizenScore', citizenScoreSchema);
