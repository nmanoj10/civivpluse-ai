import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { ManualReview } from './manualReview.model';
import { Issue } from '../issues/issue.model';
import { ISSUE_STATUS } from '../../config/constants';
import { createTimelineEvent } from '../issues/timeline.service';
import { createAuditLog } from '../audit/audit.service';

export const getReviewQueue = asyncHandler(async (req: Request, res: Response) => {
  const queue = await ManualReview.find({ reviewStatus: 'PENDING' }).populate('issueId');
  res.status(200).json(new ApiResponse(200, queue, 'Review queue retrieved'));
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
