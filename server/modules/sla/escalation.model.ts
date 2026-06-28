import mongoose, { Schema, Document } from 'mongoose';

export interface IEscalation extends Document {
  issueId: mongoose.Types.ObjectId;
  level: number;
  escalatedTo?: mongoose.Types.ObjectId;
  reason: string;
  status: string;
  escalatedAt: Date;
}

const escalationSchema = new Schema(
  {
    issueId: { type: Schema.Types.ObjectId, ref: 'Issue', required: true },
    level: { type: Number, required: true },
    escalatedTo: { type: Schema.Types.ObjectId, ref: 'User' },
    reason: { type: String, required: true },
    status: { type: String, default: 'ACTIVE' },
    escalatedAt: { type: Date, default: Date.now }
  }
);

export const Escalation = mongoose.model<IEscalation>('Escalation', escalationSchema);
