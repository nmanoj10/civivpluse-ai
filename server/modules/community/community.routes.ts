import { Router } from 'express';
import { voteOnIssue, getPendingIssues } from './community.controller';
import { verifyJWT } from '../../middleware/auth.middleware';
import { body, validationResult } from 'express-validator';
import { VOTE_TYPES } from '../../config/constants';

const router = Router();

const validateRequest = (req: any, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

router.post(
  '/:issueId/vote',
  verifyJWT,
  [
    body('voteType').isIn(Object.values(VOTE_TYPES)).withMessage('Invalid vote type')
  ],
  validateRequest,
  voteOnIssue
);

router.get('/pending', verifyJWT, getPendingIssues);

export default router;
