const path = require('path');
const http = require('http');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const userRoutes = require('./routes/userRoutes');
const aviatorRoutes = require('./routes/aviatorRoutes');
const adminRoutes = require('./routes/adminRoutes');
const adminAuthRoutes = require('./routes/adminAuthRoutes');
const { connectMongo } = require('./config/mongodb');
const { startRoundLoop } = require('./services/gameLoop');
const { initSocket } = require('./services/socketService');
const { getPublicState } = require('./services/gameState');

dotenv.config();

const app = express();

// ─────────────────────────────────────────────
// Allowed origins — add new Vercel preview URLs
// or custom domains here.
// ─────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'https://bit90.vercel.app',
  // Production server frontend (same machine, different port)
  'http://102.68.86.20:3000',
  // Add preview/branch deployments when needed:
  // 'https://bit90-git-branch-yourteam.vercel.app',
];

/**
 * Returns true when the request origin is permitted.
 * - Production: only the listed Vercel origins.
 * - Development: any localhost / 127.0.0.1 port.
 */
function isOriginAllowed(origin) {
  // Allow server-to-server requests (no Origin header, e.g. curl / Postman)
  if (!origin) return true;

  if (ALLOWED_ORIGINS.includes(origin)) return true;

  // Allow any localhost / 127.0.0.1 origin on any port during development
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;

  return false;
}

const corsOptions = {
  origin(origin, callback) {
    if (isOriginAllowed(origin)) {
      // Reflect the exact origin back (required when credentials: true —
      // the wildcard '*' is forbidden by the CORS spec in that case).
      return callback(null, origin || '*');
    }
    console.warn('[CORS] Blocked origin:', origin);
    return callback(new Error('CORS policy: Origin not allowed'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Set-Cookie'],
  // How long (seconds) browsers may cache the preflight result
  maxAge: 86400,
};

// ─────────────────────────────────────────────
// CORS — must be the FIRST middleware so that
// CORS headers are present on every response,
// including 4xx / 5xx errors.
// ─────────────────────────────────────────────

// 1. Handle all OPTIONS preflight requests immediately — before any route
//    or authentication middleware that might reject the request first.
app.options('*', cors(corsOptions));

// 2. Apply CORS to every subsequent request.
app.use(cors(corsOptions));

// ─────────────────────────────────────────────
// General middleware
// ─────────────────────────────────────────────
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ─────────────────────────────────────────────
// View engine (EJS) — only used for admin UI
// ─────────────────────────────────────────────
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));

// ─────────────────────────────────────────────
// Health check
// ─────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    message: 'Server is running',
    status: 'ok',
  });
});

// ─────────────────────────────────────────────
// Application routes
// ─────────────────────────────────────────────
app.use('/users', userRoutes);
app.use('/aviator', aviatorRoutes);
app.use('/admin', adminAuthRoutes);
app.use('/admin', adminRoutes);

// ─────────────────────────────────────────────
// Global error handler — MUST come after routes.
// Re-attaches CORS headers before sending the
// error response so the browser can read the
// error body (otherwise it only sees a CORS failure).
// ─────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // Ensure CORS headers are always present, even on error responses.
  const origin = req.headers.origin;
  if (isOriginAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  if (err.message === 'CORS policy: Origin not allowed') {
    return res.status(403).json({ message: err.message });
  }

  console.error('[Server Error]', err);
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error',
  });
});

// ─────────────────────────────────────────────
// HTTP server + Socket.IO
// ─────────────────────────────────────────────
const server = http.createServer(app);

const io = initSocket(server, {
  cors: {
    origin(origin, callback) {
      if (isOriginAllowed(origin)) {
        return callback(null, origin || true);
      }
      return callback(new Error('CORS policy: Origin not allowed'));
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

io.on('connection', (socket) => {
  console.log('New socket connected:', socket.id);
  socket.emit('aviator:state', getPublicState());

  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);
  });
});

// ─────────────────────────────────────────────
// Server startup
// ─────────────────────────────────────────────
const PORT = Number(process.env.PORT) || 3000;

// IMPORTANT: Do NOT bind to '127.0.0.1' (loopback).
// Deno Deploy (and most cloud runtimes) require '0.0.0.0' so the
// process accepts connections from outside the container.
// Binding to '127.0.0.1' means the server is unreachable from the
// internet, so every request silently fails before CORS headers can
// ever be sent — which the browser reports as a CORS error.
const HOST = process.env.HOST || '0.0.0.0';

async function startServer() {
  try {
    await connectMongo();
    await startRoundLoop();

    server.listen(PORT, HOST, () => {
      console.log(`Server running on http://${HOST}:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server', error);
    process.exit(1);
  }
}

startServer();
