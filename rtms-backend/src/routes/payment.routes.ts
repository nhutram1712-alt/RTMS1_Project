import { Router } from 'express';
import {
  getPayments,
  submitPayment,
  vietqrWebhook
} from '../controllers/payment.controller';
import { authMiddleware, roleMiddleware } from '../middlewares/auth.middleware';
import { Role } from '@prisma/client';

const router = Router();

router.get('/', authMiddleware, roleMiddleware(Role.LANDLORD), getPayments);
router.post('/submit', authMiddleware, roleMiddleware(Role.TENANT), submitPayment);
router.post('/webhook-vietqr', vietqrWebhook); // Public webhook for automated bank scraping (Casso / SeAPay)

export default router;

