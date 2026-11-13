import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../config/db';
import { JwtPayload } from '../types';
import { randomInt } from 'crypto';
import { sendPasswordResetOtp } from '../services/mail.service';

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password, role } = req.body;

    if (!username || !password) {
      res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp tên đăng nhập và mật khẩu.'
      });
      return;
    }

    const normalizedLogin = String(username).trim().toLowerCase();
    const user = await prisma.user.findFirst({
      where: { OR: [
        { username: { equals: normalizedLogin, mode: 'insensitive' } },
        { email: { equals: normalizedLogin, mode: 'insensitive' } }
      ] },
      include: {
        room: true,
        landlordProfile: true
      }
    });

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Tên đăng nhập hoặc mật khẩu không chính xác.'
      });
      return;
    }

    if (role !== 'LANDLORD' && role !== 'TENANT') {
      res.status(400).json({ success: false, message: 'Vai trò đăng nhập không hợp lệ.' });
      return;
    }
    if (user.role !== role) {
      res.status(401).json({
        success: false,
        message: `Tài khoản này không thuộc vai trò ${role === 'LANDLORD' ? 'Chủ Trọ' : 'Khách Thuê'}.`
      });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({
        success: false,
        message: 'Tên đăng nhập hoặc mật khẩu không chính xác.'
      });
      return;
    }

    if (user.status === 'DA_TRA_PHONG_KHOA') {
      res.status(403).json({
        success: false,
        message: 'Tài khoản của bạn đã bị khóa do đã hoàn tất thủ tục trả phòng.'
      });
      return;
    }

    const payload: JwtPayload = {
      userId: user.id,
      username: user.username,
      role: user.role,
      roomId: user.roomId
    };

    const secret = process.env.JWT_SECRET || 'rtms_jwt_super_secret_production_key_2026_secured';
    const token = jwt.sign(payload, secret, { expiresIn: '7d' });

    res.status(200).json({
      success: true,
      message: 'Đăng nhập thành công!',
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          name: user.name,
          phone: user.phone,
          email: user.email,
          cccd: user.cccd,
          status: user.status,
          roomId: user.roomId,
          room: user.room,
          landlordProfile: user.landlordProfile
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Lỗi đăng nhập: ' + error.message
    });
  }
};

export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!email) {
      res.status(400).json({ success: false, message: 'Vui lòng cung cấp địa chỉ email đã đăng ký.' });
      return;
    }
    const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } });
    if (!user) {
      res.status(404).json({ success: false, message: 'Email không tồn tại trong hệ thống' });
      return;
    }
    const otp = String(randomInt(100000, 1000000));
    const resetOtpExpires = new Date(Date.now() + 3 * 60 * 1000);
    await prisma.user.update({ where: { id: user.id }, data: { resetOtp: otp, resetOtpExpires } });
    try {
      await sendPasswordResetOtp(email, otp);
    } catch (mailError) {
      await prisma.user.update({ where: { id: user.id }, data: { resetOtp: null, resetOtpExpires: null } });
      throw mailError;
    }
    res.status(200).json({ success: true, message: 'Mã xác nhận OTP đã được gửi đến email của bạn.', expiresInSeconds: 180 });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Lỗi gửi yêu cầu khôi phục mật khẩu: ' + error.message
    });
  }
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const otp = typeof req.body.otp === 'string' ? req.body.otp.trim() : '';
    const { newPassword, confirmPassword } = req.body;
    if (typeof newPassword !== 'string' || typeof confirmPassword !== 'string' || newPassword.length < 6) {
      res.status(400).json({ success: false, message: 'Mật khẩu mới phải có tối thiểu 6 ký tự.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      res.status(400).json({ success: false, message: 'Xác nhận mật khẩu không khớp với mật khẩu mới' });
      return;
    }
    const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } });
    if (!user || !user.resetOtp || !user.resetOtpExpires || user.resetOtp !== otp || Date.now() > user.resetOtpExpires.getTime()) {
      res.status(400).json({ success: false, message: 'Mã OTP không chính xác hoặc đã hết hạn (3 phút)' });
      return;
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    const result = await prisma.user.updateMany({
      where: { id: user.id, resetOtp: otp, resetOtpExpires: { gt: new Date() } },
      data: { passwordHash, resetOtp: null, resetOtpExpires: null }
    });
    if (result.count !== 1) {
      res.status(400).json({ success: false, message: 'Mã OTP không chính xác hoặc đã hết hạn (3 phút)' });
      return;
    }
    res.status(200).json({ success: true, message: 'Cập nhật mật khẩu thành công. Vui lòng đăng nhập bằng mật khẩu mới.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Lỗi đặt lại mật khẩu: ' + error.message });
  }
};

