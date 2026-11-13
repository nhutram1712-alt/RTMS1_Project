import { Request, Response } from 'express';
import prisma from '../config/db';
import { toRoomStatusApiValue, toRoomStatusLabel } from '../utils/room-status';

export const getBootstrap = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [rooms, services, contracts, users, invoices, expectedDates] = await Promise.all([
      prisma.room.findMany({ orderBy: { id: 'asc' } }),
      prisma.service.findMany({ orderBy: { id: 'asc' } }),
      prisma.contract.findMany({ orderBy: { createdAt: 'desc' } }),
      prisma.user.findMany({ where: { role: 'TENANT' }, orderBy: { createdAt: 'desc' } }),
      prisma.invoice.findMany({
        include: {
          room: true,
          tenant: { select: { id: true, username: true, name: true, email: true, roomId: true } },
          contract: { select: { id: true, roomId: true, roomPrice: true, tenantName: true, tenantPhone: true, tenantEmail: true, services: true, customPrices: true } }
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
      }),
      prisma.$queryRaw<Array<{ id: string; expectedMoveInDate: Date | null }>>`
        SELECT id, expected_move_in_date AS "expectedMoveInDate"
        FROM rooms
        WHERE expected_move_in_date IS NOT NULL
      `
    ]);
    const expectedDateByRoom = new Map(expectedDates.map(({ id, expectedMoveInDate }) => [id, expectedMoveInDate]));
    const formattedRooms = rooms.map((room) => ({
      ...room,
      status: toRoomStatusLabel(room.status),
      statusCode: toRoomStatusApiValue(room.status),
      repairTargetDate: room.repairTargetDate?.toISOString().split('T')[0] ?? null,
      expectedMoveInDate: expectedDateByRoom.get(room.id)?.toISOString().split('T')[0] ?? null
    }));
    const formattedInvoices = invoices.map((invoice) => ({
      ...invoice,
      date: invoice.date.toISOString().slice(0, 10),
      dueDate: invoice.dueDate.toISOString().slice(0, 10),
      total: Number(invoice.total),
      elecOld: Number(invoice.elecOld),
      elecNew: Number(invoice.elecNew),
      roomNumber: invoice.room?.name || invoice.roomId,
      tenantId: invoice.tenantId || invoice.tenant?.id || null,
      status: invoice.status === 'DA_THANH_TOAN' ? 'Đã thanh toán' : 'Chưa thanh toán',
      statusCode: invoice.status
    }));
    res.status(200).json({ success: true, data: { rooms: formattedRooms, services, contracts, users: users.map(({passwordHash, resetOtp, resetOtpExpires, ...user}) => user), invoices: formattedInvoices } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
