import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Issue } from './issue.model';
import { MasterIssue } from './masterIssue.model';
import { IssueMedia } from './issueMedia.model';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { ApiError } from '../../utils/ApiError';
import * as issueService from './issue.service';
import { IssueTimeline } from './issueTimeline.model';
import { SLA } from '../sla/sla.model';
import { Resolution } from '../resolutions/resolution.model';
import { User } from '../users/user.model';
import { Department } from '../assignments/department.model';
import { Ward } from '../assignments/ward.model';
import { logger } from '../../utils/logger';

/**
 * Resolves all linked issue IDs in a cluster (original + duplicates) by checking
 * masterIssueId, duplicateOf, and mergedIssueIds relationships.
 */
const getClusterIssueIds = async (issue: any): Promise<mongoose.Types.ObjectId[]> => {
  const idsSet = new Set<string>();
  idsSet.add(issue._id.toString());

  // 1. If masterIssueId is present
  if (issue.masterIssueId) {
    const linked = await Issue.find({ masterIssueId: issue.masterIssueId }).select('_id');
    linked.forEach(i => idsSet.add(i._id.toString()));
  }

  // 2. If duplicateOf is present
  if (issue.duplicateOf) {
    const parentId = typeof issue.duplicateOf === 'object' && issue.duplicateOf !== null 
      ? issue.duplicateOf._id 
      : issue.duplicateOf;
    idsSet.add(parentId.toString());
    
    const parent = await Issue.findById(parentId).select('mergedIssueIds');
    if (parent && parent.mergedIssueIds) {
      parent.mergedIssueIds.forEach(id => idsSet.add(id.toString()));
    }
  }

  // 3. If mergedIssueIds is present (this is a parent issue with duplicates)
  if (issue.mergedIssueIds && issue.mergedIssueIds.length > 0) {
    issue.mergedIssueIds.forEach((id: any) => idsSet.add(id.toString()));
  }

  return Array.from(idsSet).map(id => new mongoose.Types.ObjectId(id));
};

export const getPublicIssues = asyncHandler(async (req: Request, res: Response) => {
  const issues = await Issue.find({
    status: { $nin: ['DRAFT', 'REJECTED'] }
  })
    .select('-trustBreakdown -assignment')
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  const issuesWithMedia = await Promise.all(
    issues.map(async (issue: any) => {
      const mediaList = await IssueMedia.find({ issueId: issue._id })
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
      return {
        ...issue,
        media: mappedMedia,
        thumbnail: mappedMedia[0]?.thumbnailUrl || null,
        previewUrl: mappedMedia[0]?.imageUrl || null
      };
    })
  );

  res.status(200).json(new ApiResponse(200, issuesWithMedia, 'Public issues retrieved'));
});

export const getIssueById = asyncHandler(async (req: Request, res: Response) => {
  const { issueId } = req.params;
  
  logger.info('IssueController', `Fetching details for issueId: ${issueId}`);
  
  const issue = await Issue.findById(issueId)
    .populate('duplicateOf', 'title status location.address');

  if (!issue) {
    logger.error('IssueController', `Issue not found: ${issueId}`);
    throw new ApiError(404, 'Issue not found');
  }

  const sla = await SLA.findOne({ issueId: issue._id });
  const resolution = await Resolution.findOne({ issueId: issue._id }).populate('officerId', 'name email phone');
  
  // Load collective merged media gallery for the cluster
  const clusterIds = await getClusterIssueIds(issue);
  logger.info('IssueController', `Resolved cluster IDs for issue ${issueId}:`, {
    clusterIds: clusterIds.map(id => id.toString())
  });

  const media = await IssueMedia.find({ issueId: { $in: clusterIds } }).sort({ uploadedAt: -1 });
  logger.info('IssueController', `Loaded ${media.length} collective media items for cluster of issue ${issueId}.`);

  const mappedMedia = media.map((m: any) => {
    const obj = m.toObject ? m.toObject() : m;
    return {
      ...obj,
      imageUrl: obj.url,
      thumbnailUrl: obj.thumbnailUrl || obj.url
    };
  });

  const now = new Date();
  const slaDeadline = sla?.dueDate ?? null;
  const isSlaBreached = slaDeadline ? now > new Date(slaDeadline) : false;

  res.status(200).json(new ApiResponse(200, {
    ...issue.toObject(),
    media: mappedMedia,
    sla,
    resolution,
    // Phase 1.4 + 3.2: Public escalation visibility (no auth required)
    verifiedAt: issue.verifiedAt ?? null,
    slaDeadline,
    isSlaBreached,
    priorityBreakdown: issue.priorityBreakdown ?? null,
    fastTrackFlag: issue.fastTrackFlag ?? false,
    citizenSizeReference: issue.citizenSizeReference ?? null,
  }, 'Issue retrieved'));
});

