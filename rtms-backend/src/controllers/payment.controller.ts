import { Request, Response } from 'express';
import { randomBytes } from 'crypto';
import prisma from '../config/db';
import { InvoiceStatus, PaymentStatus } from '@prisma/client';
import { getIO } from '../config/socket';

export const getPayments = async (req: Request, res: Response): Promise<void> => {
  try {
    const payments = await prisma.payment.findMany({
      include: {
        invoice: {
          include: { room: true }
        }
      },
      orderBy: { date: 'desc' }
    });

    const formatted = payments.map(p => {
      const d = new Date(p.date);
      const formattedDate = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;

      let statusVi = 'Đã thanh toán';
      if (p.status === PaymentStatus.CHO_THANH_TOAN) statusVi = 'Chờ thanh toán';
      else if (p.status === PaymentStatus.DA_DUYET) statusVi = 'Đã duyệt';

      return {
        id: p.id,
        invId: p.invId,
        date: formattedDate,
        amount: p.amount,
        method: p.method,
        refNo: p.refNo,
        status: statusVi,
        roomName: p.invoice?.room?.name
      };
    });

    res.status(200).json({ success: true, data: formatted });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const submitPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { invId, method, refNo } = req.body;

    if (!invId) {
      res.status(400).json({ success: false, message: 'Vui lòng cung cấp mã hóa đơn.' });
      return;
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: invId }
    });

    if (!invoice) {
      res.status(404).json({ success: false, message: 'Hóa đơn không tồn tại.' });
      return;
    }

    if (req.user?.role !== 'TENANT' || (invoice.roomId !== req.user.roomId && invoice.tenantId !== req.user.userId)) {
      res.status(403).json({ success: false, message: 'Hóa đơn không thuộc tài khoản khách thuê này.' });
      return;
    }

    const paymentId = `GD${Date.now()}${randomBytes(4).toString('hex').toUpperCase()}`;

    const result = await prisma.$transaction(async (tx) => {
      const currentInvoice = await tx.invoice.findUnique({ where: { id: invId } });
      if (!currentInvoice) throw new Error('Hóa đơn không còn tồn tại.');
      if (currentInvoice.status === InvoiceStatus.DA_THANH_TOAN) {
        const existingPayment = await tx.payment.findFirst({ where: { invId }, orderBy: { date: 'desc' } });
        const payment = existingPayment || await tx.payment.create({
          data: { id: paymentId, invId, amount: currentInvoice.total, method: method || 'VietQR MBBank', refNo: refNo || `FT${Date.now()}`, status: PaymentStatus.DA_THANH_TOAN }
        });
        return {
          updatedInvoice: currentInvoice,
          payment
        };
      }
      const claimed = await tx.invoice.updateMany({
        where: { id: invId, status: InvoiceStatus.CHUA_THANH_TOAN },
        data: { status: InvoiceStatus.DA_THANH_TOAN }
      });
      if (claimed.count === 0) {
        const latest = await tx.invoice.findUniqueOrThrow({ where: { id: invId } });
        const existingPayment = await tx.payment.findFirst({ where: { invId }, orderBy: { date: 'desc' } });
        const payment = existingPayment || await tx.payment.create({
          data: { id: paymentId, invId, amount: latest.total, method: method || 'VietQR MBBank', refNo: refNo || `FT${Date.now()}`, status: PaymentStatus.DA_THANH_TOAN }
        });
        return {
          updatedInvoice: latest,
          payment
        };
      }
      const updatedInvoice = await tx.invoice.findUniqueOrThrow({ where: { id: invId } });

      // 2. Create Payment record
      const payment = await tx.payment.create({
        data: {
          id: paymentId,
          invId,
          date: new Date(),
          amount: invoice.total,
          method: method || 'VietQR MBBank',
          refNo: refNo || `FT${Date.now().toString().slice(-10)}`,
          status: PaymentStatus.DA_THANH_TOAN
        }
      });

      return { updatedInvoice, payment };
    });

    // Notify landlord real-time via Socket.IO
    try {
      const io = getIO();
      if (result.payment) io.emit('payment_received', {
        invId: result.updatedInvoice.id,
        paymentId: result.payment.id,
        amount: result.payment.amount,
        roomId: result.updatedInvoice.roomId
      });
    } catch (e) {
      // socket might be off in tests
    }

    res.status(200).json({
      success: true,
      message: `Xác nhận thanh toán hóa đơn ${invId} thành công! Giao dịch ${result.payment?.id || paymentId} đã được ghi nhận.`,
      data: result
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const vietqrWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    // Standard bank webhook structure (Casso / SeAPay / MBBank)
    const { content, description, amount, referenceCode, transId } = req.body;
    const paymentContent = (content || description || '').toUpperCase();

    // Look for pattern: RTMS HD0001 P101
    const match = paymentContent.match(/RTMS\s+(HD\d+)\s+P(\d+)/i);
    if (!match) {
      res.status(200).json({
        success: false,
        message: 'Không tìm thấy cú pháp RTMS trong nội dung chuyển khoản.'
      });
      return;
    }

    const invId = match[1].toUpperCase();

    const invoice = await prisma.invoice.findUnique({
      where: { id: invId }
    });

    if (!invoice) {
      res.status(404).json({ success: false, message: `Không tìm thấy hóa đơn ${invId}` });
      return;
    }

    if (invoice.status === InvoiceStatus.DA_THANH_TOAN) {
      res.status(200).json({ success: true, message: `Hóa đơn ${invId} đã được gạch nợ trước đó.` });
      return;
    }

    const paymentId = `GD${Math.floor(10000 + Math.random() * 90000)}`;

    await prisma.$transaction(async (tx) => {
      await tx.invoice.update({
        where: { id: invId },
        data: { status: InvoiceStatus.DA_THANH_TOAN }
      });

      await tx.payment.create({
        data: {
          id: paymentId,
          invId,
          date: new Date(),
          amount: parseInt(amount || invoice.total),
          method: 'Auto VietQR Webhook',
          refNo: referenceCode || transId || `AUTO_${Date.now()}`,
          status: PaymentStatus.DA_DUYET
        }
      });
    });

    // Notify realtime
    try {
      const io = getIO();
      io.emit('payment_received', {
        invId,
        paymentId,
        amount: invoice.total,
        roomId: invoice.roomId
      });
    } catch (e) {}

    res.status(200).json({
      success: true,
      message: `Gạch nợ tự động thành công cho hóa đơn ${invId}!`
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

