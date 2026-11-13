import { Router } from 'express';
import {
  login,
  forgotPassword,
  resetPassword,
  changePassword,
  getLandlordProfile,
  updateLandlordProfile
} from '../controllers/auth.controller';
import { authMiddleware, roleMiddleware } from '../middlewares/auth.middleware';
import { Role } from '@prisma/client';

const router = Router();

// Public auth routes
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Protected routes
router.post('/change-password', authMiddleware, changePassword);

// Landlord Profile
router.get('/profile/landlord', authMiddleware, getLandlordProfile);
router.put('/profile/landlord', authMiddleware, roleMiddleware(Role.LANDLORD), updateLandlordProfile);

export default router;

