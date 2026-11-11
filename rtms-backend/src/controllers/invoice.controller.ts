import { Request, Response } from 'express';
import prisma from '../config/db';
import { InvoiceStatus } from '@prisma/client';

export const getInvoices = async (req: Request, res: Response): Promise<void> => {
  try {
    const invoices = await prisma.invoice.findMany({
      include: { room: true },
      orderBy: { createdAt: 'desc' }
    });

    const formatted = invoices.map(inv => ({
      id: inv.id,
      roomId: inv.roomId,
      period: inv.period,
      date: inv.date.toISOString().split('T')[0],
      dueDate: inv.dueDate.toISOString().split('T')[0],
      total: inv.total,
      status: inv.status === InvoiceStatus.DA_THANH_TOAN ? 'Đã thanh toán' : 'Chưa thanh toán',
      elecOld: inv.elecOld,
      elecNew: inv.elecNew,
      surcharge: inv.surcharge,
      surchargeReason: inv.surchargeReason
    }));

    res.status(200).json({ success: true, data: formatted });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMyInvoices = async (req: Request, res: Response): Promise<void> => {
  try {
    const roomId = req.user?.roomId;
    if (!roomId) {
      res.status(404).json({ success: false, message: 'Bạn chưa được gán vào phòng nào.' });
      return;
    }

    const invoices = await prisma.invoice.findMany({
      where: { roomId },
      orderBy: { createdAt: 'desc' }
    });

    const formatted = invoices.map(inv => ({
      id: inv.id,
      roomId: inv.roomId,
      period: inv.period,
      date: inv.date.toISOString().split('T')[0],
      dueDate: inv.dueDate.toISOString().split('T')[0],
      total: inv.total,
      status: inv.status === InvoiceStatus.DA_THANH_TOAN ? 'Đã thanh toán' : 'Chưa thanh toán',
      elecOld: inv.elecOld,
      elecNew: inv.elecNew,
      surcharge: inv.surcharge,
      surchargeReason: inv.surchargeReason
    }));

    res.status(200).json({ success: true, data: formatted });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const exportInvoice = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      roomId,
      period,
      date,
      dueDate,
      elecOld,
      elecNew,
      elecPrice,
      waterPrice,
      trashPrice,
      wifiPrice,
      surcharge,
      surchargeReason
    } = req.body;

    if (!roomId || !period || !dueDate || elecOld === undefined || elecNew === undefined) {
      res.status(400).json({
        success: false,
        message: 'Vui lòng điền đầy đủ các thông tin lập hóa đơn: Phòng, Kỳ thanh toán, Hạn nộp và Chỉ số điện.'
      });
      return;
    }

    // Find Room and Contract to get room price and service rates
    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) {
      res.status(404).json({ success: false, message: 'Không tìm thấy thông tin phòng.' });
      return;
    }

    const contract = await prisma.contract.findFirst({
      where: { roomId, status: 'HIEU_LUC' }
    });

    const baseRoomPrice = contract ? contract.roomPrice : room.price;

    const eOld = parseInt(elecOld);
    const eNew = parseInt(elecNew);
    const ePrice = parseInt(elecPrice || 3500);
    const elecTotal = Math.max(0, eNew - eOld) * ePrice;

    const wPrice = parseInt(waterPrice || 80000);
    const tPrice = parseInt(trashPrice || 30000);
    const wiPrice = parseInt(wifiPrice || 0);
    const sur = parseInt(surcharge || 0);

    const grandTotal = baseRoomPrice + elecTotal + wPrice + tPrice + wiPrice + sur;

    // Auto-generate Invoice ID: e.g. HD0003
    const invoiceCount = await prisma.invoice.count();
    const invId = `HD${(invoiceCount + 1).toString().padStart(4, '0')}`;

    // Get Landlord Profile for VietQR info
    const landlordProfile = await prisma.landlordProfile.findFirst();

    // Create Invoice
    const invoice = await prisma.invoice.create({
      data: {
        id: invId,
        roomId: roomId.trim(),
        period: period.trim(),
        date: date ? new Date(date) : new Date(),
        dueDate: new Date(dueDate),
        total: grandTotal,
        status: InvoiceStatus.CHUA_THANH_TOAN,
        elecOld: eOld,
        elecNew: eNew,
        surcharge: sur,
        surchargeReason: surchargeReason || null
      }
    });

    // Update contract's elecOld
    if (contract) {
      await prisma.contract.update({
        where: { id: contract.id },
        data: { elecOld: eNew }
      });
    }

    // VietQR content reference: RTMS [Mã HD] P[Mã Phong]
    const vietqrRef = `RTMS ${invId} P${roomId}`;

    res.status(201).json({
      success: true,
      message: `Xuất hóa đơn ${invId} cho ${room.name} thành công!`,
      data: {
        ...invoice,
        vietqrRef,
        bankInfo: landlordProfile ? {
          bankName: landlordProfile.bankName,
          bankAccount: landlordProfile.bankAccount,
          bankOwner: landlordProfile.bankOwner,
          qrImgUrl: `${landlordProfile.qrImgUrl}&amount=${grandTotal}&addInfo=${encodeURIComponent(vietqrRef)}`
        } : null
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

