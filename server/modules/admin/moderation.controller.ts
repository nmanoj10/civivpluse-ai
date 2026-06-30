import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { ManualReview } from './manualReview.model';
import { Issue } from '../issues/issue.model';
import { IssueMedia } from '../issues/issueMedia.model';
import { ISSUE_STATUS } from '../../config/constants';
import { createTimelineEvent } from '../issues/timeline.service';
import { createAuditLog } from '../audit/audit.service';
import { Escalation } from '../sla/escalation.model';

export const getReviewQueue = asyncHandler(async (req: Request, res: Response) => {
  const queue = await ManualReview.find({ reviewStatus: 'PENDING' }).populate('issueId');
  const queueWithMedia = await Promise.all(
    queue.map(async (review: any) => {
      if (!review.issueId) return review;
      const mediaList = await IssueMedia.find({ issueId: review.issueId._id })
        .select('url thumbnailUrl imageKitFileId uploadedBy mediaType mimeType')
        .sort({ uploadedAt: -1 })
        .lean();
      const mappedMedia = mediaList.map((m: any) => ({
        imageUrl: m.url,
        thumbnailUrl: m.thumbnailUrl || m.url,
        url: m.url,
        imageKitFileId: m.imageKitFileId,
        uploadedBy: m.uploadedBy,
        mediaType: m.mediaType,
        mimeType: m.mimeType
      }));
      const issueObj = review.issueId.toObject ? review.issueId.toObject() : review.issueId;
      return {
        ...review.toObject(),
        issueId: {
          ...issueObj,
          media: mappedMedia,
          thumbnail: mappedMedia[0]?.thumbnailUrl || null,
          previewUrl: mappedMedia[0]?.imageUrl || null
        }
      };
    })
  );
  res.status(200).json(new ApiResponse(200, queueWithMedia, 'Review queue retrieved'));
});

export const processReview = asyncHandler(async (req: Request, res: Response) => {
  const { reviewId } = req.params;
  const { decision, resolutionNote } = req.body; // decision: APPROVED | REJECTED
  const adminId = (req as any).user._id;

  const review = await ManualReview.findById(reviewId);
  if (!review) throw new Error('Review not found');

  review.reviewStatus = decision;
  review.assignedModerator = adminId;
  review.resolutionNote = resolutionNote;
  review.reviewedAt = new Date();
  await review.save();

  const issue = await Issue.findById(review.issueId);
  if (issue) {
    const previousStatus = issue.status;
    if (decision === 'APPROVED') {
      issue.status = ISSUE_STATUS.OPEN_FOR_COMMUNITY_VERIFICATION;
      await issue.save();

      await createTimelineEvent(
        issue._id,
        'MODERATION_APPROVED',
        'Moderation Approved',
        `Admin approved this issue as valid. Note: ${resolutionNote || 'None'}`,
        adminId,
        'admin'
      );
      await createAuditLog(adminId, 'admin', 'MODERATION_APPROVED', 'Issue', issue._id, previousStatus, ISSUE_STATUS.OPEN_FOR_COMMUNITY_VERIFICATION);

    } else if (decision === 'REJECTED') {
      issue.status = ISSUE_STATUS.REJECTED;
      await issue.save();

      await createTimelineEvent(
        issue._id,
        'MODERATION_REJECTED',
        'Moderation Rejected',
        `Admin rejected this issue as invalid/spam. Note: ${resolutionNote || 'None'}`,
        adminId,
        'admin'
      );
      await createAuditLog(adminId, 'admin', 'MODERATION_REJECTED', 'Issue', issue._id, previousStatus, ISSUE_STATUS.REJECTED);
    }
  }

  res.status(200).json(new ApiResponse(200, review, 'Review processed'));
});

export const getEscalationLogs = asyncHandler(async (req: Request, res: Response) => {
  const logs = await Escalation.find().populate('issueId', 'title status severity').sort({ escalatedAt: -1 });
  res.status(200).json(new ApiResponse(200, logs, 'Escalation logs retrieved'));
});