/**
 * GET /api/issues/:issueId/media
 * Returns all media files for an issue — public endpoint (CDN URLs only).
 */
export const getIssueMedia = asyncHandler(async (req: Request, res: Response) => {
  const { issueId } = req.params;

  logger.info('IssueController', `Fetching media files for issueId: ${issueId}`);

  const issue = await Issue.findById(issueId).select('_id status masterIssueId duplicateOf mergedIssueIds');
  if (!issue) {
    logger.error('IssueController', `Issue not found: ${issueId}`);
    throw new ApiError(404, 'Issue not found');
  }

  // Load collective merged media gallery for the cluster
  const clusterIds = await getClusterIssueIds(issue);
  logger.info('IssueController', `Resolved cluster IDs for media fetch of issue ${issueId}:`, {
    clusterIds: clusterIds.map(id => id.toString())
  });

  const media = await IssueMedia.find({ issueId: { $in: clusterIds } })
    .sort({ uploadedAt: -1 })
    .select('url thumbnailUrl mediaType mimeType width height fileSize uploadedAt isEvidence originalFilename');

  // Log the returned media URLs for tracing
  logger.info('IssueController', `Returning ${media.length} media URLs for issueId ${issueId}:`, {
    urls: media.map(m => m.url)
  });

  res.status(200).json(new ApiResponse(200, media, 'Issue media retrieved'));
});

export const reportIssue = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user._id;
  const issue = await issueService.createIssue(req.body, userId);

  res.status(201).json(new ApiResponse(201, issue, 'Issue reported successfully'));
});

export const uploadMedia = asyncHandler(async (req: Request, res: Response) => {
  const { issueId } = req.params;
  const userId = (req as any).user._id;
  const files = (req as any).files as Express.Multer.File[];

  if (!files || files.length === 0) {
    res.status(400).json(new ApiResponse(400, null, 'No files uploaded'));
    return;
  }

  logger.info('IssueController', 'Media upload request received', {
    issueId,
    userId: userId.toString(),
    fileCount: files.length,
    files: files.map(f => ({ name: f.originalname, mime: f.mimetype, size: f.size }))
  });

  const result = await issueService.attachMediaToIssue(issueId, files, userId);

  logger.success('IssueController', 'Media upload completed', {
    issueId,
    mediaCount: result.media.length
  });

  res.status(200).json(new ApiResponse(200, {
    issue: result.issue,
    media: result.media.map(m => ({
      _id: m._id,
      url: m.url,
      thumbnailUrl: m.thumbnailUrl,
      mediaType: m.mediaType,
      mimeType: m.mimeType,
      width: m.width,
      height: m.height,
      fileSize: m.fileSize,
      uploadedAt: m.uploadedAt
    }))
  }, 'Media uploaded to ImageKit and AI analysis triggered'));
});

export const getIssueTimeline = asyncHandler(async (req: Request, res: Response) => {
  const { issueId } = req.params;

  const issue = await Issue.findById(issueId);
  if (!issue) {
    return res.status(404).json(new ApiResponse(404, null, 'Issue not found'));
  }

  const timeline = await IssueTimeline.find({ issueId }).sort({ createdAt: 1 });

  res.status(200).json(new ApiResponse(200, timeline, 'Issue timeline retrieved'));
});

