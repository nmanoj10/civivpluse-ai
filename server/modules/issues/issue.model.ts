import mongoose, { Schema, Document } from 'mongoose';
import { ISSUE_STATUS, SEVERITY_LEVELS } from '../../config/constants';

export interface IPriorityBreakdown {
  severityPoints: number;
  trustWeightPoints: number;
  communityVotePoints: number;
  duplicatePoints: number;
  sensitiveLocationBonus: number;
  agePoints: number;
}

export interface IIssue extends Document {
  reportedBy: mongoose.Types.ObjectId;
  title: string;
  description: string;
  reportedCategory?: string;
  predictedCategory?: string;
  /** Citizen-reported physical size reference (e.g. "car_tire") used to cross-check AI severity */
  citizenSizeReference?: string;
  location: {
    lat: number;
    lng: number;
    address?: string;
    ward?: string;
    city?: string;
    geoJSON?: {
      type: string;
      coordinates: number[];
    };
  };
  status: string;
  trustScore?: number;
  trustBreakdown?: {
    authenticityScore: number;
    geoScore: number;
    userTrustWeight: number;
    suspicionFlags: string[];
  };
  severity?: string;
  priorityScore?: number;
  /** Per-component breakdown of priority score — persisted at calculation time, exposed publicly */
  priorityBreakdown?: IPriorityBreakdown;
  /** Timestamp when issue transitioned to COMMUNITY_VERIFIED — exposed publicly for escalation visibility */
  verifiedAt?: Date;
  /**
   * Fast-track flag for high-severity issues (PHASE 1.1 CONSTRAINT).
   * Setting this TRUE only shortens the verification time window (fastTrackDeadline).
   * It MUST NOT and CANNOT reduce the required vote count — minimum 3 EXISTS votes always enforced.
   * The vote-count check reads ONLY from CommunityVote records, never from this flag.
   */
  fastTrackFlag?: boolean;
  /** Expedited deadline for community review (informational only, does not bypass vote requirement) */
  fastTrackDeadline?: Date;
  /** Counts consecutive citizen audit majority-reject outcomes — used for two-strike escalation */
  auditRejectionCount?: number;
  duplicateOf?: mongoose.Types.ObjectId;
  masterIssueId?: mongoose.Types.ObjectId;
  isDuplicate?: boolean;
  supporterCount?: number;
  mergedIssueIds?: mongoose.Types.ObjectId[];
  assignment?: {
    departmentId?: mongoose.Types.ObjectId;
    wardId?: mongoose.Types.ObjectId;
    officerId?: mongoose.Types.ObjectId;
  };
  assignedOfficer?: mongoose.Types.ObjectId;
  assignedDepartment?: mongoose.Types.ObjectId;
  assignedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const issueSchema = new Schema(
  {
    reportedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    reportedCategory: { type: String },
    predictedCategory: { type: String },
    location: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
      address: { type: String },
      ward: { type: String },
      city: { type: String },
      geoJSON: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], required: true } // [lng, lat]
      }
    },
    status: {
      type: String,
      enum: Object.values(ISSUE_STATUS),
      default: ISSUE_STATUS.SUBMITTED
    },
    trustScore: { type: Number },
    trustBreakdown: {
      authenticityScore: { type: Number },
      geoScore: { type: Number },
      userTrustWeight: { type: Number },
      suspicionFlags: { type: [String], default: [] }
    },
    severity: { 
      type: String, 
      enum: Object.values(SEVERITY_LEVELS)
    },
    priorityScore: { type: Number },
    priorityBreakdown: {
      severityPoints:        { type: Number, default: 0 },
      trustWeightPoints:     { type: Number, default: 0 },
      communityVotePoints:   { type: Number, default: 0 },
      duplicatePoints:       { type: Number, default: 0 },
      sensitiveLocationBonus:{ type: Number, default: 0 },
      agePoints:             { type: Number, default: 0 },
    },
    verifiedAt:           { type: Date },
    fastTrackFlag:        { type: Boolean, default: false },
    fastTrackDeadline:    { type: Date },
    auditRejectionCount:  { type: Number, default: 0 },
    citizenSizeReference: {
      type: String,
      enum: ['dinner_plate','football','car_tire','truck_size','small','medium','large','other'],
    },
    duplicateOf: { type: Schema.Types.ObjectId, ref: 'Issue' },
  masterIssueId: { type: Schema.Types.ObjectId, ref: 'MasterIssue' },
    supporterCount: { type: Number, default: 1 },
    mergedIssueIds: [{ type: Schema.Types.ObjectId, ref: 'Issue' }],
    assignment: {
      departmentId: { type: Schema.Types.ObjectId, ref: 'Department' },
      wardId: { type: Schema.Types.ObjectId, ref: 'Ward' },
      officerId: { type: Schema.Types.ObjectId, ref: 'User' }
    },
    assignedOfficer: { type: Schema.Types.ObjectId, ref: 'User' },
    assignedDepartment: { type: Schema.Types.ObjectId, ref: 'Department' },
    assignedAt: { type: Date }
  },
  { timestamps: true }
);

issueSchema.index({ 'location.geoJSON': '2dsphere' });

export const Issue = mongoose.model<IIssue>('Issue', issueSchema);
