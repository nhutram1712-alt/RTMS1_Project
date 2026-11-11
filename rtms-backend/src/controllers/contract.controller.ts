import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../config/db';
import { ContractStatus, RenewStatus, RoomStatus, Role, UserStatus } from '@prisma/client';

export const getContracts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status } = req.query;

    let whereClause: any = {};
    if (status && status !== 'ALL') {
      if (status === 'Hiệu lực') whereClause.status = ContractStatus.HIEU_LUC;
      else if (status === 'Sắp hết hạn') whereClause.status = ContractStatus.SAP_HET_HAN;
      else if (status === 'Hết hiệu lực') whereClause.status = ContractStatus.HET_HIEU_LUC;
    }

    const contracts = await prisma.contract.findMany({
      where: whereClause,
      include: { room: true },
      orderBy: { createdAt: 'desc' }
    });

    const formatted = contracts.map(c => {
      let statusVi = 'Hiệu lực';
      if (c.status === ContractStatus.SAP_HET_HAN) statusVi = 'Sắp hết hạn';
      else if (c.status === ContractStatus.HET_HIEU_LUC) statusVi = 'Hết hiệu lực';

      return {
        id: c.id,
        roomId: c.roomId,
        roomPrice: c.roomPrice,
        landlordName: c.landlordName,
        landlordPhone: c.landlordPhone,
        landlordCccd: c.landlordCccd,
        landlordAddress: c.landlordAddress,
        tenantName: c.tenantName,
        tenantPhone: c.tenantPhone,
        tenantCccd: c.tenantCccd,
        tenantEmail: c.tenantEmail,
        startDate: c.startDate.toISOString().split('T')[0],
        duration: c.duration,
        deposit: c.deposit,
        status: statusVi,
        services: c.services,
        customPrices: c.customPrices,
        elecOld: c.elecOld,
        renewStatus: c.renewStatus,
        pendingRenewMonths: c.pendingRenewMonths
      };
    });

    res.status(200).json({ success: true, data: formatted });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMyContract = async (req: Request, res: Response): Promise<void> => {
  try {
    const roomId = req.user?.roomId;
    if (!roomId) {
      res.status(404).json({ success: false, message: 'Bạn chưa được gán vào phòng nào.' });
      return;
    }

    const contract = await prisma.contract.findFirst({
      where: { roomId, status: { in: [ContractStatus.HIEU_LUC, ContractStatus.SAP_HET_HAN] } },
      include: { room: true }
    });

    if (!contract) {
      res.status(404).json({ success: false, message: 'Không tìm thấy hợp đồng cho phòng này.' });
      return;
    }

    res.status(200).json({ success: true, data: contract });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createContract = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      roomId,
      roomPrice,
      landlordName,
      landlordPhone,
      landlordCccd,
      landlordAddress,
      tenantName,
      tenantPhone,
      tenantCccd,
      tenantEmail,
      startDate,
      duration,
      deposit,
      services,
      customPrices,
      elecOld
    } = req.body;

    if (!roomId || !tenantName || !tenantPhone || !tenantCccd || !startDate || !duration) {
      res.status(400).json({
        success: false,
        message: 'Vui lòng điền đầy đủ các thông tin bắt buộc của hợp đồng.'
      });
      return;
    }

    const contractId = `HDT-${roomId}`;

    // 1. Transaction to create contract, update room, and auto-provision tenant account
    const result = await prisma.$transaction(async (tx) => {
      // 1.1 Create or update Contract
      const contract = await tx.contract.upsert({
        where: { id: contractId },
        update: {
          roomPrice: parseInt(roomPrice),
          landlordName: landlordName || 'Lê Kim Chi',
          landlordPhone: landlordPhone || '0912345678',
          landlordCccd: landlordCccd || '001090123456',
          landlordAddress: landlordAddress || 'Số 12, Đường Lê Lợi, TP. Đà Nẵng',
          tenantName: tenantName.trim(),
          tenantPhone: tenantPhone.trim(),
          tenantCccd: tenantCccd.trim(),
          tenantEmail: tenantEmail ? tenantEmail.trim() : null,
          startDate: new Date(startDate),
          duration: parseInt(duration),
          deposit: parseInt(deposit || roomPrice),
          status: ContractStatus.HIEU_LUC,
          services: services || ['SV01', 'SV02', 'SV03'],
          customPrices: customPrices || {},
          elecOld: parseInt(elecOld || 0),
          renewStatus: RenewStatus.NONE,
          pendingRenewMonths: null
        },
        create: {
          id: contractId,
          roomId: roomId.trim(),
          roomPrice: parseInt(roomPrice),
          landlordName: landlordName || 'Lê Kim Chi',
          landlordPhone: landlordPhone || '0912345678',
          landlordCccd: landlordCccd || '001090123456',
          landlordAddress: landlordAddress || 'Số 12, Đường Lê Lợi, TP. Đà Nẵng',
          tenantName: tenantName.trim(),
          tenantPhone: tenantPhone.trim(),
          tenantCccd: tenantCccd.trim(),
          tenantEmail: tenantEmail ? tenantEmail.trim() : null,
          startDate: new Date(startDate),
          duration: parseInt(duration),
          deposit: parseInt(deposit || roomPrice),
          status: ContractStatus.HIEU_LUC,
          services: services || ['SV01', 'SV02', 'SV03'],
          customPrices: customPrices || {},
          elecOld: parseInt(elecOld || 0)
        }
      });

      // 1.2 Update Room status to DANG_THUE
      await tx.room.update({
        where: { id: roomId },
        data: {
          status: RoomStatus.DANG_THUE,
          tenantName: tenantName.trim(),
          depositTenantName: null,
          depositTenantPhone: null,
          depositTenantAmount: null
        }
      });

      // 1.3 Auto generate username: remove Vietnamese diacritics
      const normalizeUsername = (str: string) => {
        return str
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/đ/g, 'd')
          .replace(/Đ/g, 'D')
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '');
      };

      const baseUsername = normalizeUsername(tenantName);
      let finalUsername = baseUsername || `khach_${roomId}`;

      // Check if username exists, if so append roomId
      const existingUser = await tx.user.findUnique({ where: { username: finalUsername } });
      if (existingUser && existingUser.roomId !== roomId) {
        finalUsername = `${finalUsername}${roomId}`;
      }

      const defaultHash = await bcrypt.hash('123456', 10);

      // Upsert Tenant User Account
      const user = await tx.user.upsert({
        where: { username: finalUsername },
        update: {
          name: tenantName.trim(),
          phone: tenantPhone.trim(),
          email: tenantEmail ? tenantEmail.trim() : null,
          cccd: tenantCccd.trim(),
          roomId: roomId.trim(),
          status: UserStatus.HOAT_DONG
        },
        create: {
          username: finalUsername,
          passwordHash: defaultHash,
          role: Role.TENANT,
          name: tenantName.trim(),
          phone: tenantPhone.trim(),
          email: tenantEmail ? tenantEmail.trim() : null,
          cccd: tenantCccd.trim(),
          roomId: roomId.trim(),
          status: UserStatus.HOAT_DONG
        }
      });

      return { contract, user, username: finalUsername };
    });

    res.status(201).json({
      success: true,
      message: `Tạo và phát hành hợp đồng ${contractId} thành công! Đã tự động tạo tài khoản: ${result.username} (Mật khẩu: 123456)`,
      data: result
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const requestRenew = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { months } = req.body;

    if (!months || ![6, 12, 24].includes(parseInt(months))) {
      res.status(400).json({ success: false, message: 'Số tháng gia hạn không hợp lệ (+6, +12 hoặc +24 tháng).' });
      return;
    }

    const updated = await prisma.contract.update({
      where: { id },
      data: {
        renewStatus: RenewStatus.PENDING,
        pendingRenewMonths: parseInt(months)
      }
    });

    res.status(200).json({
      success: true,
      message: `Đã gửi yêu cầu gia hạn thêm ${months} tháng tới Chủ trọ thành công!`,
      data: updated
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const approveRenew = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const contract = await prisma.contract.findUnique({ where: { id } });
    if (!contract || contract.renewStatus !== RenewStatus.PENDING || !contract.pendingRenewMonths) {
      res.status(400).json({ success: false, message: 'Hợp đồng này không có yêu cầu gia hạn chờ duyệt.' });
      return;
    }

    const newDuration = contract.duration + contract.pendingRenewMonths;

    const updated = await prisma.contract.update({
      where: { id },
      data: {
        duration: newDuration,
        renewStatus: RenewStatus.APPROVED,
        pendingRenewMonths: null,
        status: ContractStatus.HIEU_LUC
      }
    });

    res.status(200).json({
      success: true,
      message: `Đã phê duyệt gia hạn hợp đồng ${id}! Thời hạn hợp đồng hiện tại là ${newDuration} tháng.`,
      data: updated
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