/**
 * GET /api/issues/nearby
 * Returns master issues near a coordinate, including first media thumbnail.
 * Query params: lat, lng, page (default 1), limit (default 10)
 */
export const getNearbyIssues = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user._id;
  const { lat, lng, page = '1', limit = '10' } = req.query as any;
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  if (!lat || !lng) {
    throw new ApiError(400, 'lat and lng query parameters are required');
  }

  const radiusMeters = 5000; // 5km default
  const skip = (pageNum - 1) * limitNum;

  const nearby = await MasterIssue.aggregate([
    {
      $geoNear: {
        near: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
        distanceField: 'dist',
        spherical: true,
        maxDistance: radiusMeters,
        query: { status: { $ne: 'Closed' } }
      }
    },
    {
      $lookup: {
        from: 'issues',
        localField: '_id',
        foreignField: 'masterIssueId',
        as: 'issues'
      }
    },
    { $unwind: { path: '$issues', preserveNullAndEmptyArrays: true } },
    { $match: { 'issues.reportedBy': { $ne: userId } } },
    { $sort: { dist: 1 } },
    { $skip: skip },
    { $limit: limitNum },
    {
      $group: {
        _id: '$_id',
        title: { $first: '$title' },
        description: { $first: '$description' },
        category: { $first: '$category' },
        location: { $first: '$location' },
        supporterCount: { $first: '$supporterCount' },
        reportCount: { $first: '$reportCount' },
        evidenceCount: { $first: '$evidenceCount' },
        verificationCount: { $first: '$verificationCount' },
        priorityScore: { $first: '$priorityScore' },
        trustScore: { $first: '$trustScore' },
        dist: { $first: '$dist' },
        issueId: { $first: '$issues._id' }
      }
    },
    // Lookup all media from the linked issue
    {
      $lookup: {
        from: 'issuemedia',
        let: { iid: '$issueId' },
        pipeline: [
          { $match: { $expr: { $eq: ['$issueId', '$$iid'] } } },
          { $sort: { uploadedAt: -1 } },
          { $project: { imageUrl: '$url', thumbnailUrl: 1, url: '$url', imageKitFileId: 1, uploadedBy: 1, mediaType: 1, mimeType: 1 } }
        ],
        as: 'media'
      }
    },
    {
      $addFields: {
        thumbnail: { $arrayElemAt: ['$media.thumbnailUrl', 0] },
        previewUrl: { $arrayElemAt: ['$media.imageUrl', 0] }
      }
    },
    { $project: { issues: 0 } }
  ]);

  res.status(200).json(new ApiResponse(200, nearby, 'Nearby issues retrieved'));
});

/**
 * GET /api/issues/explore
 * Returns filtered and paginated Issues for discovery (queries Issue collection for rich data).
 */
