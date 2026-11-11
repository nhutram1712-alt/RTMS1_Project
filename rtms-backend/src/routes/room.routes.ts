import { Router } from 'express';
import {
  getRooms,
  createRoom,
  updateRoom,
  finishRepair
} from '../controllers/room.controller';
import { authMiddleware, roleMiddleware } from '../middlewares/auth.middleware';
import { Role } from '@prisma/client';

const router = Router();

router.get('/', authMiddleware, getRooms);
router.post('/', authMiddleware, roleMiddleware(Role.LANDLORD), createRoom);
router.put('/:id', authMiddleware, roleMiddleware(Role.LANDLORD), updateRoom);
router.patch('/:id/finish-repair', authMiddleware, roleMiddleware(Role.LANDLORD), finishRepair);

export default router;

