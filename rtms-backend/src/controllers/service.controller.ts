import { Request, Response } from 'express';
import prisma from '../config/db';
import { ServiceType } from '@prisma/client';

export const getServices = async (req: Request, res: Response): Promise<void> => {
  try {
    const services = await prisma.service.findMany({
      orderBy: { id: 'asc' }
    });

    const formatted = services.map(s => ({
      id: s.id,
      name: s.name,
      price: s.price,
      unit: s.unit,
      type: s.type === ServiceType.BAT_BUOC ? 'Bắt buộc' : 'Tùy chọn'
    }));

    res.status(200).json({
      success: true,
      data: formatted
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createService = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, price, unit, type } = req.body;

    if (!name || price === undefined || !unit) {
      res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp đầy đủ: Tên dịch vụ, Đơn giá và Đơn vị tính.'
      });
      return;
    }

    // Auto-generate service ID (e.g. SV05)
    const count = await prisma.service.count();
    const nextNum = (count + 1).toString().padStart(2, '0');
    const id = `SV${nextNum}`;

    const service = await prisma.service.create({
      data: {
        id,
        name: name.trim(),
        price: parseInt(price),
        unit: unit.trim(),
        type: type === 'Tùy chọn' ? ServiceType.TUY_CHON : ServiceType.BAT_BUOC
      }
    });

    res.status(201).json({
      success: true,
      message: 'Thêm dịch vụ mới thành công!',
      data: service
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateService = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, price, unit, type } = req.body;

    const updated = await prisma.service.update({
      where: { id },
      data: {
        name: name ? name.trim() : undefined,
        price: price !== undefined ? parseInt(price) : undefined,
        unit: unit ? unit.trim() : undefined,
        type: type ? (type === 'Tùy chọn' ? ServiceType.TUY_CHON : ServiceType.BAT_BUOC) : undefined
      }
    });

    res.status(200).json({
      success: true,
      message: 'Cập nhật dịch vụ thành công!',
      data: updated
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteService = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    await prisma.service.delete({
      where: { id }
    });

    res.status(200).json({
      success: true,
      message: `Đã xóa dịch vụ ${id} thành công!`
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

