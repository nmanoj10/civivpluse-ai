import { Issue, IIssue } from '../issues/issue.model';

export const findPotentialDuplicate = async (issue: IIssue) => {
  // In a real scenario, use PostGIS/MongoDB geospatial queries to find issues within 50m radius
  // and NLP similarity on text
  
  const searchRadiusInMeters = 100;
  
  // Find issues nearby within the last 7 days that are not closed
  const nearbyIssues = await Issue.find({
    _id: { $ne: issue._id },
    status: { $nin: ['CLOSED_RESOLVED', 'REJECTED', 'MERGED_WITH_EXISTING_ISSUE'] },
    'location.geoJSON': {
      $near: {
        $geometry: {
          type: "Point",
          coordinates: issue.location.geoJSON?.coordinates
        },
        $maxDistance: searchRadiusInMeters
      }
    }
  }).limit(5);

  if (nearbyIssues.length === 0) {
    return {
      isDuplicate: false,
      duplicateIssueId: null,
      similarityScore: 0
    };
  }

  // Simple mock matching logic: Check if categories match
  for (const nearby of nearbyIssues) {
    if (nearby.predictedCategory === issue.predictedCategory || nearby.reportedCategory === issue.reportedCategory) {
      return {
        isDuplicate: true,
        duplicateIssueId: nearby._id,
        similarityScore: 0.85
      };
    }
  }

  return {
    isDuplicate: false,
    duplicateIssueId: null,
    similarityScore: 0
  };
};