export const changePassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user?.userId;

    if (!userId || !oldPassword || !newPassword) {
      res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp mật khẩu cũ và mật khẩu mới.'
      });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({
        success: false,
        message: 'Mật khẩu mới phải có tối thiểu 6 ký tự.'
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      res.status(404).json({ success: false, message: 'Người dùng không tồn tại.' });
      return;
    }

    const isMatch = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isMatch) {
      res.status(400).json({
        success: false,
        message: 'Mật khẩu hiện tại không chính xác.'
      });
      return;
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash }
    });

    res.status(200).json({
      success: true,
      message: 'Đổi mật khẩu thành công! Hãy đăng nhập lại với mật khẩu mới.'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Lỗi đổi mật khẩu: ' + error.message
    });
  }
};

export const getLandlordProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const profile = await prisma.landlordProfile.findFirst({
      include: { user: true }
    });

    if (!profile) {
      res.status(404).json({ success: false, message: 'Chưa có hồ sơ chủ trọ.' });
      return;
    }

    res.status(200).json({
      success: true,
      data: profile
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateLandlordProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      name,
      phone,
      email,
      address,
      cccd,
      bankName,
      bankAccount,
      bankOwner,
      avatarUrl,
      cccdFrontUrl,
      cccdBackUrl
    } = req.body;

    let profile = await prisma.landlordProfile.findFirst();

    // Auto generate VietQR URL if bank information is provided
    let qrImgUrl = profile?.qrImgUrl || '';
    if (bankName && bankAccount && bankOwner) {
      // Short code extraction for VietQR
      let bankCode = 'MB';
      if (bankName.includes('Vietcombank') || bankName.includes('VCB')) bankCode = 'VCB';
      else if (bankName.includes('Techcombank') || bankName.includes('TCB')) bankCode = 'TCB';
      else if (bankName.includes('BIDV')) bankCode = 'BIDV';
      else if (bankName.includes('VietinBank') || bankName.includes('CTG')) bankCode = 'ICB';
      else if (bankName.includes('ACB')) bankCode = 'ACB';
      else if (bankName.includes('VPBank') || bankName.includes('VPB')) bankCode = 'VPB';
      else if (bankName.includes('TPBank') || bankName.includes('TPB')) bankCode = 'TPB';

      qrImgUrl = `https://img.vietqr.io/image/${bankCode}-${bankAccount.replace(/\s+/g, '')}-compact2.png?accountName=${encodeURIComponent(bankOwner.toUpperCase())}`;
    }

    if (profile) {
      profile = await prisma.landlordProfile.update({
        where: { id: profile.id },
        data: {
          name: name || profile.name,
          phone: phone || profile.phone,
          email: email || profile.email,
          address: address || profile.address,
          cccd: cccd || profile.cccd,
          bankName: bankName || profile.bankName,
          bankAccount: bankAccount || profile.bankAccount,
          bankOwner: bankOwner || profile.bankOwner,
          avatarUrl: avatarUrl || profile.avatarUrl,
          cccdFrontUrl: cccdFrontUrl || profile.cccdFrontUrl,
          cccdBackUrl: cccdBackUrl || profile.cccdBackUrl,
          qrImgUrl: qrImgUrl || profile.qrImgUrl
        }
      });
    }

    res.status(200).json({
      success: true,
      message: 'Cập nhật hồ sơ chủ trọ thành công!',
      data: profile
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

