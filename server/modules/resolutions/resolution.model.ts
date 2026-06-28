import mongoose, { Schema, Document } from 'mongoose';
import { RESOLUTION_STATUS } from '../../config/constants';

export interface IResolution extends Document {
  issueId: mongoose.Types.ObjectId;
  officerId: mongoose.Types.ObjectId;
  departmentId?: mongoose.Types.ObjectId;
  wardId?: mongoose.Types.ObjectId;
  resolutionStatus: string;
  workSummary: string;
  internalNotes?: string;
  beforeMedia?: string[];
  afterMedia?: string[];
  proofDocuments?: string[];
  resolvedAt?: Date;
  submittedAt?: Date;
  estimatedCost?: number;
  contractorDetails?: string;
  createdAt: Date;
  updatedAt: Date;
}

const resolutionSchema = new Schema(
  {
    issueId: { type: Schema.Types.ObjectId, ref: 'Issue', required: true, unique: true },
    officerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department' },
    wardId: { type: Schema.Types.ObjectId, ref: 'Ward' },
    resolutionStatus: { 
      type: String, 
      enum: Object.values(RESOLUTION_STATUS),
      default: RESOLUTION_STATUS.DRAFT
    },
    workSummary: { type: String, required: true },
    internalNotes: { type: String },
    beforeMedia: { type: [String], default: [] },
    afterMedia: { type: [String], default: [] },
    proofDocuments: { type: [String], default: [] },
    resolvedAt: { type: Date },
    submittedAt: { type: Date },
    estimatedCost: { type: Number },
    contractorDetails: { type: String }
  },
  { timestamps: true }
);

export const Resolution = mongoose.model<IResolution>('Resolution', resolutionSchema);
