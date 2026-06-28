import mongoose, { Schema, Document } from 'mongoose';

export interface IIssueMedia extends Document {
  issueId: mongoose.Types.ObjectId;
  uploadedBy: mongoose.Types.ObjectId;
  mediaType: 'image' | 'video';
  mimeType: string;
  // ImageKit fields
  imageKitFileId: string;
  url: string;              // Full ImageKit CDN URL
  thumbnailUrl: string;     // ImageKit thumbnail URL
  fileSize: number;
  width?: number;
  height?: number;
  tags?: string[];
  originalFilename: string;
  uploadedAt: Date;
  // Evidence flag: true when this media was added as supporting evidence for a duplicate/merged issue
  isEvidence: boolean;
  createdAt: Date;
}

const issueMediaSchema = new Schema(
  {
    issueId:          { type: Schema.Types.ObjectId, ref: 'Issue', required: true },
    uploadedBy:       { type: Schema.Types.ObjectId, ref: 'User', required: true },
    mediaType:        { type: String, enum: ['image', 'video'], required: true },
    mimeType:         { type: String, required: true },
    // ImageKit metadata — required for cloud-only storage
    imageKitFileId:   { type: String, required: true },
    url:              { type: String, required: true },
    thumbnailUrl:     { type: String, required: true },
    fileSize:         { type: Number },
    width:            { type: Number },
    height:           { type: Number },
    tags:             { type: [String], default: [] },
    originalFilename: { type: String },
    uploadedAt:       { type: Date, default: Date.now },
    isEvidence:       { type: Boolean, default: false },
  },
  { timestamps: { updatedAt: false } }
);

// Index for efficient media lookups per issue (newest first)
issueMediaSchema.index({ issueId: 1, uploadedAt: -1 });
// Index for uploader queries
issueMediaSchema.index({ uploadedBy: 1 });

export const IssueMedia = mongoose.model<IIssueMedia>('IssueMedia', issueMediaSchema);
