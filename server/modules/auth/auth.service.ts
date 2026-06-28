import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../users/user.model';
import { CitizenScore } from '../users/citizenScore.model';
import { ApiError } from '../../utils/ApiError';
import { USER_ROLES } from '../../config/constants';

export const registerUser = async (userData: any) => {
  const { name, email, password, phone, role, city, ward, locality, street, state, pincode, lat, lng } = userData;

  // Check if user exists
  const existingUser = await User.findOne({ 
    $or: [{ email }, { phone: phone ? phone : undefined }]
  });

  if (existingUser) {
    throw new ApiError(409, 'User with email or phone already exists');
  }

  // Hash password
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  const finalRole = role && Object.values(USER_ROLES).includes(role) ? role : USER_ROLES.CITIZEN;

  const user = await User.create({
    name,
    email,
    passwordHash,
    phone,
    role: finalRole,
    city,
    ward,
    locality,
    street,
    state,
    pincode,
    lat,
    lng
  });

  // Create initial Citizen Score if they are a citizen/volunteer
  if (finalRole === USER_ROLES.CITIZEN || finalRole === USER_ROLES.VOLUNTEER) {
    await CitizenScore.create({ userId: user._id });
  }

  const userWithoutPassword = user.toObject();
  delete (userWithoutPassword as any).passwordHash;

  return userWithoutPassword;
};

export const loginUser = async (credentials: any) => {
  const { email, password } = credentials;

  const user = await User.findOne({ email });
  if (!user) {
    throw new ApiError(401, 'Invalid credentials');
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    throw new ApiError(401, 'Invalid credentials');
  }

  const token = jwt.sign(
    { _id: user._id, role: user.role },
    process.env.JWT_SECRET || 'fallback-secret-key-for-dev',
    { expiresIn: '7d' }
  );

  const citizenScore = (user.role === USER_ROLES.CITIZEN || user.role === USER_ROLES.VOLUNTEER)
    ? await CitizenScore.findOne({ userId: user._id })
    : null;

  const userWithoutPassword = user.toObject();
  delete (userWithoutPassword as any).passwordHash;

  return { user: { ...userWithoutPassword, citizenScore }, token };
};
