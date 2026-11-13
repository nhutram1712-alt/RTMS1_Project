import { Router } from 'express';
import {
  getInvoices,
  getMyInvoices,
  createInvoice,
  exportInvoice,
  markInvoicePaid
} from '../controllers/invoice.controller';
import { authMiddleware, roleMiddleware } from '../middlewares/auth.middleware';
import { Role } from '@prisma/client';

const router = Router();

router.get('/', authMiddleware, roleMiddleware(Role.LANDLORD), getInvoices);
router.get('/my-invoices', authMiddleware, roleMiddleware(Role.TENANT), getMyInvoices);
router.post('/', authMiddleware, roleMiddleware(Role.LANDLORD), createInvoice);
router.patch('/:id/pay', authMiddleware, roleMiddleware(Role.LANDLORD), markInvoicePaid);
router.post('/export', authMiddleware, roleMiddleware(Role.LANDLORD), exportInvoice);

export default router;

