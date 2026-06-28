import mongoose, { Schema, Document } from 'mongoose';

export interface IWard extends Document {
  wardName: string;
  wardCode: string;
  city: string;
  officers: mongoose.Types.ObjectId[];
}

const wardSchema = new Schema({
  wardName: { type: String, required: true },
  wardCode: { type: String, required: true },
  city: { type: String, required: true },
  officers: [{ type: Schema.Types.ObjectId, ref: 'User' }]
});

export const Ward = mongoose.model<IWard>('Ward', wardSchema);
