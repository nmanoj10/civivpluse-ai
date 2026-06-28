import { checkOverdueIssues } from '../sla/sla.service';

export const runSlaJob = async () => {
  console.log('Running SLA Overdue Job...');
  try {
    await checkOverdueIssues();
    console.log('SLA Overdue Job completed.');
  } catch (error) {
    console.error('Error running SLA job:', error);
  }
};

// In a real production app, you would use node-cron or bullMQ:
// import cron from 'node-cron';
// cron.schedule('0 * * * *', runSlaJob); // Run every hour
