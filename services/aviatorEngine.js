const {
  getBetByUserAndRound,
  placeBetWithTransaction,
  cashOutWithTransaction,
} = require('../models/aviatorModel');
const {
  getPublicState,
  getCrashQueue,
  getCrashRange,
  setCrashRange,
  getCurrentRound,
} = require('./gameState');
const { emitAviator } = require('./socketService');

async function placeBet(userId, amount, roundId, panelIndex = 1) {
  const round = getCurrentRound();
  const targetRoundId = roundId || round?.id;
  if (!round || round.id !== targetRoundId) {
    throw new Error('Round is not active');
  }

  if (round.phase !== 'waiting') {
    throw new Error('Bets are only accepted during the waiting phase');
  }

  const numericAmount = Number(amount);
  if (!userId || !numericAmount || numericAmount <= 0) {
    throw new Error('A valid amount is required');
  }

  const pIndex = Number(panelIndex) || 1;
  const { betId, newBalance } = await placeBetWithTransaction(userId, round.id, numericAmount, pIndex);

  emitAviator('aviator:bet', {
    roundId: round.id,
    amount: numericAmount,
    panelIndex: pIndex,
  });

  return { betId, roundId: round.id, amount: numericAmount, panelIndex: pIndex, newBalance };
}

async function cashOutBet(userId, roundId, panelIndex = 1) {
  const round = getCurrentRound();
  const targetRoundId = roundId || round?.id;
  if (!round || round.id !== targetRoundId) {
    throw new Error('Round is not active');
  }

  if (round.phase !== 'flying') {
    throw new Error('Cashout is only available during the flying phase');
  }

  const pIndex = Number(panelIndex) || 1;
  const bet = await getBetByUserAndRound(userId, round.id, pIndex);
  if (!bet || bet.status !== 'placed') {
    throw new Error('Bet not found');
  }

  const multiplier = round.multiplier || 1;
  const payout = Number(Number(bet.amount * multiplier).toFixed(2));

  const { newBalance } = await cashOutWithTransaction(userId, round.id, bet.id, multiplier, payout);

  emitAviator('aviator:cashout', {
    roundId: round.id,
    multiplier,
    payout,
    panelIndex: pIndex,
  });

  return { payout, multiplier, panelIndex: pIndex, newBalance };
}

module.exports = {
  placeBet,
  cashOutBet,
  getPublicState,
  getCrashQueue,
  getCrashRange,
  setCrashRange,
};
