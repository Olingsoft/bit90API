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
const PORT = Number(process.env.PORT) || 3000;
const HOST = '127.0.0.1';

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));

const allowedOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000'];

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1) {
        return callback(null, true);
      }
      return callback(new Error('CORS policy: Origin not allowed'));
    },
    credentials: true,
  })
);
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.json({
    message: 'Server is running',
    status: 'ok',
  });
});

app.use('/users', userRoutes);
app.use('/aviator', aviatorRoutes);
app.use('/admin', adminAuthRoutes);
app.use('/admin', adminRoutes);

const server = http.createServer(app);
const io = initSocket(server, {
  cors: {
    origin: allowedOrigins,
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
