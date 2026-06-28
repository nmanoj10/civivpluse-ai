import { Issue } from '../issues/issue.model';
import { Resolution } from '../resolutions/resolution.model';
import { ISSUE_STATUS, RESOLUTION_STATUS } from '../../config/constants';

export const getPlatformOverview = async () => {
  const totalIssues = await Issue.countDocuments();
  
  const statusCounts = await Issue.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);

  const severityCounts = await Issue.aggregate([
    { $group: { _id: '$severity', count: { $sum: 1 } } }
  ]);

  const categoryCounts = await Issue.aggregate([
    { $group: { _id: '$predictedCategory', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);

  // Verification Funnel & Duplicates
  const duplicateIssues = await Issue.countDocuments({ duplicateOf: { $exists: true } });
  const communityVerified = await Issue.countDocuments({ 
    status: { 
      $in: [
        ISSUE_STATUS.COMMUNITY_VERIFIED, ISSUE_STATUS.ASSIGNED_TO_AUTHORITY, 
        ISSUE_STATUS.IN_PROGRESS, ISSUE_STATUS.RESOLUTION_SUBMITTED, 
        ISSUE_STATUS.PENDING_CITIZEN_CONFIRMATION, ISSUE_STATUS.CLOSED_RESOLVED, 
        ISSUE_STATUS.REOPENED, ISSUE_STATUS.REQUIRES_FOLLOWUP, 
        ISSUE_STATUS.ESCALATED
      ] 
    } 
  });
  
  // Resolution Success
  const resolutions = await Resolution.find();
  const acceptedResolutions = resolutions.filter(r => r.resolutionStatus === RESOLUTION_STATUS.ACCEPTED).length;
  const rejectedResolutions = resolutions.filter(r => r.resolutionStatus === RESOLUTION_STATUS.REJECTED).length;
  const followupResolutions = resolutions.filter(r => r.resolutionStatus === RESOLUTION_STATUS.FOLLOWUP_REQUIRED).length;

  return {
    overview: {
      totalIssues,
      duplicateIssues,
      duplicateMergeRate: totalIssues ? parseFloat(((duplicateIssues / totalIssues) * 100).toFixed(1)) : 0,
      communityVerified,
      verificationRate: totalIssues ? parseFloat(((communityVerified / totalIssues) * 100).toFixed(1)) : 0
    },
    statusBreakdown: statusCounts,
    severityBreakdown: severityCounts,
    topCategories: categoryCounts,
    resolutions: {
      total: resolutions.length,
      accepted: acceptedResolutions,
      rejected: rejectedResolutions,
      followup: followupResolutions,
      successRate: resolutions.length ? parseFloat(((acceptedResolutions / resolutions.length) * 100).toFixed(1)) : 0
    }
  };
};
