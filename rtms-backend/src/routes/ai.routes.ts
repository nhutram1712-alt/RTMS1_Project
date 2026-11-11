import { Router } from 'express';
import { scanCccd, scanMeter } from '../controllers/ai.controller';
import { authMiddleware, roleMiddleware } from '../middlewares/auth.middleware';
import { Role } from '@prisma/client';

const router = Router();

// Endpoint for scanning CCCD (Allow both authenticated requests or direct frontend scan requests)
router.post('/scan-cccd', scanCccd);
router.post('/scan-meter', scanMeter);

export default router;
