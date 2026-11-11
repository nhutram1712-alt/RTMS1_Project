import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../config/db';
import { UserStatus, Role } from '@prisma/client';

export const getTenants = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status } = req.query;

    let whereClause: any = { role: Role.TENANT };

    if (status && status !== 'ALL') {
      if (status === 'Đã Cấp TK' || status === 'Hoạt động') {
        whereClause.status = UserStatus.HOAT_DONG;
      } else if (status === 'Đã trả phòng (Khoá)') {
        whereClause.status = UserStatus.DA_TRA_PHONG_KHOA;
      }
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      include: {
        room: true
      },
      orderBy: { createdAt: 'desc' }
    });

    const formatted = users.map(u => ({
      id: u.id,
      name: u.name,
      cccd: u.cccd,
      phone: u.phone,
      email: u.email,
      username: u.username,
      hasAccount: true,
      status: u.status === UserStatus.HOAT_DONG ? 'Hoạt động' : 'Đã trả phòng (Khoá)',
      roomId: u.roomId,
      roomName: u.room ? u.room.name : (u.roomId ? `Phòng ${u.roomId}` : 'Chưa xếp phòng')
    }));

    res.status(200).json({
      success: true,
      data: formatted
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const resetTenantPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const defaultPasswordHash = await bcrypt.hash('123456', 10);

    const updated = await prisma.user.update({
      where: { id },
      data: { passwordHash: defaultPasswordHash }
    });

    res.status(200).json({
      success: true,
      message: `Đã khôi phục mật khẩu tài khoản ${updated.username} về mật khẩu mặc định: 123456`
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

