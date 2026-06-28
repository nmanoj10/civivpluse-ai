import { Issue } from '../issues/issue.model';

export const generatePredictiveInsights = async () => {
  // Mock generating insights based on recent data
  const insights = [];

  // Example Insight 1: Rising Potholes
  const potholeCount = await Issue.countDocuments({ predictedCategory: 'Road & Transport' });
  if (potholeCount > 10) {
    insights.push({
      insightType: 'RISING_ISSUE_RISK',
      scope: 'City-wide',
      severity: 'HIGH',
      summary: `Road & Transport reports are unusually high (${potholeCount} reports).`,
      generatedAt: new Date()
    });
  }

  // More heuristic logic would go here

  return insights;
};