export const exploreIssues = asyncHandler(async (req: Request, res: Response) => {
  const {
    category,
    status,
    severity,
    priority,
    ward,
    city,
    district,
    taluk,
    date,
    distance,
    lat,
    lng,
    search,
    sortBy = 'newest',
    page = '1',
    limit = '10'
  } = req.query as any;

  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 10;
  const skip = (pageNum - 1) * limitNum;

  // Build match query
  const matchQuery: any = {
    status: { $nin: ['DRAFT', 'REJECTED'] }
  };

  if (category) matchQuery.reportedCategory = category;
  if (status) matchQuery.status = status;
  if (severity) matchQuery.severity = severity;
  
  if (ward) {
    matchQuery['location.ward'] = { $regex: new RegExp(ward, 'i') };
  }
  if (city) {
    matchQuery['location.city'] = { $regex: new RegExp(city, 'i') };
  }
  if (district) {
    matchQuery['location.address'] = { $regex: new RegExp(district, 'i') };
  }
  if (taluk) {
    matchQuery['location.address'] = { $regex: new RegExp(taluk, 'i') };
  }

  // Date range filter
  if (date) {
    const now = new Date();
    if (date === 'today') {
      matchQuery.createdAt = { $gte: new Date(now.setHours(0, 0, 0, 0)) };
    } else if (date === 'week') {
      matchQuery.createdAt = { $gte: new Date(now.setDate(now.getDate() - 7)) };
    } else if (date === 'month') {
      matchQuery.createdAt = { $gte: new Date(now.setMonth(now.getMonth() - 1)) };
    }
  }

  // PriorityScore filter
  if (priority) {
    const pScore = parseInt(priority, 10);
    if (!isNaN(pScore)) {
      matchQuery.priorityScore = { $gte: pScore };
    }
  }

  // Text search across multiple fields
  if (search) {
    const searchRegex = new RegExp(search, 'i');
    matchQuery.$or = [
      { title: searchRegex },
      { description: searchRegex },
      { reportedCategory: searchRegex },
      { 'location.address': searchRegex },
      { 'location.ward': searchRegex },
      { 'location.locality': searchRegex },
      { 'location.city': searchRegex },
      { status: searchRegex }
    ];
  }

  // Proximity/Geo filter
  let geoNearStage: any = null;
  if (distance && lat && lng) {
    const radiusMeters = parseFloat(distance) * 1000;
    if (!isNaN(radiusMeters)) {
      geoNearStage = {
        $geoNear: {
          near: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
          distanceField: 'dist',
          spherical: true,
          maxDistance: radiusMeters,
          query: matchQuery
        }
      };
    }
  }

  // Build pipeline — query Issue collection directly for rich, populated data
  const pipeline: any[] = [];
  if (geoNearStage) {
    pipeline.push(geoNearStage);
  } else {
    pipeline.push({ $match: matchQuery });
  }

  // Lookup first media thumbnail
  pipeline.push(
    {
      $lookup: {
        from: 'issuemedia',
        let: { iid: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$issueId', '$$iid'] } } },
          { $sort: { uploadedAt: -1 } },
          { $limit: 4 },
          { $project: { imageUrl: '$url', thumbnailUrl: 1, url: '$url', imageKitFileId: 1, uploadedBy: 1, mediaType: 1, mimeType: 1 } }
        ],
        as: 'media'
      }
    },
    {
      $addFields: {
        thumbnail: { $arrayElemAt: ['$media.thumbnailUrl', 0] },
        previewUrl: { $arrayElemAt: ['$media.imageUrl', 0] },
        supportCount: { $ifNull: ['$supportCount', 0] },
        rejectCount: { $ifNull: ['$rejectCount', 0] },
        supporterCount: { $ifNull: ['$supportCount', { $ifNull: ['$supporterCount', 0] }] }
      }
    },
    { $project: { linkedIssues: 0 } }
  );

  // Sorting stage
  if (!geoNearStage) {
    let sortStage: any = { createdAt: -1 };
    if (sortBy === 'newest') sortStage = { createdAt: -1 };
    else if (sortBy === 'priority') sortStage = { priorityScore: -1 };
    else if (sortBy === 'supporters') sortStage = { supportCount: -1 };
    pipeline.push({ $sort: sortStage });
  } else {
    if (sortBy === 'newest') pipeline.push({ $sort: { createdAt: -1 } });
    else if (sortBy === 'priority') pipeline.push({ $sort: { priorityScore: -1 } });
    else if (sortBy === 'supporters') pipeline.push({ $sort: { supportCount: -1 } });
  }

  // Pagination stages
  pipeline.push({ $skip: skip }, { $limit: limitNum });

  const results = await Issue.aggregate(pipeline);

  // Populate officer and department info for each result
  const populatedResults = await Promise.all(
    results.map(async (result: any) => {
      const populated: any = result;
      if (result.assignment?.officerId) {
        try {
          const officer = await User.findById(result.assignment.officerId).select('name email phone').lean();
          if (officer) {
            populated.assignedOfficer = {
              _id: officer._id,
              name: officer.name,
              email: officer.email,
              phone: officer.phone
            };
          }
        } catch {}
      }
      if (result.assignment?.departmentId) {
        try {
          const dept = await Department.findById(result.assignment.departmentId).select('name').lean();
          if (dept) {
            populated.assignedDepartment = { _id: dept._id, name: dept.name };
          }
        } catch {}
      }
      return populated;
    })
  );

  // Get total count for pagination metadata
  let totalCount = 0;
  if (geoNearStage) {
    const countPipeline = [{ $match: matchQuery }, { $count: 'total' }];
    const countRes = await Issue.aggregate(countPipeline);
    totalCount = countRes[0]?.total || 0;
  } else {
    totalCount = await Issue.countDocuments(matchQuery);
  }

  res.status(200).json(new ApiResponse(200, {
    issues: populatedResults,
    pagination: {
      total: totalCount,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(totalCount / limitNum)
    }
  }, 'Explore issues retrieved successfully'));
});

