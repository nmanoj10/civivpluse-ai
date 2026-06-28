import { MasterIssue } from './masterIssue.model';
import { Issue } from './issue.model';

/**
 * Create a new MasterIssue based on an Issue payload.
 */
export const createMasterIssue = async (issue: any) => {
  const master = await MasterIssue.create({
    title: issue.title,
    description: issue.description,
    category: issue.reportedCategory || issue.predictedCategory || 'unknown',
    location: issue.location,
    supporterCount: 1,
    reportCount: 1,
    duplicateCount: 0,
    evidenceCount: 0,
    verificationCount: 0,
    priorityScore: 0,
    trustScore: issue.trustScore || 0,
    status: 'Open'
  });
  // link original issue to master
  issue.masterIssueId = master._id;
  await issue.save();
  return master;
};

/**
 * Merge a duplicate issue into an existing MasterIssue.
 * Increments supporter and report counts, and links the issue.
 */
/**
 * Merge a duplicate issue into an existing MasterIssue.
 * Increments supporter, report, and evidence counts, and links the issue.
 *
 * @param masterId        ID of the master issue to merge into
 * @param duplicateIssue  The duplicate issue document
 * @param mediaCount      Number of media files attached to the duplicate (for evidenceCount)
 */
export const mergeIntoMaster = async (masterId: any, duplicateIssue: any, mediaCount: number = 0) => {
  const master = await MasterIssue.findById(masterId);
  if (!master) return null;

  // Increment counts — each duplicate adds 1 supporter, 1 report, and N evidence files
  master.supporterCount = (master.supporterCount || 0) + 1;
  master.reportCount = (master.reportCount || 0) + 1;
  if (mediaCount > 0) {
    master.evidenceCount = (master.evidenceCount || 0) + mediaCount;
  }
  await master.save();

  // Link duplicate issue to master
  duplicateIssue.masterIssueId = master._id;
  duplicateIssue.isDuplicate = true;
  await duplicateIssue.save();

  // Find primary/original issue of this master issue cluster
  try {
    const { Issue } = await import('./issue.model');
    const originalIssue = await Issue.findOne({ masterIssueId: master._id, isDuplicate: { $ne: true } });
    if (originalIssue) {
      const { runPriorityEngineAndRoute } = await import('./priorityEngine.service');
      await runPriorityEngineAndRoute(originalIssue._id.toString());
    }
  } catch (err) {
    console.error('Failed to run Priority Engine in mergeIntoMaster:', err);
  }

  // Broadcast ISSUE_UPDATED
  try {
    const { emitToRoom, emitToGlobal } = await import('../../config/socket');
    const wardName = master.location.ward || 'Default';
    const cityName = master.location.city || 'Default';
    emitToRoom(`ward:${wardName}`, 'ISSUE_UPDATED', master);
    emitToRoom(`city:${cityName}`, 'ISSUE_UPDATED', master);
    emitToRoom('admin', 'ISSUE_UPDATED', master);
    emitToGlobal('ISSUE_UPDATED', master);
  } catch (err) {
    console.error('Failed to broadcast ISSUE_UPDATED on duplicate merge:', err);
  }

  return master;
};
