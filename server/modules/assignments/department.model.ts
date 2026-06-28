import mongoose, { Schema, Document } from 'mongoose';

export interface IDepartment extends Document {
  name: string;
  issueCategoriesHandled: string[];
  city: string;
}

const departmentSchema = new Schema({
  name: { type: String, required: true },
  issueCategoriesHandled: { type: [String], required: true },
  city: { type: String, required: true }
});

export const Department = mongoose.model<IDepartment>('Department', departmentSchema);
