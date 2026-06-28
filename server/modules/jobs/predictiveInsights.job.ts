import { generatePredictiveInsights } from '../analytics/predictiveInsights.service';

export const runPredictiveInsightsJob = async () => {
  console.log('Running Predictive Insights Job...');
  try {
    const insights = await generatePredictiveInsights();
    console.log(`Generated ${insights.length} insights.`);
    // In reality, we'd store these insights in a collection to be served via API
  } catch (error) {
    console.error('Error running Predictive Insights Job:', error);
  }
};

// cron.schedule('0 0 * * *', runPredictiveInsightsJob); // Run daily at midnight
