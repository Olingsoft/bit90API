const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/vvv-api';

let reconnectTimer = null;

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    if (mongoose.connection.readyState === 0) {
      console.log('[MongoDB] Attempting reconnect...');
      try {
        await mongoose.connect(MONGODB_URI);
        console.log('[MongoDB] Reconnected');
      } catch (error) {
        console.error('[MongoDB] Reconnect failed', error.message);
        scheduleReconnect();
      }
    }
  }, 5000);
}

function registerConnectionHandlers() {
  mongoose.connection.on('connected', () => {
    console.log('[MongoDB] Connected');
  });

  mongoose.connection.on('error', (error) => {
    console.error('[MongoDB] Connection error', error.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('[MongoDB] Disconnected');
    scheduleReconnect();
  });
}

async function connectMongo() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  registerConnectionHandlers();

  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log('[MongoDB] Connected to', MONGODB_URI.replace(/\/\/.*@/, '//***@'));
    return mongoose.connection;
  } catch (error) {
    console.error('[MongoDB] Connection failed', error.message);
    throw error;
  }
}

module.exports = {
  connectMongo,
  mongoose,
};
