import { Router } from 'express';
import {
  getServices,
  createService,
  updateService,
  deleteService
} from '../controllers/service.controller';
import { authMiddleware, roleMiddleware } from '../middlewares/auth.middleware';
import { Role } from '@prisma/client';

const router = Router();

router.get('/', authMiddleware, getServices);
router.post('/', authMiddleware, roleMiddleware(Role.LANDLORD), createService);
router.put('/:id', authMiddleware, roleMiddleware(Role.LANDLORD), updateService);
router.delete('/:id', authMiddleware, roleMiddleware(Role.LANDLORD), deleteService);

export default router;

