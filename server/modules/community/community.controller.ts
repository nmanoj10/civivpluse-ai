import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import * as communityService from './community.service';
import { Issue } from '../issues/issue.model';
import { ISSUE_STATUS } from '../../config/constants';
import { CommunityVote } from './communityVote.model';

export const voteOnIssue = asyncHandler(async (req: Request, res: Response) => {
  const { issueId } = req.params;
  const userId = (req as any).user._id;
  
  const vote = await communityService.submitVote(issueId, userId, req.body);
  
  res.status(201).json(new ApiResponse(201, vote, 'Vote submitted successfully'));
});

export const getPendingIssues = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?._id;
  const { lat, lng, city } = req.query;

  // Find all issues this user has already voted on
  let votedIssueIds: any[] = [];
  if (userId) {
    const userVotes = await CommunityVote.find({ userId });
    votedIssueIds = userVotes.map(v => v.issueId);
  }

  const query: any = {
    status: ISSUE_STATUS.OPEN_FOR_COMMUNITY_VERIFICATION,
    reportedBy: { $ne: userId }, // Exclude issues reported by this user
    _id: { $nin: votedIssueIds } // Exclude issues already voted on by this user
  };

  // Geo search proximity query:
  if (lat && lng && !isNaN(parseFloat(lat as string)) && !isNaN(parseFloat(lng as string))) {
    query['location.geoJSON'] = {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [parseFloat(lng as string), parseFloat(lat as string)]
        },
        $maxDistance: 5000 // 5km radius
      }
    };
  } else if (city) {
    query['location.city'] = city;
  }

  const pendingIssues = await Issue.find(query).limit(20);
  
  res.status(200).json(new ApiResponse(200, pendingIssues, 'Pending issues retrieved'));
});

export const undoVoteOnIssue = asyncHandler(async (req: Request, res: Response) => {
  const { issueId } = req.params;
  const userId = (req as any).user._id;

  const result = await communityService.undoVote(issueId, userId);

  res.status(200).json(new ApiResponse(200, result, 'Vote revoked successfully'));
});
