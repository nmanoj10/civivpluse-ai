import mongoose, { Schema, Document } from 'mongoose';
import { USER_ROLES } from '../../config/constants';

export interface IUser extends Document {
  name: string;
  email: string;
  phone?: string;
  passwordHash: string;
  role: string;
  ward?: string;
  locality?: string;
  street?: string;
  city?: string;
  state?: string;
  pincode?: string;
  lat?: number;
  lng?: number;
  profileImage?: string;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, unique: true, sparse: true },
    passwordHash: { type: String, required: true },
    role: { 
      type: String, 
      enum: Object.values(USER_ROLES),
      default: USER_ROLES.CITIZEN
    },
    ward: { type: String },
    locality: { type: String },
    street: { type: String },
    city: { type: String },
    state: { type: String },
    pincode: { type: String },
    lat: { type: Number },
    lng: { type: Number },
    profileImage: { type: String },
    isVerified: { type: Boolean, default: false }
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>('User', userSchema);
