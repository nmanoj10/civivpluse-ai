import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/error.middleware';
import authRoutes from './modules/auth/auth.routes';
import issueRoutes from './modules/issues/issue.routes';
import communityRoutes from './modules/community/community.routes';
import officerRoutes from './modules/officer/officer.routes';
import resolutionRoutes from './modules/resolutions/resolution.routes';
import notificationRoutes from './modules/notifications/notification.routes';
import analyticsRoutes from './modules/analytics/analytics.routes';
import moderationRoutes from './modules/admin/moderation.routes';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// NOTE: No local /uploads static serve — all media stored in ImageKit CDN

// Core Modules
app.use('/api/auth', authRoutes);
app.use('/api/issues', issueRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/officer', officerRoutes);
app.use('/api/resolutions', resolutionRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin/analytics', analyticsRoutes);
app.use('/api/admin/moderation', moderationRoutes);

// General health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'CivicPulse API is running' });
});

// Error handling middleware
app.use(errorHandler);

export default app;