/**
 * GET /api/issues/feed/locality
 * Returns locality-based feed (Ward/Locality/City) for current user.
 * Queries Issue collection directly for rich populated data.
 */
export const getLocalityFeed = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { page = '1', limit = '10' } = req.query as any;
  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 10;
  const skip = (pageNum - 1) * limitNum;

  const matchQuery: any = {
    status: { $nin: ['DRAFT', 'REJECTED', 'NEEDS_MANUAL_REVIEW'] }
  };

  const orConditions: any[] = [];
  if (user.ward) orConditions.push({ 'location.ward': user.ward });
  if (user.locality) orConditions.push({ 'location.locality': user.locality });
  if (user.city) orConditions.push({ 'location.city': user.city });

  if (orConditions.length > 0) {
    matchQuery.$or = orConditions;
  }

  // Proximity sorting if coordinates present
  const pipeline: any[] = [];
  if (user.lat && user.lng) {
    pipeline.push({
      $geoNear: {
        near: { type: 'Point', coordinates: [parseFloat(user.lng), parseFloat(user.lat)] },
        distanceField: 'dist',
        spherical: true,
        query: matchQuery
      }
    });
  } else {
    pipeline.push({ $match: matchQuery });
  }

  // Lookup first media thumbnail
  pipeline.push(
    {
      $lookup: {
        from: 'issuemedia',
        let: { iid: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$issueId', '$$iid'] } } },
          { $sort: { uploadedAt: -1 } },
          { $limit: 4 },
          { $project: { imageUrl: '$url', thumbnailUrl: 1, url: '$url', imageKitFileId: 1, uploadedBy: 1, mediaType: 1, mimeType: 1 } }
        ],
        as: 'media'
      }
    },
    {
      $addFields: {
        thumbnail: { $arrayElemAt: ['$media.thumbnailUrl', 0] },
        previewUrl: { $arrayElemAt: ['$media.imageUrl', 0] },
        supportCount: { $ifNull: ['$supportCount', 0] },
        rejectCount: { $ifNull: ['$rejectCount', 0] }
      }
    }
  );

  // Sorting
  const sortStage: any = { priorityScore: -1, createdAt: -1 };
  pipeline.push({ $sort: sortStage });

  pipeline.push({ $skip: skip }, { $limit: limitNum });

  const results: any[] = await Issue.aggregate(pipeline);

  // Populate officer and department info
  const populatedResults = await Promise.all(
    results.map(async (result: any) => {
      const populated: any = result;
      if (result.assignment?.officerId) {
        try {
          const officer = await User.findById(result.assignment.officerId).select('name email phone').lean();
          if (officer) populated.assignedOfficer = { _id: officer._id, name: officer.name, email: officer.email, phone: officer.phone };
        } catch {}
      }
      if (result.assignment?.departmentId) {
        try {
          const dept = await Department.findById(result.assignment.departmentId).select('name').lean().exec();
          if (dept) populated.assignedDepartment = { _id: dept._id, name: dept.name };
        } catch {}
      }
      return populated;
    })
  );

  const totalCount = await Issue.countDocuments(matchQuery);

  res.status(200).json(new ApiResponse(200, {
    issues: populatedResults,
    pagination: {
      total: totalCount,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(totalCount / limitNum)
    }
  }, 'Locality feed retrieved successfully'));
});

