import { Router } from 'express';
import {
  reportIssue,
  uploadMedia,
  getIssueTimeline,
  getPublicIssues,
  getIssueById,
  getIssueMedia,
  getNearbyIssues,
  exploreIssues,
  getLocalityFeed,
  getCommunityFeed,
  supportMasterIssue,
  getResolvedFeed,
  getIssueOgCard,
  watchIssue,
  unwatchIssue,
  getIssueWatcherCount,
  getWardPerformanceStats,
} from './issue.controller';
import { verifyJWT } from '../../middleware/auth.middleware';
import { uploadMiddleware } from '../../middleware/upload.middleware';
import { submissionRateLimit } from '../../middleware/rateLimit.middleware';
import { body, validationResult } from 'express-validator';

const router = Router();

const validateRequest = (req: any, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

// Public routes
router.get('/', getPublicIssues);
router.get('/explore', exploreIssues);
router.get('/feed/community', getCommunityFeed);
router.get('/feed/resolved', getResolvedFeed);         // Phase 3.1 - public resolved feed
router.get('/stats/ward', getWardPerformanceStats);    // Phase 3.4 - ward perf stats

// Specific issue endpoints
router.get('/:issueId', getIssueById);
router.get('/:issueId/media', getIssueMedia);
router.get('/:issueId/timeline', getIssueTimeline);
router.get('/:issueId/og', getIssueOgCard);            // Phase 3.2 - OG social card
router.get('/:issueId/watchers', getIssueWatcherCount);// Phase 3.3 - watcher count

// Authenticated: create issue - rate-limited to MAX_ISSUES_PER_HOUR per user/IP
router.post(
  '/',
  verifyJWT,
  submissionRateLimit,
  [
    body('title').notEmpty().withMessage('Title is required'),
    body('description').notEmpty().withMessage('Description is required'),
    body('lat').isNumeric().withMessage('Latitude must be a number'),
    body('lng').isNumeric().withMessage('Longitude must be a number'),
  ],
  validateRequest,
  reportIssue
);

router.post('/:issueId/media', verifyJWT, uploadMiddleware.array('media', 5), uploadMedia);

// Watch / Unwatch (Phase 3.3)
router.post('/:issueId/watch', verifyJWT, watchIssue);
router.delete('/:issueId/watch', verifyJWT, unwatchIssue);

// Support/upvote
router.post('/master/:masterId/support', verifyJWT, supportMasterIssue);

// Authenticated locality feed
router.get('/feed/locality', verifyJWT, getLocalityFeed);

// Nearby issues for verification
router.get('/nearby/verify', verifyJWT, getNearbyIssues);

// Chat history & messages (Phase 8 & 11)
import { getChatHistory, postChatMessage } from './chat.controller';
router.get('/:issueId/chat', verifyJWT, getChatHistory);
router.post('/:issueId/chat', verifyJWT, postChatMessage);

export default router;
