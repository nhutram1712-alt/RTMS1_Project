import { randomBytes } from 'crypto';
import { Request, Response } from 'express';
import prisma from '../config/db';
import { InvoiceStatus, PaymentStatus, UserStatus } from '@prisma/client';

const invoiceRelations = {
  room: true,
  tenant: { select: { id: true, username: true, name: true, email: true, roomId: true } },
  contract: { select: { id: true, roomId: true, roomPrice: true, tenantName: true, tenantPhone: true, tenantEmail: true, services: true, customPrices: true } }
} as const;

const toInvoiceResponse = (invoice: any) => ({
  ...invoice,
  date: invoice.date.toISOString().slice(0, 10),
  dueDate: invoice.dueDate.toISOString().slice(0, 10),
  total: Number(invoice.total),
  elecOld: Number(invoice.elecOld),
  elecNew: Number(invoice.elecNew),
  roomNumber: invoice.room?.name || invoice.roomId,
  tenantId: invoice.tenantId || invoice.tenant?.id || null,
  status: invoice.status === InvoiceStatus.DA_THANH_TOAN ? 'Đã thanh toán' : 'Chưa thanh toán',
  statusCode: invoice.status
});

const parseAmount = (value: unknown, label: string): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${label} không hợp lệ.`);
  return parsed;
};

const parseDate = (value: unknown, label: string): Date => {
  const parsed = new Date(String(value || ''));
  if (!value || Number.isNaN(parsed.getTime())) throw new Error(`${label} không hợp lệ.`);
  return parsed;
};

const makePaymentId = () => `GD${Date.now()}${randomBytes(4).toString('hex').toUpperCase()}`;

export const getInvoices = async (_req: Request, res: Response): Promise<void> => {
  try {
    const invoices = await prisma.invoice.findMany({
      include: invoiceRelations,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
    });
    res.status(200).json({ success: true, data: invoices.map(toInvoiceResponse) });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMyInvoices = async (req: Request, res: Response): Promise<void> => {
  try {
    const roomId = req.user?.roomId;
    const invoices = await prisma.invoice.findMany({
      where: roomId ? { OR: [{ roomId }, { tenantId: req.user?.userId }] } : { tenantId: req.user?.userId },
      include: invoiceRelations,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
    });
    res.status(200).json({ success: true, data: invoices.map(toInvoiceResponse) });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createInvoice = async (req: Request, res: Response): Promise<void> => {
  try {
    const { roomId, period, dueDate, date, elecOld, elecNew, surcharge, surchargeReason } = req.body;
    if (!roomId || !period || !dueDate || elecOld === undefined || elecNew === undefined) {
      res.status(400).json({ success: false, message: 'Vui lòng nhập phòng, kỳ thanh toán, hạn nộp và chỉ số điện.' });
      return;
    }

    const eOld = parseAmount(elecOld, 'Chỉ số điện cũ');
    const eNew = parseAmount(elecNew, 'Chỉ số điện mới');
    if (eNew < eOld) {
      res.status(400).json({ success: false, message: 'Chỉ số điện mới không được nhỏ hơn chỉ số cũ.' });
      return;
    }
    const due = parseDate(dueDate, 'Hạn thanh toán');
    const invoiceDate = date ? parseDate(date, 'Ngày lập') : new Date();
    const room = await prisma.room.findUnique({ where: { id: String(roomId).trim() } });
    if (!room) {
      res.status(404).json({ success: false, message: 'Không tìm thấy phòng.' });
      return;
    }

    const contract = await prisma.contract.findFirst({
      where: { roomId: room.id, status: 'HIEU_LUC' },
      orderBy: { createdAt: 'desc' }
    });
    const existingInvoice = await prisma.invoice.findFirst({ where: { roomId: room.id, period: String(period).trim() } });
    if (existingInvoice) {
      res.status(409).json({ success: false, message: 'Phòng này đã có hóa đơn cho kỳ thanh toán đã chọn.' });
      return;
    }
    const tenant = await prisma.user.findFirst({
      where: {
        role: 'TENANT',
        status: UserStatus.HOAT_DONG,
        OR: [
          { roomId: room.id },
          ...(contract?.tenantEmail ? [{ email: { equals: contract.tenantEmail, mode: 'insensitive' as const } }] : [])
        ]
      },
      orderBy: { updatedAt: 'desc' }
    });

    const customPrices = contract?.customPrices && typeof contract.customPrices === 'object'
      ? contract.customPrices as Record<string, unknown>
      : {};
    const readPrice = (key: string, fallback: number) => {
      const configured = Number(customPrices[key]);
      return Number.isFinite(configured) && configured >= 0 ? configured : fallback;
    };
    const roomCharge = contract?.roomPrice ?? room.price;
    const contractServices = Array.isArray(contract?.services) ? contract.services as string[] : null;
    const hasService = (id: string) => !contractServices || contractServices.includes(id);
    const electricityPrice = readPrice('SV01', 3500);
    const waterPrice = hasService('SV02') ? readPrice('SV02', 80000) : 0;
    const trashPrice = hasService('SV03') ? readPrice('SV03', 30000) : 0;
    const wifiPrice = hasService('SV04') ? readPrice('SV04', 100000) : 0;
    const extraCharge = parseAmount(surcharge ?? 0, 'Phụ phí');
    const lineItems = [
      { code: 'ROOM', name: 'Tiền thuê phòng', quantity: 1, unit: 'tháng', unitPrice: roomCharge, amount: roomCharge },
      { code: 'ELECTRICITY', name: 'Tiền điện', quantity: eNew - eOld, unit: 'kWh', unitPrice: electricityPrice, oldReading: eOld, newReading: eNew, amount: Math.round((eNew - eOld) * electricityPrice) },
      ...(hasService('SV02') ? [{ code: 'WATER', name: 'Tiền nước', quantity: 1, unit: 'tháng', unitPrice: waterPrice, amount: waterPrice }] : []),
      ...(hasService('SV03') ? [{ code: 'TRASH', name: 'Rác và vệ sinh', quantity: 1, unit: 'tháng', unitPrice: trashPrice, amount: trashPrice }] : []),
      ...(wifiPrice > 0 ? [{ code: 'WIFI', name: 'Internet Wifi', quantity: 1, unit: 'tháng', unitPrice: wifiPrice, amount: wifiPrice }] : []),
      ...(extraCharge > 0 ? [{ code: 'SURCHARGE', name: String(surchargeReason || 'Phụ phí phát sinh'), quantity: 1, unit: 'lần', unitPrice: extraCharge, amount: extraCharge }] : [])
    ];
    const total = lineItems.reduce((sum, item) => sum + item.amount, 0);
    const id = `HD${Date.now()}${randomBytes(4).toString('hex').toUpperCase()}`;
    const landlordProfile = await prisma.landlordProfile.findFirst();
    const vietqrRef = `RTMS ${id} P${room.id}`;

    const created = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.create({
        data: {
          id,
          roomId: room.id,
          tenantId: tenant?.id,
          contractId: contract?.id,
          period: String(period).trim(),
          date: invoiceDate,
          dueDate: due,
          total,
          status: InvoiceStatus.CHUA_THANH_TOAN,
          elecOld: eOld,
          elecNew: eNew,
          surcharge: Math.round(extraCharge),
          surchargeReason: surchargeReason ? String(surchargeReason).trim() : null,
          lineItems
        },
        include: invoiceRelations
      });
      if (contract) await tx.contract.update({ where: { id: contract.id }, data: { elecOld: eNew } });
      return invoice;
    });

    res.status(201).json({
      success: true,
      message: `Đã lập hóa đơn ${id} cho ${room.name}.`,
      data: {
        ...toInvoiceResponse(created),
        vietqrRef,
        bankInfo: landlordProfile ? {
          bankName: landlordProfile.bankName,
          bankAccount: landlordProfile.bankAccount,
          bankOwner: landlordProfile.bankOwner,
          qrImgUrl: `${landlordProfile.qrImgUrl}&amount=${total}&addInfo=${encodeURIComponent(vietqrRef)}`
        } : null
      }
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || 'Không thể tạo hóa đơn.' });
  }
};

export const markInvoicePaid = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({ where: { id }, include: invoiceRelations });
      if (!invoice) return null;
      if (invoice.status === InvoiceStatus.DA_THANH_TOAN) {
        const existingPayment = await tx.payment.findFirst({ where: { invId: id }, orderBy: { date: 'desc' } });
        const payment = existingPayment || await tx.payment.create({
          data: { id: makePaymentId(), invId: id, amount: invoice.total, method: 'Xác nhận thanh toán tại quầy', refNo: `LANDLORD_${Date.now()}`, status: PaymentStatus.DA_THANH_TOAN }
        });
        return { invoice, payment };
      }
      const claimed = await tx.invoice.updateMany({
        where: { id, status: InvoiceStatus.CHUA_THANH_TOAN },
        data: { status: InvoiceStatus.DA_THANH_TOAN }
      });
      if (claimed.count === 0) {
        const current = await tx.invoice.findUnique({ where: { id }, include: invoiceRelations });
        if (!current) return null;
        const existingPayment = await tx.payment.findFirst({ where: { invId: id }, orderBy: { date: 'desc' } });
        const payment = existingPayment || await tx.payment.create({
          data: { id: makePaymentId(), invId: id, amount: current.total, method: 'Xác nhận thanh toán tại quầy', refNo: `LANDLORD_${Date.now()}`, status: PaymentStatus.DA_THANH_TOAN }
        });
        return { invoice: current, payment };
      }
      const updated = await tx.invoice.findUniqueOrThrow({ where: { id }, include: invoiceRelations });
      const payment = await tx.payment.create({
        data: {
          id: makePaymentId(),
          invId: id,
          amount: invoice.total,
          method: 'Xác nhận thanh toán tại quầy',
          refNo: `LANDLORD_${Date.now()}`,
          status: PaymentStatus.DA_THANH_TOAN
        }
      });
      return { invoice: updated, payment };
    });
    if (!result) {
      res.status(404).json({ success: false, message: 'Không tìm thấy hóa đơn.' });
      return;
    }
    res.status(200).json({ success: true, message: 'Đã xác nhận thanh toán hóa đơn.', data: {
      invoice: toInvoiceResponse(result.invoice),
      payment: result.payment
    } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Keep the previous endpoint as a compatibility alias while clients move to POST /api/invoices.
export const exportInvoice = createInvoice;