/**
 * GET /api/issues/feed/community
 * Returns community feed for community page (newest, trending, resolved).
 * Queries Issue collection directly for rich, populated data.
 */
export const getCommunityFeed = asyncHandler(async (req: Request, res: Response) => {
  const { type = 'newest', page = '1', limit = '10' } = req.query as any;
  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 10;
  const skip = (pageNum - 1) * limitNum;

  const matchQuery: any = {
    status: { $nin: ['DRAFT', 'REJECTED', 'NEEDS_MANUAL_REVIEW'] }
  };

  let sortStage: any = { createdAt: -1 };

  if (type === 'newest') {
    sortStage = { createdAt: -1 };
  } else if (type === 'trending' || type === 'supported') {
    sortStage = { supporterCount: -1, createdAt: -1 };
  } else if (type === 'resolved') {
    matchQuery.status = { $in: ['RESOLVED', 'CLOSED_RESOLVED'] };
    sortStage = { updatedAt: -1 };
  }

  const issues = await Issue.find(matchQuery)
    .populate('reportedBy', 'name email')
    .populate('assignment.officerId', 'name email phone')
    .populate('assignment.departmentId', 'name')
    .sort(sortStage)
    .skip(skip)
    .limit(limitNum)
    .lean();

  const issuesWithMedia = await Promise.all(
    issues.map(async (issue: any) => {
      const mediaList = await IssueMedia.find({ issueId: issue._id })
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

      const supporterCount = (issue.supportCount || issue.supporterCount || 0);
      const rejectCount = issue.rejectCount || 0;
      const progressPercent = Math.min(
        Math.round(((supporterCount + issue.mergedIssueIds?.length || 0) / Math.max(supporterCount + rejectCount + 1, 1)) * 100),
        100
      );

      return {
        _id: issue._id,
        issueId: issue._id,
        title: issue.title,
        description: issue.description,
        reportedCategory: issue.reportedCategory,
        predictedCategory: issue.predictedCategory,
        status: issue.status,
        location: issue.location,
        priorityScore: issue.priorityScore || 0,
        trustScore: issue.trustScore || 0,
        severity: issue.severity,
        supportCount: supporterCount,
        supporterCount,
        rejectCount,
        reporter: issue.reportedBy,
        assignedOfficer: issue.assignment?.officerId,
        assignedDepartment: issue.assignment?.departmentId,
        assignedAt: issue.assignedAt,
        verifiedAt: issue.verifiedAt,
        media: mappedMedia,
        thumbnail: mappedMedia[0]?.thumbnailUrl || mappedMedia[0]?.imageUrl || null,
        previewUrl: mappedMedia[0]?.imageUrl || null,
        evidenceCount: mappedMedia.length,
        createdAt: issue.createdAt,
        updatedAt: issue.updatedAt,
        mergedIssueIds: issue.mergedIssueIds || [],
        priorityLevel: issue.priorityLevel,
        priorityBreakdown: issue.priorityBreakdown,
        progressPercent,
        aiConfidence: issue.aiConfidence,
        verified: ['COMMUNITY_VERIFIED', 'ASSIGNED_TO_AUTHORITY', 'IN_PROGRESS', 'RESOLVED', 'CLOSED_RESOLVED'].includes(issue.status)
      };
    })
  );

  const totalCount = await Issue.countDocuments(matchQuery);

  res.status(200).json(new ApiResponse(200, {
    issues: issuesWithMedia,
    pagination: {
      total: totalCount,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(totalCount / limitNum)
    }
  }, 'Community feed retrieved successfully'));
});

/**
 * POST /api/issues/master/:masterId/support
 * Increments upvote/support count on MasterIssue AND linked Issue documents.
 */
