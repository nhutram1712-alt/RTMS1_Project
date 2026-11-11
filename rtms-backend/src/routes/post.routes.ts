import { Router } from 'express';
import {
  getPosts,
  createPost,
  deletePost,
  markPostAsRead
} from '../controllers/post.controller';
import { authMiddleware, roleMiddleware } from '../middlewares/auth.middleware';
import { Role } from '@prisma/client';

const router = Router();

router.get('/', authMiddleware, getPosts);
router.post('/', authMiddleware, roleMiddleware(Role.LANDLORD), createPost);
router.delete('/:id', authMiddleware, roleMiddleware(Role.LANDLORD), deletePost);
router.post('/:id/read', authMiddleware, markPostAsRead);

export default router;

