import { Request, Response } from 'express';
import prisma from '../config/db';

export const getChatRooms = async (req: Request, res: Response): Promise<void> => {
  try {
    const rooms = await prisma.room.findMany({
      where: { status: 'DANG_THUE' },
      include: {
        chatMessages: {
          orderBy: { time: 'desc' },
          take: 1
        }
      },
      orderBy: { id: 'asc' }
    });

    // Count unread messages from tenants for each room
    const roomSummaries = await Promise.all(
      rooms.map(async (room) => {
        const unreadCount = await prisma.chatMessage.count({
          where: {
            roomId: room.id,
            senderRole: 'tenant',
            isRead: false
          }
        });

        const lastMsg = room.chatMessages[0];

        return {
          roomId: room.id,
          roomName: room.name,
          tenantName: room.tenantName || 'Khách thuê',
          lastMessage: lastMsg ? lastMsg.text : 'Chưa có tin nhắn nào',
          lastTime: lastMsg ? lastMsg.time : null,
          unreadCount
        };
      })
    );

    res.status(200).json({ success: true, data: roomSummaries });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMessagesByRoom = async (req: Request, res: Response): Promise<void> => {
  try {
    const { roomId } = req.params;

    const messages = await prisma.chatMessage.findMany({
      where: { roomId },
      orderBy: { time: 'asc' }
    });

    const formatted = messages.map(m => {
      const d = new Date(m.time);
      const timeStr = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')} ${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;

      return {
        id: m.id,
        sender: m.senderRole,
        text: m.text,
        time: timeStr,
        unread: !m.isRead
      };
    });

    res.status(200).json({ success: true, data: formatted });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

