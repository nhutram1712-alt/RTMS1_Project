import express from 'express';
import cors from 'cors';
import path from 'path';

// Import Routes
import authRoutes from './routes/auth.routes';
import roomRoutes from './routes/room.routes';
import serviceRoutes from './routes/service.routes';
import contractRoutes from './routes/contract.routes';
import tenantRoutes from './routes/tenant.routes';
import invoiceRoutes from './routes/invoice.routes';
import paymentRoutes from './routes/payment.routes';
import postRoutes from './routes/post.routes';
import issueRoutes from './routes/issue.routes';
import chatRoutes from './routes/chat.routes';
import aiRoutes from './routes/ai.routes';
import { getBootstrap } from './controllers/bootstrap.controller';

// Import Middlewares
import { errorHandler } from './middlewares/error.middleware';

const app = express();

// Global Middlewares
app.use(cors({
  origin: '*', // Allow all origins for dev / mobile / web clients
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files (Uploads)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Serve Frontend Static Web App
app.use(express.static(path.join(__dirname, '../../')));

// Root Route: Serve RTMS Frontend Dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../s_c_b_o_h_ng_c_p_nh_t.html'));
});

// Root Health Check Route
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ONLINE',
    service: 'RTMS Backend Production API',
    timestamp: new Date().toISOString()
  });
});
app.get('/api/bootstrap', getBootstrap);

// API Routes Mounting
app.use('/api/auth', authRoutes);
app.use('/api', authRoutes); // support /api/profile/landlord directly
app.use('/api/rooms', roomRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/issues', issueRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/ai', aiRoutes);

// Error Handling Middleware
app.use(errorHandler);

export default app;

