const express = require('express');
const { adminAuthMiddleware } = require('../middleware/auth');
const { getPublicState, getCrashQueue, getCrashRange, setCrashRange } = require('../services/aviatorEngine');

const router = express.Router();

router.get('/', adminAuthMiddleware, (req, res) => {
  const publicState = getPublicState();
  const crashQueue = getCrashQueue();
  const crashRange = getCrashRange();

  res.json({
    title: 'Aviator Admin Dashboard',
    publicState,
    crashQueue,
    crashRange,
  });
});

router.put('/crash-range', adminAuthMiddleware, (req, res) => {
  try {
    const min = Number(req.body.min);
    const max = Number(req.body.max);
    const updatedRange = setCrashRange({ min, max });
    return res.json({ message: 'Crash range updated', crashRange: updatedRange });
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Invalid crash range' });
  }
});

module.exports = router;
