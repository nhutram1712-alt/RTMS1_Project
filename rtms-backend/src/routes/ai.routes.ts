import { Router } from 'express';
import multer from 'multer';
import { scanCccd, scanMeter } from '../controllers/ai.controller';
import { authMiddleware, roleMiddleware } from '../middlewares/auth.middleware';
import { Role } from '@prisma/client';

const router = Router();
const meterUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    callback(null, allowedImageTypes.includes(file.mimetype));
  }
});

// Endpoint for scanning CCCD (Allow both authenticated requests or direct frontend scan requests)
router.post('/scan-cccd', scanCccd);
router.post('/scan-meter', meterUpload.single('meterImage'), scanMeter);

export default router;
