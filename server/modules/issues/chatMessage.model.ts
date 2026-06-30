import mongoose, { Schema, Document } from 'mongoose';

export interface IChatMessage extends Document {
  issueId: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  senderName: string;
  senderRole: string;
  message: string;
  isSystemMessage?: boolean;
  attachments?: Array<{
    type: 'image' | 'location';
    url?: string;
    lat?: number;
    lng?: number;
  }>;
  createdAt: Date;
}

const chatMessageSchema = new Schema(
  {
    issueId: { type: Schema.Types.ObjectId, ref: 'Issue', required: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    senderName: { type: String, required: true },
    senderRole: { type: String, required: true },
    message: { type: String, required: true },
    isSystemMessage: { type: Boolean, default: false },
    attachments: [
      {
        type: { type: String, enum: ['image', 'location'] },
        url: { type: String },
        lat: { type: Number },
        lng: { type: Number }
      }
    ]
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Index for fetching chat history of an issue ordered by creation time
chatMessageSchema.index({ issueId: 1, createdAt: 1 });

export const ChatMessage = mongoose.model<IChatMessage>('ChatMessage', chatMessageSchema);
