import { Router } from 'express';
import {
  getIssues,
  createIssue,
  processIssue
} from '../controllers/issue.controller';
import { authMiddleware, roleMiddleware } from '../middlewares/auth.middleware';
import { Role } from '@prisma/client';
import { upload } from '../middlewares/upload.middleware';

const router = Router();

router.get('/', authMiddleware, getIssues);
router.post('/', authMiddleware, upload.single('hinh_anh'), createIssue);
router.patch('/:id/process', authMiddleware, roleMiddleware(Role.LANDLORD), processIssue);

export default router;

