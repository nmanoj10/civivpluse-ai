import { Issue } from './issue.model';
import { IssueMedia } from './issueMedia.model';
import { ApiError } from '../../utils/ApiError';
import { ISSUE_STATUS } from '../../config/constants';
import { processIssuePostAnalysis } from '../ai/ai.service';
import { transitionStatus } from '../../utils/issueStateMachine';
import { createTimelineEvent } from './timeline.service';
import { createAuditLog } from '../audit/audit.service';
import { uploadMultipleToImageKit } from './imagekit.service';
import { createNotification } from '../notifications/notification.service';
import { NOTIFICATION_TYPES } from '../../config/constants';
import { logger } from '../../utils/logger';

export const createIssue = async (issueData: any, userId: string) => {
  const { title, description, category, lat, lng, address, ward, city, citizenSizeReference } = issueData;

  if (!title || !description || !lat || !lng) {
    throw new ApiError(400, 'title, description, lat and lng are required');
  }

  const payload = { title, description, category, lat, lng, address, ward, city };

  // Attempt to detect duplicate master issue
  const duplicateMaster = await import('./duplicateDetection.service')
    .then(m => m.detectDuplicate(payload));

  // Create the issue record
  const issue = await Issue.create({
    reportedBy: userId,
    title,
    description,
    reportedCategory: category,
    citizenSizeReference,
    location: {
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      address,
      ward,
      city,
      geoJSON: {
        type: 'Point',
        coordinates: [parseFloat(lng), parseFloat(lat)]
      }
    },
    status: ISSUE_STATUS.SUBMITTED
  });

  logger.info('IssueService', 'Issue created', { issueId: issue._id.toString(), userId });

  if (duplicateMaster) {
    const { mergeIntoMaster } = await import('./masterIssue.service');
    await mergeIntoMaster(duplicateMaster._id, issue);
  } else {
    const { createMasterIssue } = await import('./masterIssue.service');
    await createMasterIssue(issue);
  }

  await createTimelineEvent(
    issue._id,
    'ISSUE_REPORTED',
    'Issue Reported',
    'Citizen successfully submitted the issue report.',
    userId,
    'citizen'
  );

  await createAuditLog(
    userId,
    'citizen',
    'CREATE_ISSUE',
    'Issue',
    issue._id,
    undefined,
    ISSUE_STATUS.SUBMITTED
  );

  // Notify citizen that their issue was created
  try {
    await createNotification(
      userId,
      NOTIFICATION_TYPES.ISSUE_SUBMITTED,
      'Issue Reported Successfully',
      `Your reported issue "${issue.title}" has been submitted and is being processed by our AI system.`,
      issue._id.toString()
    );
  } catch (notifErr: any) {
    logger.error('IssueService', 'Failed to create creation notification', { error: notifErr?.message });
  }

  // Emit real-time Socket.IO event to ward and city rooms
  try {
    const { emitToRoom, emitToGlobal } = await import('../../config/socket');
    const wardName = issue.location.ward || 'Default';
    const cityName = issue.location.city || 'Default';
    emitToRoom(`ward:${wardName}`, 'NEW_ISSUE_CREATED', issue);
    emitToRoom(`city:${cityName}`, 'NEW_ISSUE_CREATED', issue);
    emitToRoom('admin', 'NEW_ISSUE_CREATED', issue);
    emitToGlobal('NEW_ISSUE_CREATED', issue);
  } catch (err: any) {
    logger.error('IssueService', 'Failed to emit NEW_ISSUE_CREATED', { error: err?.message });
  }

  // Fail-safe: Trigger AI analysis asynchronously on creation, so even without media the issue is classified and routed!
  try {
    processIssuePostAnalysis(issue._id.toString()).catch((err) => {
      logger.error('IssueService', 'Fail-safe AI analysis failed', { issueId: issue._id.toString(), error: err?.message });
    });
  } catch (err) {
    logger.error('IssueService', 'Failed to schedule fail-safe AI analysis', { error: err });
  }

  return issue;
};

