const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { placeBet, cashOutBet, getPublicState, getCrashQueue } = require('../services/aviatorEngine');
const { listRounds } = require('../models/aviatorModel');

const router = express.Router();

function isAdminUser(user) {
  if (!user) return false;
  if (user.isAdmin === true) return true;
  if (user.role === 'admin' || user.role === 'superadmin') return true;
  return false;
}

router.get('/state', (req, res) => {
  try {
    res.json(getPublicState());
  } catch (error) {
    res.status(500).json({ message: 'Unable to get aviator state', error: error.message });
  }
});

router.get('/history', async (req, res) => {
  try {
    const rounds = await listRounds(20);
    res.json(rounds);
  } catch (error) {
    res.status(500).json({ message: 'Unable to fetch aviator history', error: error.message });
  }
});

router.get('/admin/queue', authMiddleware, (req, res) => {
  if (!isAdminUser(req.user)) {
    return res.status(403).json({ message: 'Admin access required' });
  }

  try {
    res.json({ queue: getCrashQueue() });
  } catch (error) {
    res.status(500).json({ message: 'Unable to get crash queue', error: error.message });
  }
});

router.post('/bet', authMiddleware, async (req, res) => {
  try {
    const { amount, roundId, panelIndex } = req.body;
    const result = await placeBet(
      req.user.id,
      amount,
      roundId || getPublicState().roundId,
      Number(panelIndex) || 1
    );
    res.status(200).json({ message: 'Bet accepted', ...result });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.post('/cashout', authMiddleware, async (req, res) => {
  try {
    const { roundId, panelIndex } = req.body;
    const result = await cashOutBet(
      req.user.id,
      roundId || getPublicState().roundId,
      Number(panelIndex) || 1
    );
    res.status(200).json({ message: 'Cashout successful', ...result });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;
