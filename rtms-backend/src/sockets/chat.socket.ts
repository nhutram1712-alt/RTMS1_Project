import { Server, Socket } from 'socket.io';
import prisma from '../config/db';

export const registerChatSocketHandlers = (io: Server): void => {
  io.on('connection', (socket: Socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // Join room chat
    socket.on('join_room', (roomId: string) => {
      socket.join(`room_${roomId}`);
      console.log(`Socket ${socket.id} joined room_${roomId}`);
    });

    // Leave room chat
    socket.on('leave_room', (roomId: string) => {
      socket.leave(`room_${roomId}`);
      console.log(`Socket ${socket.id} left room_${roomId}`);
    });

    // Real-time message sending
    socket.on('send_message', async (data: { roomId: string; senderRole: 'landlord' | 'tenant'; text: string }) => {
      try {
        const { roomId, senderRole, text } = data;
        if (!roomId || !text || !text.trim()) return;

        const newMsg = await prisma.chatMessage.create({
          data: {
            roomId,
            senderRole,
            text: text.trim(),
            time: new Date(),
            isRead: false
          }
        });

        // Broadcast to the specific room chat
        io.to(`room_${roomId}`).emit('receive_message', {
          id: newMsg.id,
          roomId: newMsg.roomId,
          senderRole: newMsg.senderRole,
          text: newMsg.text,
          time: newMsg.time,
          isRead: newMsg.isRead
        });

        // Broadcast notification badge update to landlord
        if (senderRole === 'tenant') {
          io.emit('badge_chat_update', { roomId, increment: 1 });
        }
      } catch (error) {
        console.error('Socket send_message error:', error);
      }
    });

    // Mark messages in a room as read
    socket.on('mark_read', async (data: { roomId: string; role: 'landlord' | 'tenant' }) => {
      try {
        const { roomId, role } = data;
        const targetSenderRole = role === 'landlord' ? 'tenant' : 'landlord';

        await prisma.chatMessage.updateMany({
          where: {
            roomId,
            senderRole: targetSenderRole,
            isRead: false
          },
          data: {
            isRead: true
          }
        });

        io.to(`room_${roomId}`).emit('messages_marked_read', { roomId, byRole: role });
        io.emit('badge_chat_refresh', { roomId });
      } catch (error) {
        console.error('Socket mark_read error:', error);
      }
    });

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });
};

