import mongoose from 'mongoose';
import connectDB from '../server/config/db';
import { Issue } from '../server/modules/issues/issue.model';
import { IssueMedia } from '../server/modules/issues/issueMedia.model';

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

  // 3. If mergedIssueIds is present
  if (issue.mergedIssueIds && issue.mergedIssueIds.length > 0) {
    issue.mergedIssueIds.forEach((id: any) => idsSet.add(id.toString()));
  }

  return Array.from(idsSet).map(id => new mongoose.Types.ObjectId(id));
};

async function main() {
  await connectDB();
  const parentId = '6a3d591eba113a609c597d70';
  const issue = await Issue.findById(parentId);
  if (!issue) {
    console.log('Parent issue not found!');
    await mongoose.disconnect();
    return;
  }

  console.log('Parent Issue mergedIssueIds:', issue.mergedIssueIds);
  const clusterIds = await getClusterIssueIds(issue);
  console.log('Resolved Cluster IDs:', clusterIds);

  const media = await IssueMedia.find({ issueId: { $in: clusterIds } });
  console.log('Found media items:', media);

  // Check all media in the collection to see if any matches issueId
  const allMedia = await IssueMedia.find();
  console.log('All Media in Collection:', allMedia.map(m => ({ id: m._id, issueId: m.issueId })));

  await mongoose.disconnect();
}

main().catch(console.error);
