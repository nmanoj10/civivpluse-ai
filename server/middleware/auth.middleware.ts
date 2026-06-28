import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ApiError } from '../utils/ApiError';
import { User } from '../modules/users/user.model';

export const verifyJWT = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      throw new ApiError(401, 'Unauthorized request');
    }

    const decodedToken: any = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key-for-dev');

    // In a real production app, we'd look up the user. For prototype performance, we might just use the decoded token payload
    const user = await User.findById(decodedToken._id).select('-passwordHash');

    if (!user) {
      throw new ApiError(401, 'Invalid Access Token');
    }

    (req as any).user = user;
    next();
  } catch (error: any) {
    next(new ApiError(401, error?.message || 'Invalid access token'));
  }
};