export const attachMediaToIssue = async (issueId: string, files: Express.Multer.File[], userId: string) => {
  const issue = await Issue.findById(issueId);
  if (!issue) {
    logger.error('IssueService', `Failed to attach media: issue ${issueId} not found`);
    throw new ApiError(404, 'Issue not found');
  }

  if (!files || files.length === 0) {
    logger.warn('IssueService', `Failed to attach media: No files provided for issue ${issueId}`);
    throw new ApiError(400, 'No files provided');
  }

  logger.info('IssueService', 'Media upload started', {
    issueId,
    fileCount: files.length,
    userId,
    filesInfo: files.map(f => ({ name: f.originalname, mimetype: f.mimetype, size: f.size }))
  });

  // Upload all files to ImageKit with rollback on partial failure
  const tags = [issueId, userId, 'citizen-report'];
  const uploadResults = await uploadMultipleToImageKit(files, 'civicpulse/issues', tags);

  logger.success('IssueService', 'All files uploaded successfully to ImageKit', {
    issueId,
    fileCount: uploadResults.length,
    results: uploadResults.map(r => ({ fileId: r.fileId, url: r.url, size: r.size, width: r.width, height: r.height }))
  });

  // Save IssueMedia documents for each successfully uploaded file
  const isEvidence = !!issue.masterIssueId;
  
  logger.info('IssueService', 'Saving media documents to MongoDB', {
    issueId,
    isEvidence,
    masterIssueId: issue.masterIssueId
  });

  const mediaDocuments = await Promise.all(
    uploadResults.map(async (result, idx) => {
      const file = files[idx];
      const mediaType: 'image' | 'video' = file.mimetype.startsWith('video') ? 'video' : 'image';

      logger.info('IssueService', `Creating IssueMedia record for file [${file.originalname}]`, {
        fileId: result.fileId,
        url: result.url,
        thumbnailUrl: result.thumbnailUrl,
        width: result.width,
        height: result.height
      });

      const mediaDoc = await IssueMedia.create({
        issueId: issue._id,
        uploadedBy: userId,
        mediaType,
        mimeType: file.mimetype,
        imageKitFileId: result.fileId,
        url: result.url,
        thumbnailUrl: result.thumbnailUrl,
        fileSize: result.size,
        width: result.width,
        height: result.height,
        tags: result.name ? [result.name] : [],
        originalFilename: file.originalname,
        uploadedAt: result.uploadedAt,
        isEvidence,
      });

      logger.success('IssueService', `IssueMedia record created in MongoDB: ${mediaDoc._id}`, {
        issueId: mediaDoc.issueId,
        url: mediaDoc.url
      });

      return mediaDoc;
    })
  );

  logger.info('IssueService', 'All IssueMedia documents successfully saved', {
    issueId,
    count: mediaDocuments.length
  });

  // Save to issue.media directly for fast schema access (Step 2)
  issue.media = mediaDocuments.map(doc => ({
    imageUrl: doc.url,
    thumbnailUrl: doc.thumbnailUrl || doc.url,
    imageKitFileId: doc.imageKitFileId,
    uploadedBy: doc.uploadedBy
  }));

  // If there's a MasterIssue linked, update its evidenceCount
  if (issue.masterIssueId) {
    const { MasterIssue } = await import('./masterIssue.model');
    await MasterIssue.findByIdAndUpdate(issue.masterIssueId, {
      $inc: { evidenceCount: mediaDocuments.length }
    });
    logger.info('IssueService', 'MasterIssue evidenceCount updated', {
      masterIssueId: issue.masterIssueId.toString(),
      addedCount: mediaDocuments.length
    });
  }

  const previousStatus = issue.status;
  transitionStatus(issue, ISSUE_STATUS.MEDIA_UPLOADED);
  await issue.save();

  await createTimelineEvent(
    issue._id,
    'MEDIA_UPLOADED',
    'Media Uploaded',
    `${files.length} file(s) attached to the issue and stored in ImageKit.`,
    userId,
    'citizen'
  );

  await createAuditLog(
    userId,
    'citizen',
    'MEDIA_UPLOADED',
    'Issue',
    issue._id,
    previousStatus,
    ISSUE_STATUS.MEDIA_UPLOADED
  );

  logger.info('IssueService', 'Triggering AI analysis pipeline', { issueId });

  // Async: fire-and-forget AI analysis
  processIssuePostAnalysis(issue._id.toString()).catch((err) => {
    logger.error('IssueService', 'AI analysis pipeline failed', { issueId, error: err?.message });
  });

  // Emit real-time Socket.IO event to notify that media has been attached
  try {
    const { emitToRoom, emitToGlobal } = await import('../../config/socket');
    const wardName = issue.location.ward || 'Default';
    const cityName = issue.location.city || 'Default';
    emitToRoom(`ward:${wardName}`, 'ISSUE_UPDATED', issue);
    emitToRoom(`city:${cityName}`, 'ISSUE_UPDATED', issue);
    emitToRoom('admin', 'ISSUE_UPDATED', issue);
    emitToGlobal('ISSUE_UPDATED', issue);
  } catch (err: any) {
    logger.error('IssueService', 'Failed to emit ISSUE_UPDATED on media upload', { error: err?.message });
  }

  return { issue, media: mediaDocuments };
};
