import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import * as analyticsService from './analytics.service';

export const getOverview = asyncHandler(async (req: Request, res: Response) => {
  const overview = await analyticsService.getPlatformOverview();
  res.status(200).json(new ApiResponse(200, overview, 'Analytics overview retrieved'));
});
