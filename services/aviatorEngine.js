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

async function placeBet(userId, amount, roundId) {
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

  const betId = await placeBetWithTransaction(userId, round.id, numericAmount);

  emitAviator('aviator:bet', {
    roundId: round.id,
    amount: numericAmount,
  });

  return { betId, roundId: round.id, amount: numericAmount };
}

async function cashOutBet(userId, roundId) {
  const round = getCurrentRound();
  const targetRoundId = roundId || round?.id;
  if (!round || round.id !== targetRoundId) {
    throw new Error('Round is not active');
  }

  if (round.phase !== 'flying') {
    throw new Error('Cashout is only available during the flying phase');
  }

  const bet = await getBetByUserAndRound(userId, round.id);
  if (!bet || bet.status !== 'placed') {
    throw new Error('Bet not found');
  }

  const multiplier = round.multiplier || 1;
  const payout = Number(Number(bet.amount * multiplier).toFixed(2));

  await cashOutWithTransaction(userId, round.id, bet.id, multiplier, payout);

  emitAviator('aviator:cashout', {
    roundId: round.id,
    multiplier,
    payout,
  });

  return { payout, multiplier };
}

module.exports = {
  placeBet,
  cashOutBet,
  getPublicState,
  getCrashQueue,
  getCrashRange,
  setCrashRange,
};
