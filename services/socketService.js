const { Server } = require('socket.io');

let io = null;

function initSocket(server, options = {}) {
  if (io) return io;
  io = new Server(server, options);
  return io;
}

function getIo() {
  if (!io) {
    throw new Error('Socket.IO has not been initialized');
  }
  return io;
}

function emitAviator(event, payload) {
  if (!io) return null;
  io.emit(event, payload);
  return payload;
}

module.exports = {
  initSocket,
  getIo,
  emitAviator,
};
