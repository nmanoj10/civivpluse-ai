import mongoose, { Schema, Document } from 'mongoose';

export interface IMasterIssue extends Document {
  title: string;
  description: string;
  category: string;
  location: {
    lat: number;
    lng: number;
    address?: string;
    ward?: string;
    city?: string;
    geoJSON?: { type: string; coordinates: number[] };
  };
  supporterCount: number;
  reportCount: number;
  duplicateCount: number;
  evidenceCount: number;
  verificationCount: number;
  priorityScore: number;
  trustScore: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

const masterIssueSchema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    category: { type: String, required: true },
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
    supporterCount: { type: Number, default: 0 },
    reportCount: { type: Number, default: 0 },
    duplicateCount: { type: Number, default: 0 },
    evidenceCount: { type: Number, default: 0 },
    verificationCount: { type: Number, default: 0 },
    priorityScore: { type: Number, default: 0 },
    trustScore: { type: Number, default: 0 },
    status: { type: String, default: 'Open' }
  },
  { timestamps: true }
);

masterIssueSchema.index({ 'location.geoJSON': '2dsphere' });

export const MasterIssue = mongoose.model<IMasterIssue>('MasterIssue', masterIssueSchema);
