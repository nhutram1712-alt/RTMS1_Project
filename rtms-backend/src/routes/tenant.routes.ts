import { Router } from 'express';
import { getTenants, resetTenantPassword } from '../controllers/tenant.controller';
import { authMiddleware, roleMiddleware } from '../middlewares/auth.middleware';
import { Role } from '@prisma/client';

const router = Router();

router.get('/', authMiddleware, roleMiddleware(Role.LANDLORD), getTenants);
router.post('/:id/reset-password', authMiddleware, roleMiddleware(Role.LANDLORD), resetTenantPassword);

export default router;

