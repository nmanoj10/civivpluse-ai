import { Router } from 'express';
import { getReviewQueue, processReview, getEscalationLogs } from './moderation.controller';
import { verifyJWT } from '../../middleware/auth.middleware';
import { authorizeRoles } from '../../middleware/role.middleware';
import { USER_ROLES } from '../../config/constants';

const router = Router();

router.use(verifyJWT);
router.use(authorizeRoles(USER_ROLES.ADMIN));

router.get('/review-queue', getReviewQueue);
router.post('/review/:reviewId', processReview);
router.get('/escalations', getEscalationLogs);

export default router;
