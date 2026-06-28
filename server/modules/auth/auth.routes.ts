import { Router } from 'express';
import { register, login, getProfile } from './auth.controller';
import { verifyJWT } from '../../middleware/auth.middleware';
import { body, validationResult } from 'express-validator';

const router = Router();

// Simple validation middleware (could extract to separate file)
const validateRequest = (req: any, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

router.post(
  '/register',
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
  ],
  validateRequest,
  register
);

router.post(
  '/login',
  [
    body('email').isEmail(),
    body('password').notEmpty()
  ],
  validateRequest,
  login
);

router.get('/profile', verifyJWT, getProfile);

export default router;
