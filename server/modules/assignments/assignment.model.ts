import mongoose, { Schema, Document } from 'mongoose';

export interface IAssignment extends Document {
  issueId: mongoose.Types.ObjectId;
  departmentId?: mongoose.Types.ObjectId;
  wardId?: mongoose.Types.ObjectId;
  officerId?: mongoose.Types.ObjectId;
  assignedAt: Date;
  status: string;
}

const assignmentSchema = new Schema({
  issueId: { type: Schema.Types.ObjectId, ref: 'Issue', required: true },
  departmentId: { type: Schema.Types.ObjectId, ref: 'Department' },
  wardId: { type: Schema.Types.ObjectId, ref: 'Ward' },
  officerId: { type: Schema.Types.ObjectId, ref: 'User' },
  assignedAt: { type: Date, default: Date.now },
  status: { type: String, default: 'ACTIVE' }
});

export const Assignment = mongoose.model<IAssignment>('Assignment', assignmentSchema);
