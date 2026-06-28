import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import * as authService from './auth.service';
import { CitizenScore } from '../users/citizenScore.model';

export const register = asyncHandler(async (req: Request, res: Response) => {
  const user = await authService.registerUser(req.body);
  res.status(201).json(new ApiResponse(201, user, 'User registered successfully'));
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const data = await authService.loginUser(req.body);
  res.status(200).json(new ApiResponse(200, data, 'Login successful'));
});

export const getProfile = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;

  const citizenScore = (user.role === 'citizen' || user.role === 'volunteer')
    ? await CitizenScore.findOne({ userId: user._id })
    : null;

  res.status(200).json(new ApiResponse(200, { ...user.toObject(), citizenScore }, 'Profile retrieved'));
});
