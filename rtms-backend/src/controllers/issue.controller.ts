import { Request, Response } from 'express';
import prisma from '../config/db';
import { IssueStatus } from '@prisma/client';
import { getIO } from '../config/socket';

export const getIssues = async (req: Request, res: Response): Promise<void> => {
  try {
    const userRole = req.user?.role;
    const userRoomId = req.user?.roomId;

    let whereClause: any = {};
    if (userRole === 'TENANT' && userRoomId) {
      whereClause.maPhong = userRoomId;
    }

    const issues = await prisma.issue.findMany({
      where: whereClause,
      include: {
        room: true,
        user: true
      },
      orderBy: { ngayTao: 'desc' }
    });

    const formatted = issues.map(iss => {
      const d = new Date(iss.ngayTao);
      const ngayTaoStr = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;

      return {
        ma_bao_hong: iss.id,
        loai_su_co: iss.loaiSuCo,
        mo_ta: iss.moTa,
        hinh_anh: iss.hinhAnhUrl || '',
        ngay_tao: ngayTaoStr,
        trang_thai: iss.trangThai === IssueStatus.DA_XU_LY ? 'Đã xử lý' : 'Chờ xử lý',
        ma_phong: iss.maPhong,
        ma_nguoi_dung: iss.user ? iss.user.name : (iss.room ? iss.room.tenantName : 'Khách thuê')
      };
    });

    res.status(200).json({ success: true, data: formatted });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createIssue = async (req: Request, res: Response): Promise<void> => {
  try {
    const { loai_su_co, mo_ta, ma_phong, hinh_anh_base64 } = req.body;
    const userId = req.user?.userId;
    const roomId = ma_phong || req.user?.roomId;

    if (!loai_su_co || !mo_ta || !roomId) {
      res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp loại sự cố, mô tả chi tiết và số phòng.'
      });
      return;
    }

    // Auto-generate Issue ID: BH002...
    const count = await prisma.issue.count();
    const issueId = `BH${(count + 1).toString().padStart(3, '0')}`;

    let hinhAnhUrl = '';
    if (req.file) {
      hinhAnhUrl = `/uploads/issues/${req.file.filename}`;
    } else if (hinh_anh_base64) {
      hinhAnhUrl = hinh_anh_base64;
    }

    const issue = await prisma.issue.create({
      data: {
        id: issueId,
        loaiSuCo: loai_su_co.trim(),
        moTa: mo_ta.trim(),
        hinhAnhUrl,
        ngayTao: new Date(),
        trangThai: IssueStatus.CHO_XU_LY,
        maPhong: roomId.trim(),
        maNguoiDung: userId
      },
      include: {
        room: true,
        user: true
      }
    });

    // Notify landlord real-time via Socket.IO
    try {
      const io = getIO();
      io.emit('new_issue_reported', {
        id: issue.id,
        loai_su_co: issue.loaiSuCo,
        mo_ta: issue.moTa,
        ma_phong: issue.maPhong,
        ngay_tao: issue.ngayTao
      });
      io.emit('badge_issue_update', { increment: 1 });
    } catch (e) {}

    res.status(201).json({
      success: true,
      message: `Gửi báo hỏng sự cố ${issueId} thành công! Chủ trọ đã nhận được thông báo.`,
      data: issue
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const processIssue = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const issue = await prisma.issue.update({
      where: { id },
      data: { trangThai: IssueStatus.DA_XU_LY }
    });

    // Update real-time badges
    try {
      const io = getIO();
      io.emit('issue_resolved', { id: issue.id, ma_phong: issue.maPhong });
      io.emit('badge_issue_update', { decrement: 1 });
    } catch (e) {}

    res.status(200).json({
      success: true,
      message: `Đã đánh dấu xử lý hoàn tất sự cố ${id}!`,
      data: issue
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

