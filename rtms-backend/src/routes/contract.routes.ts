import { Router } from 'express';
import {
  getContracts,
  getMyContract,
  createContract,
  requestRenew,
  approveRenew
} from '../controllers/contract.controller';
import { authMiddleware, roleMiddleware } from '../middlewares/auth.middleware';
import { Role } from '@prisma/client';

const router = Router();

router.get('/', authMiddleware, roleMiddleware(Role.LANDLORD), getContracts);
router.get('/my-contract', authMiddleware, roleMiddleware(Role.TENANT), getMyContract);
router.post('/', authMiddleware, roleMiddleware(Role.LANDLORD), createContract);
router.post('/:id/renew-request', authMiddleware, roleMiddleware(Role.TENANT), requestRenew);
router.post('/:id/approve-renew', authMiddleware, roleMiddleware(Role.LANDLORD), approveRenew);

export default router;

