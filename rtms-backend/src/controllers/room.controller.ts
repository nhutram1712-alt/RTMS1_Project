import { Request, Response } from 'express';
import prisma from '../config/db';
import { RoomStatus } from '@prisma/client';
import { toRoomStatus, toRoomStatusApiValue, toRoomStatusLabel } from '../utils/room-status';

const formatRoom = (room: any) => ({
  ...room,
  status: toRoomStatusLabel(room.status),
  statusCode: toRoomStatusApiValue(room.status),
  repairTargetDate: room.repairTargetDate?.toISOString().split('T')[0] ?? null,
  expectedMoveInDate: room.expectedMoveInDate?.toISOString().split('T')[0] ?? null
});

export const getRooms = async (req: Request, res: Response): Promise<void> => {
  try {
    const requestedStatus = req.query.status;
    const where: { status?: RoomStatus } = {};
    if (typeof requestedStatus === 'string' && requestedStatus !== 'ALL') {
      const parsedStatus = toRoomStatus(requestedStatus);
      if (!parsedStatus) {
        res.status(400).json({ success: false, message: 'Tr\u1ea1ng th\u00e1i ph\u00f2ng kh\u00f4ng h\u1ee3p l\u1ec7.' });
        return;
      }
      where.status = parsedStatus;
    }

    const rooms = await prisma.room.findMany({
      where,
      include: {
        invoices: { where: { status: 'CHUA_THANH_TOAN' }, orderBy: { dueDate: 'asc' } },
        contracts: { where: { status: 'HIEU_LUC' } }
      },
      orderBy: { id: 'asc' }
    });
    const expectedDates = await prisma.$queryRaw<Array<{ id: string; expectedMoveInDate: Date }>>`
      SELECT id, expected_move_in_date AS "expectedMoveInDate"
      FROM rooms
      WHERE expected_move_in_date IS NOT NULL
    `;
    const expectedDateByRoom = new Map(expectedDates.map(({ id, expectedMoveInDate }) => [id, expectedMoveInDate]));

    const now = Date.now();
    const data = rooms.map((room) => {
      const unpaidInvoices = room.invoices;
      const oldestDue = unpaidInvoices[0]?.dueDate;
      const overdueDays = oldestDue && now > oldestDue.getTime()
        ? Math.floor((now - oldestDue.getTime()) / 86400000)
        : 0;
      return {
        ...formatRoom({ ...room, expectedMoveInDate: expectedDateByRoom.get(room.id) ?? null }),
        unpaidInvoicesCount: unpaidInvoices.length,
        overdueDays: overdueDays > 0 ? overdueDays : undefined
      };
    });

    res.status(200).json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createRoom = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, name, floor, area, price, status, tenantName, depositTenantName, depositTenantPhone,
      depositTenantAmount, expectedMoveInDate, repairContent, repairTargetDate, repairNote } = req.body;
    if (!id || !name || !floor || !area || !price) {
      res.status(400).json({ success: false, message: 'Vui l\u00f2ng nh\u1eadp \u0111\u1ee7 th\u00f4ng tin ph\u00f2ng.' });
      return;
    }

    const roomStatus = status ? toRoomStatus(status) : RoomStatus.TRONG;
    if (!roomStatus) {
      res.status(400).json({ success: false, message: 'Tr\u1ea1ng th\u00e1i ph\u00f2ng kh\u00f4ng h\u1ee3p l\u1ec7.' });
      return;
    }

    const moveInDate = roomStatus === RoomStatus.DA_COC && expectedMoveInDate ? new Date(expectedMoveInDate) : null;
    const room = await prisma.$transaction(async (tx) => {
      const created = await tx.room.create({
        data: {
        id: String(id).trim(), name: String(name).trim(), floor: Number.parseInt(floor, 10),
        area: Number.parseFloat(area), price: Number.parseInt(price, 10), status: roomStatus,
        tenantName: tenantName || null,
        depositTenantName: roomStatus === RoomStatus.DA_COC ? depositTenantName || null : null,
        depositTenantPhone: roomStatus === RoomStatus.DA_COC ? depositTenantPhone || null : null,
        depositTenantAmount: roomStatus === RoomStatus.DA_COC && depositTenantAmount !== '' && depositTenantAmount != null
          ? Number.parseInt(depositTenantAmount, 10) : null,
        repairContent: roomStatus === RoomStatus.SUA_CHUA ? repairContent || null : null,
        repairTargetDate: roomStatus === RoomStatus.SUA_CHUA && repairTargetDate ? new Date(repairTargetDate) : null,
        repairNote: roomStatus === RoomStatus.SUA_CHUA ? repairNote || null : null
        }
      });
      await tx.$executeRaw`UPDATE rooms SET expected_move_in_date = ${moveInDate} WHERE id = ${created.id}`;
      return { ...created, expectedMoveInDate: moveInDate };
    });

    res.status(201).json({ success: true, data: formatRoom(room) });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateRoom = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, floor, area, price, status, tenantName, depositTenantName, depositTenantPhone,
      depositTenantAmount, expectedMoveInDate, repairContent, repairTargetDate, repairNote } = req.body;
    const roomStatus = status === undefined ? undefined : toRoomStatus(status);
    if (status !== undefined && !roomStatus) {
      res.status(400).json({ success: false, message: 'Tr\u1ea1ng th\u00e1i ph\u00f2ng kh\u00f4ng h\u1ee3p l\u1ec7.' });
      return;
    }

    const clearTenant = roomStatus === RoomStatus.TRONG || roomStatus === RoomStatus.DA_COC || roomStatus === RoomStatus.SUA_CHUA;
    const clearDeposit = roomStatus !== undefined && roomStatus !== RoomStatus.DA_COC;
    const clearRepair = roomStatus !== undefined && roomStatus !== RoomStatus.SUA_CHUA;
    const data: any = {
      name: name === undefined ? undefined : String(name).trim(),
      floor: floor === undefined ? undefined : Number.parseInt(floor, 10),
      area: area === undefined ? undefined : Number.parseFloat(area),
      price: price === undefined ? undefined : Number.parseInt(price, 10),
      status: roomStatus,
      tenantName: clearTenant ? null : tenantName,
      depositTenantName: clearDeposit ? null : depositTenantName,
      depositTenantPhone: clearDeposit ? null : depositTenantPhone,
      depositTenantAmount: clearDeposit ? null : depositTenantAmount === '' ? null : depositTenantAmount === undefined ? undefined : Number.parseInt(depositTenantAmount, 10),
      repairContent: clearRepair ? null : repairContent,
      repairTargetDate: clearRepair ? null : repairTargetDate === '' ? null : repairTargetDate === undefined ? undefined : new Date(repairTargetDate),
      repairNote: clearRepair ? null : repairNote
    };

    const requestedMoveInDate = clearDeposit ? null : expectedMoveInDate === '' ? null : expectedMoveInDate === undefined ? undefined : new Date(expectedMoveInDate);
    const room = await prisma.$transaction(async (tx) => {
      const updated = await tx.room.update({ where: { id }, data });
      if (requestedMoveInDate !== undefined) {
        await tx.$executeRaw`UPDATE rooms SET expected_move_in_date = ${requestedMoveInDate} WHERE id = ${id}`;
      }
      const dates = await tx.$queryRaw<Array<{ expectedMoveInDate: Date | null }>>`
        SELECT expected_move_in_date AS "expectedMoveInDate" FROM rooms WHERE id = ${id}
      `;
      return { ...updated, expectedMoveInDate: dates[0]?.expectedMoveInDate ?? null };
    });
    res.status(200).json({ success: true, data: formatRoom(room) });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const finishRepair = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const room = await prisma.$transaction(async (tx) => {
      const updated = await tx.room.update({
        where: { id },
        data: {
          status: RoomStatus.TRONG,
          tenantName: null,
          repairContent: null,
          repairTargetDate: null,
          repairNote: null
        }
      });
      await tx.$executeRaw`UPDATE rooms SET expected_move_in_date = NULL WHERE id = ${id}`;
      return { ...updated, expectedMoveInDate: null };
    });
    res.status(200).json({ success: true, data: formatRoom(room) });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
