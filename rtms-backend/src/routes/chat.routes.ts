import { Router } from 'express';
import { getChatRooms, getMessagesByRoom } from '../controllers/chat.controller';
import { authMiddleware, roleMiddleware } from '../middlewares/auth.middleware';
import { Role } from '@prisma/client';

const router = Router();

router.get('/rooms', authMiddleware, roleMiddleware(Role.LANDLORD), getChatRooms);
router.get('/messages/:roomId', authMiddleware, getMessagesByRoom);

export default router;

