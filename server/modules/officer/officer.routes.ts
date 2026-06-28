import { Router } from 'express';
import { getMyAssignedIssues, updateIssueStatus, getIssueDetailsForOfficer } from './officer.controller';
import { verifyJWT } from '../../middleware/auth.middleware';
import { authorizeRoles } from '../../middleware/role.middleware';
import { USER_ROLES } from '../../config/constants';

const router = Router();

// Protect all officer routes
router.use(verifyJWT);
router.use(authorizeRoles(USER_ROLES.WARD_OFFICER, USER_ROLES.ADMIN));

router.get('/issues', getMyAssignedIssues);
router.get('/issues/:issueId', getIssueDetailsForOfficer);
router.patch('/issues/:issueId/status', updateIssueStatus);

export default router;
