import mongoose, { Schema, Document } from 'mongoose';

export interface ISLA extends Document {
  issueId: mongoose.Types.ObjectId;
  slaDays: number;
  dueDate: Date;
  escalationLevel: number;
  overdueFlag: boolean;
  lastReminderAt?: Date;
  createdAt: Date;
}

const slaSchema = new Schema(
  {
    issueId: { type: Schema.Types.ObjectId, ref: 'Issue', required: true, unique: true },
    slaDays: { type: Number, required: true },
    dueDate: { type: Date, required: true },
    escalationLevel: { type: Number, default: 0 },
    overdueFlag: { type: Boolean, default: false },
    lastReminderAt: { type: Date }
  },
  { timestamps: true }
);

export const SLA = mongoose.model<ISLA>('SLA', slaSchema);
