import { Request, Response } from 'express';
import prisma from '../config/db';
import { getIO } from '../config/socket';

export const getPosts = async (req: Request, res: Response): Promise<void> => {
  try {
    const posts = await prisma.post.findMany({
      orderBy: { date: 'desc' }
    });

    const formatted = posts.map(p => {
      const d = new Date(p.date);
      const dateStr = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;

      return {
        id: p.id,
        title: p.title,
        content: p.content,
        date: dateStr,
        readByTenants: p.readByTenants as string[]
      };
    });

    res.status(200).json({ success: true, data: formatted });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createPost = async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, content } = req.body;

    if (!title || !content) {
      res.status(400).json({ success: false, message: 'Vui lòng cung cấp tiêu đề và nội dung bài viết.' });
      return;
    }

    const postCount = await prisma.post.count();
    const postId = `P${(postCount + 1).toString().padStart(2, '0')}`;

    const post = await prisma.post.create({
      data: {
        id: postId,
        title: title.trim(),
        content: content.trim(),
        date: new Date(),
        readByTenants: []
      }
    });

    // Notify real-time all tenants
    try {
      const io = getIO();
      io.emit('new_post_published', {
        id: post.id,
        title: post.title,
        content: post.content,
        date: post.date
      });
    } catch (e) {}

    res.status(201).json({
      success: true,
      message: 'Đăng thông báo mới lên bảng tin thành công!',
      data: post
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deletePost = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    await prisma.post.delete({
      where: { id }
    });

    res.status(200).json({
      success: true,
      message: `Đã xóa bài viết ${id} thành công!`
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const markPostAsRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Chưa được xác thực.' });
      return;
    }

    const post = await prisma.post.findUnique({ where: { id } });
    if (!post) {
      res.status(404).json({ success: false, message: 'Bài viết không tồn tại.' });
      return;
    }

    const readList = (post.readByTenants as string[]) || [];
    if (!readList.includes(userId)) {
      readList.push(userId);
      await prisma.post.update({
        where: { id },
        data: { readByTenants: readList }
      });
    }

    res.status(200).json({ success: true, message: 'Đã đánh dấu đã đọc bài viết.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