export const supportMasterIssue = asyncHandler(async (req: Request, res: Response) => {
  const { masterId } = req.params;

  const master = await MasterIssue.findByIdAndUpdate(
    masterId,
    { $inc: { supporterCount: 1 } },
    { new: true }
  );
  if (!master) {
    throw new ApiError(404, 'Master issue not found');
  }

  // Also increment supportCount on all linked Issues
  await Issue.updateMany(
    { masterIssueId: masterId },
    { $inc: { supportCount: 1 } }
  );

  res.status(200).json(new ApiResponse(200, master, 'Supported issue successfully'));
});



// ─────────────────────────────────────────────────────────────────────────────
// PHASE 3.1 — Public "Resolved" feed
// GET /api/issues/feed/resolved — no auth required
// ─────────────────────────────────────────────────────────────────────────────
export const getResolvedFeed = asyncHandler(async (req: Request, res: Response) => {
  const { page = '1', limit = '10', ward, city } = req.query as any;
  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 10;
  const skip = (pageNum - 1) * limitNum;

  const matchQuery: any = { status: 'CLOSED_RESOLVED' };
  if (ward) matchQuery['location.ward'] = { $regex: new RegExp(ward, 'i') };
  if (city) matchQuery['location.city'] = { $regex: new RegExp(city, 'i') };

  const issues = await Issue.find(matchQuery)
    .sort({ updatedAt: -1 })
    .skip(skip)
    .limit(limitNum)
    .select('title description status location severity updatedAt createdAt verifiedAt')
    .lean();

  const { Resolution } = await import('../resolutions/resolution.model');
  const resolvedIssues = await Promise.all(
    issues.map(async (issue: any) => {
      const resolution = await Resolution.findOne({ issueId: issue._id })
        .select('workSummary beforeMedia afterMedia resolvedAt')
        .lean();
      return { ...issue, resolution };
    })
  );

  const total = await Issue.countDocuments(matchQuery);
  res.status(200).json(new ApiResponse(200, {
    issues: resolvedIssues,
    pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
  }, 'Resolved issues feed retrieved'));
});

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 3.2 — Open Graph preview card for social sharing
// GET /api/issues/:issueId/og — no auth required
// ─────────────────────────────────────────────────────────────────────────────
export const getIssueOgCard = asyncHandler(async (req: Request, res: Response) => {
  const { issueId } = req.params;
  const issue = await Issue.findById(issueId).select('title description status location severity').lean();
  if (!issue) throw new ApiError(404, 'Issue not found');

  const firstMedia = await IssueMedia.findOne({ issueId }).select('url thumbnailUrl').lean();
  const imageUrl = firstMedia?.thumbnailUrl || firstMedia?.url || '';
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const issueUrl = `${frontendUrl}/issues/${issueId}`;
  const ogTitle = `CivicPulse: ${(issue as any).title}`;
  const ogDesc = `Status: ${(issue as any).status} | Ward: ${(issue as any).location?.ward || 'Unknown'} | Severity: ${(issue as any).severity || 'Unknown'}`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>${ogTitle}</title>
  <meta name="description" content="${ogDesc}"/>
  <meta property="og:type" content="article"/>
  <meta property="og:title" content="${ogTitle}"/>
  <meta property="og:description" content="${ogDesc}"/>
  <meta property="og:url" content="${issueUrl}"/>
  ${imageUrl ? `<meta property="og:image" content="${imageUrl}"/>` : ''}
  <meta property="og:site_name" content="CivicPulse AI"/>
  <meta name="twitter:card" content="summary_large_image"/>
  <meta name="twitter:title" content="${ogTitle}"/>
  <meta name="twitter:description" content="${ogDesc}"/>
  ${imageUrl ? `<meta name="twitter:image" content="${imageUrl}"/>` : ''}
  <meta http-equiv="refresh" content="0;url=${issueUrl}"/>
</head>
<body>Redirecting to <a href="${issueUrl}">${ogTitle}</a>...</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 3.3 — Watch / Unwatch an issue
// ─────────────────────────────────────────────────────────────────────────────
export const watchIssue = asyncHandler(async (req: Request, res: Response) => {
  const { issueId } = req.params;
  const userId = (req as any).user._id;
  const { IssueWatcher } = await import('./issueWatcher.model');
  try {
    const watcher = await IssueWatcher.create({ issueId, userId });
    res.status(201).json(new ApiResponse(201, watcher, 'Watching issue'));
  } catch (err: any) {
    if (err.code === 11000) {
      res.status(200).json(new ApiResponse(200, null, 'Already watching this issue'));
    } else { throw err; }
  }
});

export const unwatchIssue = asyncHandler(async (req: Request, res: Response) => {
  const { issueId } = req.params;
  const userId = (req as any).user._id;
  const { IssueWatcher } = await import('./issueWatcher.model');
  await IssueWatcher.deleteOne({ issueId, userId });
  res.status(200).json(new ApiResponse(200, null, 'Unwatched issue'));
});

export const getIssueWatcherCount = asyncHandler(async (req: Request, res: Response) => {
  const { issueId } = req.params;
  const { IssueWatcher } = await import('./issueWatcher.model');
  const count = await IssueWatcher.countDocuments({ issueId });
  res.status(200).json(new ApiResponse(200, { issueId, watcherCount: count }, 'Watcher count retrieved'));
});

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 3.4 — Public ward performance stats (straight aggregation)
// GET /api/issues/stats/ward?ward=WardName&city=CityName
// ─────────────────────────────────────────────────────────────────────────────
export const getWardPerformanceStats = asyncHandler(async (req: Request, res: Response) => {
  const { ward, city } = req.query as any;

  const resolvedMatchQuery: any = { status: 'CLOSED_RESOLVED' };
  if (ward) resolvedMatchQuery['location.ward'] = { $regex: new RegExp(ward, 'i') };
  if (city) resolvedMatchQuery['location.city'] = { $regex: new RegExp(city, 'i') };

  const { Resolution } = await import('../resolutions/resolution.model');
  const { SLA } = await import('../sla/sla.model');

  const resolvedIssues = await Issue.find(resolvedMatchQuery).select('_id createdAt').lean();
  const issueIds = resolvedIssues.map((i: any) => i._id);

  const resolutions = await Resolution.find({ issueId: { $in: issueIds } }).select('issueId resolvedAt').lean();
  const issueCreatedAtMap: Record<string, Date> = {};
  resolvedIssues.forEach((i: any) => { issueCreatedAtMap[i._id.toString()] = i.createdAt; });

  let totalResolutionMs = 0;
  let resolutionCount = 0;
  for (const r of resolutions) {
    if (r.resolvedAt) {
      const createdAt = issueCreatedAtMap[r.issueId.toString()];
      if (createdAt) { totalResolutionMs += r.resolvedAt.getTime() - createdAt.getTime(); resolutionCount++; }
    }
  }
  const avgResolutionDays = resolutionCount > 0
    ? Math.round(totalResolutionMs / resolutionCount / (1000 * 60 * 60 * 24) * 10) / 10
    : null;

  const slaRecords = await SLA.find({ issueId: { $in: issueIds } }).lean();
  const breachedCount = slaRecords.filter((s: any) => s.overdueFlag).length;
  const slaBreachRate = slaRecords.length > 0 ? Math.round((breachedCount / slaRecords.length) * 100) : null;

  const allMatchQuery: any = {};
  if (ward) allMatchQuery['location.ward'] = { $regex: new RegExp(ward, 'i') };
  if (city) allMatchQuery['location.city'] = { $regex: new RegExp(city, 'i') };
  const totalReported = await Issue.countDocuments(allMatchQuery);

  res.status(200).json(new ApiResponse(200, {
    ward: ward || null, city: city || null,
    totalReported, totalResolved: issueIds.length,
    resolutionRate: totalReported > 0 ? Math.round((issueIds.length / totalReported) * 100) : 0,
    avgResolutionDays, slaBreachRate,
  }, 'Ward performance stats retrieved'));
});
