import http from 'http';
import dotenv from 'dotenv';
import { Server as SocketIOServer } from 'socket.io';
import app from './app';
import { setIO } from './config/socket';
import { registerChatSocketHandlers } from './sockets/chat.socket';

dotenv.config();

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

// Initialize Socket.IO
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Save global IO instance
setIO(io);

// Register Socket handlers
registerChatSocketHandlers(io);

// Start HTTP + WebSocket Server
server.listen(PORT, () => {
  console.log(`
  ==============================================================
  🚀 RTMS PRODUCTION BACKEND RUNNING SUCCESSFULLY!
  📡 HTTP REST API: http://localhost:${PORT}
  ⚡ WebSocket:     ws://localhost:${PORT}
  📁 Health Check:  http://localhost:${PORT}/api/health
  ==============================================================
  `);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});

