require('dotenv').config();
const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const { requireAuth } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const auctionRoutes = require('./routes/auctions');
const userRoutes = require('./routes/users');
const adminRoutes = require('./routes/admin');
const uploadRoutes = require('./routes/uploads');
const paymentRoutes = require('./routes/payments');
const { startAuctionScheduler, stopAuctionScheduler } = require('./services/auctionScheduler');

const app = express();
const server = http.createServer(app);
const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
function isAllowedClientOrigin(origin) {
  if (!origin || origin === clientUrl) return true;
  if (process.env.NODE_ENV !== 'production') {
    try {
      const url = new URL(origin);
      return url.protocol === 'http:'
        && ['localhost', '127.0.0.1'].includes(url.hostname)
        && /^51\d{2}$/.test(url.port);
    } catch {
      return false;
    }
  }
  return false;
}
const corsOrigin = (origin, callback) => callback(null, isAllowedClientOrigin(origin));
const io = new Server(server, { cors: { origin: corsOrigin, credentials: true } });
app.set('io', io);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json({ limit: '1mb', verify: (req, _res, buffer) => { if (req.originalUrl.includes('/api/v1/payments/webhook')) req.rawBody = Buffer.from(buffer); } }));
app.use(cookieParser());
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads'), { fallthrough: false, index: false, maxAge: '1d', setHeaders: res => res.setHeader('X-Content-Type-Options', 'nosniff') }));
app.use('/api', rateLimit({ windowMs: 60 * 1000, limit: 240, standardHeaders: true, legacyHeaders: false }));

app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'RareBid API', time: new Date().toISOString() }));
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/auctions', auctionRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/uploads', uploadRoutes);
app.use('/api/v1/payments', paymentRoutes);

io.use(async (socket, next) => {
  try {
    // Auction rooms are public read channels. If a valid session cookie exists, also join a private user room for notifications.
    const rawCookie = socket.handshake.headers.cookie || '';
    const tokenPair = rawCookie.split(';').map(item => item.trim()).find(item => item.startsWith('rarebid_token='));
    if (tokenPair) {
      const token = decodeURIComponent(tokenPair.slice('rarebid_token='.length));
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(payload.sub).select('_id status');
      if (user && user.status === 'active') {
        socket.data.userId = String(user._id);
        socket.join(`user:${String(user._id)}`);
      }
    }
    socket.data.connectedAt = Date.now();
    next();
  } catch {
    // An invalid optional cookie does not prevent a guest from viewing public live-auction updates.
    next();
  }
});
io.on('connection', socket => {
  socket.on('auction:join', async auctionId => {
    if (typeof auctionId === 'string' && /^[a-f\d]{24}$/i.test(auctionId)) socket.join(`auction:${auctionId}`);
  });
  socket.on('auction:leave', auctionId => {
    if (typeof auctionId === 'string' && /^[a-f\d]{24}$/i.test(auctionId)) socket.leave(`auction:${auctionId}`);
  });
});

app.use((req, res) => res.status(404).json({ message: `Route not found: ${req.method} ${req.path}` }));
app.use((error, _req, res, _next) => {
  if (error?.code === 11000) return res.status(409).json({ message: 'This action has already been processed.' });
  const status = Number(error.status) || (error.code === 'LIMIT_FILE_SIZE' || error.code === 'LIMIT_UNEXPECTED_FILE' ? 400 : 500);
  if (status >= 500) console.error('[api-error]', error);
  res.status(status).json({ message: status >= 500 ? 'An unexpected server error occurred.' : error.message });
});

const port = Number(process.env.PORT || 5000);
async function start() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must be configured with at least 32 characters.');
  await connectDB();
  server.listen(port, () => {
    console.log(`RareBid API listening on http://localhost:${port}`);
    startAuctionScheduler(io);
  });
}

async function shutdown(signal) {
  console.log(`${signal}: shutting down RareBid API`);
  stopAuctionScheduler();
  io.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
start().catch(error => { console.error('Startup failed:', error.message); process.exit(1); });
