import { Router } from 'express';
import { officerSubmitResolution, citizenConfirmResolution } from './resolution.controller';
import { verifyJWT } from '../../middleware/auth.middleware';
import { authorizeRoles } from '../../middleware/role.middleware';
import { USER_ROLES, FEEDBACK_TYPES } from '../../config/constants';
import { body, validationResult } from 'express-validator';
import { uploadMiddleware } from '../../middleware/upload.middleware';

const router = Router();

const validateRequest = (req: any, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

// Officer routes
router.post(
  '/:issueId/submit',
  verifyJWT,
  authorizeRoles(USER_ROLES.WARD_OFFICER, USER_ROLES.ADMIN),
  uploadMiddleware.fields([
    { name: 'beforeMedia', maxCount: 3 },
    { name: 'afterMedia', maxCount: 3 }
  ]),
  [
    body('workSummary').notEmpty().withMessage('Work summary is required')
  ],
  validateRequest,
  officerSubmitResolution
);

// Citizen routes
router.post(
  '/:issueId/feedback',
  verifyJWT,
  [
    body('feedbackType').isIn(Object.values(FEEDBACK_TYPES)).withMessage('Invalid feedback type')
  ],
  validateRequest,
  citizenConfirmResolution
);

export default router;
