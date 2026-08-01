const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const dotenv = require('dotenv');
const userRoutes = require('./routes/userRoutes');
const aviatorRoutes = require('./routes/aviatorRoutes');
const { startRoundLoop } = require('./services/aviatorEngine');

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = '127.0.0.1';

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.json({
    message: 'Server is running',
    status: 'ok'
  });
});

app.use('/users', userRoutes);
app.use('/aviator', aviatorRoutes);

startRoundLoop().catch((error) => {
  console.error('Failed to start aviator round loop', error);
});

app.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
});
