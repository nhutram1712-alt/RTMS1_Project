import { Request, Response } from 'express';
import prisma from '../config/db';
import { RoomStatus } from '@prisma/client';

export const getRooms = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status } = req.query;

    let whereClause: any = {};
    if (status && status !== 'ALL') {
      if (status === 'Đang thuê') whereClause.status = RoomStatus.DANG_THUE;
      else if (status === 'Trống') whereClause.status = RoomStatus.TRONG;
      else if (status === 'Đã cọc') whereClause.status = RoomStatus.DA_COC;
      else if (status === 'Sửa chữa') whereClause.status = RoomStatus.SUA_CHUA;
    }

    const rooms = await prisma.room.findMany({
      where: whereClause,
      include: {
        invoices: {
          where: { status: 'CHUA_THANH_TOAN' },
          orderBy: { dueDate: 'asc' }
        },
        contracts: {
          where: { status: 'HIEU_LUC' }
        }
      },
      orderBy: { id: 'asc' }
    });

    const now = new Date();

    const formattedRooms = rooms.map((room) => {
      // Calculate unpaid invoices and overdue days
      const unpaidInvoices = room.invoices;
      const unpaidCount = unpaidInvoices.length;
      let overdueDays = 0;

      if (unpaidCount > 0) {
        const oldestDue = unpaidInvoices[0].dueDate;
        const diffTime = now.getTime() - new Date(oldestDue).getTime();
        if (diffTime > 0) {
          overdueDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        }
      }

      // Map status enum to Vietnamese string
      let statusVi = 'Trống';
      if (room.status === RoomStatus.DANG_THUE) statusVi = 'Đang thuê';
      else if (room.status === RoomStatus.DA_COC) statusVi = 'Đã cọc';
      else if (room.status === RoomStatus.SUA_CHUA) statusVi = 'Sửa chữa';

      return {
        id: room.id,
        name: room.name,
        floor: room.floor,
        area: room.area,
        price: room.price,
        status: statusVi,
        tenantName: room.tenantName,
        depositTenantName: room.depositTenantName,
        depositTenantPhone: room.depositTenantPhone,
        depositTenantAmount: room.depositTenantAmount,
        repairContent: room.repairContent,
        repairTargetDate: room.repairTargetDate ? room.repairTargetDate.toISOString().split('T')[0] : null,
        repairNote: room.repairNote,
        unpaidInvoicesCount: unpaidCount,
        overdueDays: overdueDays > 0 ? overdueDays : undefined
      };
    });

    res.status(200).json({
      success: true,
      data: formattedRooms
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createRoom = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, name, floor, area, price, status } = req.body;

    if (!id || !name || !floor || !area || !price) {
      res.status(400).json({
        success: false,
        message: 'Vui lòng điền đầy đủ: Mã phòng, Tên phòng, Tầng, Diện tích và Giá thuê.'
      });
      return;
    }

    const existing = await prisma.room.findUnique({ where: { id: id.trim() } });
    if (existing) {
      res.status(400).json({
        success: false,
        message: `Mã phòng ${id} đã tồn tại trong hệ thống.`
      });
      return;
    }

    const room = await prisma.room.create({
      data: {
        id: id.trim(),
        name: name.trim(),
        floor: parseInt(floor),
        area: parseFloat(area),
        price: parseInt(price),
        status: status === 'Sửa chữa' ? RoomStatus.SUA_CHUA : RoomStatus.TRONG
      }
    });

    res.status(201).json({
      success: true,
      message: 'Thêm phòng mới thành công!',
      data: room
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateRoom = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      name,
      floor,
      area,
      price,
      status,
      tenantName,
      depositTenantName,
      depositTenantPhone,
      depositTenantAmount,
      repairContent,
      repairTargetDate,
      repairNote
    } = req.body;

    let roomStatus: RoomStatus = RoomStatus.TRONG;
    if (status === 'Đang thuê') roomStatus = RoomStatus.DANG_THUE;
    else if (status === 'Đã cọc') roomStatus = RoomStatus.DA_COC;
    else if (status === 'Sửa chữa') roomStatus = RoomStatus.SUA_CHUA;

    const updated = await prisma.room.update({
      where: { id },
      data: {
        name,
        floor: floor !== undefined ? parseInt(floor) : undefined,
        area: area !== undefined ? parseFloat(area) : undefined,
        price: price !== undefined ? parseInt(price) : undefined,
        status: roomStatus,
        tenantName,
        depositTenantName,
        depositTenantPhone,
        depositTenantAmount: depositTenantAmount !== undefined ? parseInt(depositTenantAmount) : undefined,
        repairContent,
        repairTargetDate: repairTargetDate ? new Date(repairTargetDate) : undefined,
        repairNote
      }
    });

    res.status(200).json({
      success: true,
      message: 'Cập nhật thông tin phòng thành công!',
      data: updated
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const finishRepair = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const room = await prisma.room.update({
      where: { id },
      data: {
        status: RoomStatus.TRONG,
        repairContent: null,
        repairTargetDate: null,
        repairNote: null
      }
    });

    res.status(200).json({
      success: true,
      message: `Đã hoàn thành sửa chữa phòng ${room.name}. Phòng đã chuyển về trạng thái 'Trống'!`,
      data: room
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

