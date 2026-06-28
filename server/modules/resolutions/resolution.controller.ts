import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { ApiError } from '../../utils/ApiError';
import * as resolutionService from './resolution.service';
import { uploadToImageKit } from '../issues/imagekit.service';
import { logger } from '../../utils/logger';

export const officerSubmitResolution = asyncHandler(async (req: Request, res: Response) => {
  const { issueId } = req.params;
  const officerId = (req as any).user._id;

  const beforeMediaUrls: string[] = [];
  const afterMediaUrls: string[] = [];

  const files = (req as any).files as Record<string, Express.Multer.File[]>;

  if (files) {
    // Upload "before" media to ImageKit
    if (files.beforeMedia && files.beforeMedia.length > 0) {
      logger.info('ResolutionController', `Uploading ${files.beforeMedia.length} before-media file(s) to ImageKit`, { issueId });

      for (const file of files.beforeMedia) {
        try {
          const result = await uploadToImageKit(file, 'civicpulse/resolutions/before', [issueId, 'before', officerId.toString()]);
          beforeMediaUrls.push(result.url);
          logger.success('ResolutionController', 'Before-media uploaded', { url: result.url });
        } catch (err: any) {
          logger.error('ResolutionController', 'Before-media upload failed', { filename: file.originalname, error: err?.message });
          throw new ApiError(500, `Failed to upload before-media: ${err?.message}`);
        }
      }
    }

    // Upload "after" media to ImageKit
    if (files.afterMedia && files.afterMedia.length > 0) {
      logger.info('ResolutionController', `Uploading ${files.afterMedia.length} after-media file(s) to ImageKit`, { issueId });

      for (const file of files.afterMedia) {
        try {
          const result = await uploadToImageKit(file, 'civicpulse/resolutions/after', [issueId, 'after', officerId.toString()]);
          afterMediaUrls.push(result.url);
          logger.success('ResolutionController', 'After-media uploaded', { url: result.url });
        } catch (err: any) {
          logger.error('ResolutionController', 'After-media upload failed', { filename: file.originalname, error: err?.message });
          throw new ApiError(500, `Failed to upload after-media: ${err?.message}`);
        }
      }
    }
  }

  const resolutionData = {
    ...req.body,
    beforeMedia: beforeMediaUrls.length > 0 ? beforeMediaUrls : undefined,
    afterMedia: afterMediaUrls.length > 0 ? afterMediaUrls : undefined
  };

  logger.info('ResolutionController', 'Submitting resolution', {
    issueId,
    officerId: officerId.toString(),
    beforeCount: beforeMediaUrls.length,
    afterCount: afterMediaUrls.length
  });

  const resolution = await resolutionService.submitResolution(issueId, officerId, resolutionData);

  logger.success('ResolutionController', 'Resolution submitted', { issueId });

  res.status(200).json(new ApiResponse(200, resolution, 'Resolution submitted successfully'));
});

export const citizenConfirmResolution = asyncHandler(async (req: Request, res: Response) => {
  const { issueId } = req.params;
  const userId = (req as any).user._id;

  const feedback = await resolutionService.submitCitizenFeedback(issueId, userId, req.body);

  res.status(200).json(new ApiResponse(200, feedback, 'Resolution feedback submitted'));
});
