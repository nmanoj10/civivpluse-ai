import mongoose, { Schema, Document } from 'mongoose';

export interface IAuditLog extends Document {
  actorId?: mongoose.Types.ObjectId;
  actorRole?: string;
  actionType: string;
  entityType: string;
  entityId: mongoose.Types.ObjectId;
  previousState?: string;
  nextState?: string;
  metadata?: any;
  createdAt: Date;
}

const auditLogSchema = new Schema(
  {
    actorId: { type: Schema.Types.ObjectId, ref: 'User' },
    actorRole: { type: String },
    actionType: { type: String, required: true },
    entityType: { type: String, required: true },
    entityId: { type: Schema.Types.ObjectId, required: true },
    previousState: { type: String },
    nextState: { type: String },
    metadata: { type: Schema.Types.Mixed }
  },
  { timestamps: { updatedAt: false } }
);

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', auditLogSchema);
