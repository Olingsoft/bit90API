const express = require('express');
const aviatorRoutes = require('./routes/aviatorRoutes');
const { connectMongo } = require('./config/mongodb');
const { startRoundLoop } = require('./services/gameLoop');

const app = express();
app.use(express.json());
app.use('/aviator', aviatorRoutes);

async function start() {
  await connectMongo();
  await startRoundLoop();
  app.listen(3000, () => {
    console.log('Aviator server listening on port 3000');
  });
}

start().catch((error) => {
  console.error('Unable to start aviator server', error);
  process.exit(1);
});
