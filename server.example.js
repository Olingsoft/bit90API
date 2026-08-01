const express = require('express');
const aviatorRoutes = require('./routes/aviatorRoutes');
const { startRoundLoop } = require('./services/aviatorEngine');

const app = express();
app.use(express.json());
app.use('/aviator', aviatorRoutes);

startRoundLoop().catch((error) => {
  console.error('Unable to start aviator loop', error);
});

app.listen(3000, () => {
  console.log('Aviator server listening on port 3000');
});
