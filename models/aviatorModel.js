const mongoose = require('mongoose');
const Round = require('./Round');
const Bet = require('./Bet');
const User = require('./User');
const Transaction = require('./Transaction');

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function formatRound(round) {
  if (!round) return null;
  const doc = round.toObject ? round.toObject() : round;
  return {
    id: String(doc._id),
    hash: doc.hash,
    serverSeed: doc.serverSeed,
    crashPoint: doc.crashPoint,
    status: doc.status,
    phase: doc.phase,
    countdown: doc.countdown,
    multiplier: doc.multiplier,
    startedAt: doc.startedAt instanceof Date ? doc.startedAt.toISOString() : doc.startedAt,
    crashedAt: doc.crashedAt instanceof Date ? doc.crashedAt.toISOString() : doc.crashedAt,
    revealedAt: doc.revealedAt instanceof Date ? doc.revealedAt.toISOString() : doc.revealedAt,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt,
  };
}

function formatBet(bet) {
  if (!bet) return null;
  const doc = bet.toObject ? bet.toObject() : bet;
  return {
    id: String(doc._id),
    userId: String(doc.userId),
    roundId: String(doc.roundId),
    amount: doc.amount,
    payout: doc.payout,
    status: doc.status,
    cashOutMultiplier: doc.cashOutMultiplier,
    placedAt: doc.placedAt instanceof Date ? doc.placedAt.toISOString() : doc.placedAt,
    cashedOutAt: doc.cashedOutAt instanceof Date ? doc.cashedOutAt.toISOString() : doc.cashedOutAt,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt,
  };
}

async function createRound(roundData) {
  const round = await Round.create({
    hash: roundData.hash,
    serverSeed: roundData.serverSeed ?? null,
    crashPoint: roundData.crashPoint ?? null,
    status: roundData.status,
    phase: roundData.phase,
    countdown: roundData.countdown ?? 0,
    multiplier: roundData.multiplier ?? 1,
    startedAt: roundData.startedAt ? new Date(roundData.startedAt) : new Date(),
    crashedAt: roundData.crashedAt ? new Date(roundData.crashedAt) : null,
    revealedAt: roundData.revealedAt ? new Date(roundData.revealedAt) : null,
  });
  return String(round._id);
}

async function updateRound(roundId, data) {
  if (!isValidObjectId(roundId)) {
    throw new Error('Invalid round ID');
  }

  const update = { ...data };
  if (update.startedAt) update.startedAt = new Date(update.startedAt);
  if (update.crashedAt) update.crashedAt = new Date(update.crashedAt);
  if (update.revealedAt) update.revealedAt = new Date(update.revealedAt);

  await Round.findByIdAndUpdate(roundId, update, { runValidators: true });
  return roundId;
}

async function getRound(roundId) {
  if (!isValidObjectId(roundId)) return null;
  const round = await Round.findById(roundId);
  return formatRound(round);
}

async function listRounds(limitCount = 20) {
  const rounds = await Round.find()
    .sort({ createdAt: -1 })
    .limit(limitCount)
    .lean();
  return rounds.map((round) => formatRound(round));
}

async function createBet(betData, session = null) {
  const options = session ? { session } : {};
  const [bet] = await Bet.create(
    [
      {
        userId: betData.userId,
        roundId: betData.roundId,
        amount: betData.amount,
        panelIndex: betData.panelIndex || 1,
        status: betData.status || 'placed',
        cashOutMultiplier: betData.cashOutMultiplier ?? null,
        payout: betData.payout ?? 0,
        placedAt: betData.placedAt ? new Date(betData.placedAt) : new Date(),
        cashedOutAt: betData.cashedOutAt ? new Date(betData.cashedOutAt) : null,
      },
    ],
    options
  );
  return String(bet._id);
}

async function updateBet(betId, data, session = null) {
  if (!isValidObjectId(betId)) {
    throw new Error('Invalid bet ID');
  }

  const update = { ...data };
  if (update.cashedOutAt) update.cashedOutAt = new Date(update.cashedOutAt);

  const options = { runValidators: true };
  if (session) options.session = session;

  await Bet.findByIdAndUpdate(betId, update, options);
  return betId;
}

async function getBetByUserAndRound(userId, roundId, panelIndex = 1) {
  if (!isValidObjectId(userId) || !isValidObjectId(roundId)) {
    return null;
  }

  const query = { userId, roundId };
  if (panelIndex) query.panelIndex = Number(panelIndex);

  const bet = await Bet.findOne(query);
  return formatBet(bet);
}

async function getUserBalance(userId) {
  if (!isValidObjectId(userId)) return 0;
  const user = await User.findById(userId).select('balance').lean();
  if (!user) return 0;
  return Number(user.balance || 0);
}

async function recordTransaction(userId, amount, type, balanceBefore, balanceAfter, reference, session = null) {
  const options = session ? { session } : {};
  await Transaction.create(
    [
      {
        userId,
        amount,
        type,
        balanceBefore,
        balanceAfter,
        reference: reference || null,
      },
    ],
    options
  );
}

async function adjustBalance(userId, delta, options = {}) {
  const { session = null, type = null, reference = null } = options;

  if (!isValidObjectId(userId)) {
    throw new Error('User not found');
  }

  const queryOptions = session ? { session } : {};

  if (delta < 0) {
    const debitAmount = Math.abs(delta);
    const user = await User.findOneAndUpdate(
      { _id: userId, balance: { $gte: debitAmount } },
      { $inc: { balance: delta } },
      { new: true, ...queryOptions }
    );

    if (!user) {
      const exists = session
        ? await User.findById(userId).session(session)
        : await User.findById(userId);
      if (!exists) throw new Error('User not found');
      throw new Error('Insufficient balance');
    }

    if (type) {
      await recordTransaction(
        userId,
        delta,
        type,
        user.balance - delta,
        user.balance,
        reference,
        session
      );
    }

    return user.balance;
  }

  const before = session
    ? await User.findById(userId).session(session)
    : await User.findById(userId);
  if (!before) {
    throw new Error('User not found');
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { $inc: { balance: delta } },
    { new: true, ...queryOptions }
  );

  if (type) {
    await recordTransaction(
      userId,
      delta,
      type,
      before.balance,
      user.balance,
      reference,
      session
    );
  }

  return user.balance;
}

async function placeBetWithTransaction(userId, roundId, amount, panelIndex = 1) {
  if (!isValidObjectId(userId)) {
    throw new Error('User not found');
  }
  if (!isValidObjectId(roundId)) {
    throw new Error('Invalid round ID');
  }

  const pIndex = Number(panelIndex) || 1;
  const existingBet = await Bet.findOne({ userId, roundId, panelIndex: pIndex });
  if (existingBet) {
    throw new Error('Bet already placed for this panel in this round');
  }

  let session = null;
  try {
    session = await mongoose.startSession();
    session.startTransaction();
  } catch (e) {
    session = null;
  }

  try {
    const newBalance = await adjustBalance(userId, -amount, {
      session,
      type: 'bet',
      reference: `${roundId}-p${pIndex}`,
    });

    const betId = await createBet(
      {
        userId,
        roundId,
        amount,
        panelIndex: pIndex,
        status: 'placed',
        cashOutMultiplier: null,
        payout: 0,
      },
      session
    );

    if (session) await session.commitTransaction();
    return { betId, newBalance };
  } catch (error) {
    if (session) await session.abortTransaction();
    throw error;
  } finally {
    if (session) session.endSession();
  }
}

async function cashOutWithTransaction(userId, roundId, betId, multiplier, payout) {
  if (!isValidObjectId(userId)) {
    throw new Error('User not found');
  }

  let session = null;
  try {
    session = await mongoose.startSession();
    session.startTransaction();
  } catch (e) {
    session = null;
  }

  try {
    const newBalance = await adjustBalance(userId, payout, {
      session,
      type: 'cashout',
      reference: String(betId),
    });

    await updateBet(
      betId,
      {
        status: 'cashed_out',
        cashOutMultiplier: multiplier,
        payout,
        cashedOutAt: new Date(),
      },
      session
    );

    if (session) await session.commitTransaction();
    return { payout, multiplier, newBalance };
  } catch (error) {
    if (session) await session.abortTransaction();
    throw error;
  } finally {
    if (session) session.endSession();
  }
}

function formatMaskedPhone(phone) {
  if (!phone) return '0712***21';
  let digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('254') && digits.length === 12) {
    digits = '0' + digits.slice(3);
  }
  if (digits.length >= 9) {
    const start = digits.slice(0, 4);
    const end = digits.slice(-2);
    return `${start}***${end}`;
  }
  return `${digits.slice(0, 3)}***${digits.slice(-2)}`;
}

async function getUserBets(userId, limitCount = 30) {
  if (!isValidObjectId(userId)) return [];
  const bets = await Bet.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limitCount)
    .lean();

  return bets.map((b) => ({
    id: String(b._id),
    roundId: String(b.roundId),
    panelIndex: b.panelIndex || 1,
    amount: b.amount,
    cashedOutAt: b.cashOutMultiplier || null,
    payout: b.payout || null,
    status: b.status,
    createdAt: b.createdAt ? new Date(b.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
  }));
}

async function getTopBets(limitCount = 20) {
  const bets = await Bet.find({ status: 'cashed_out' })
    .populate('userId', 'phone')
    .sort({ payout: -1 })
    .limit(limitCount)
    .lean();

  return bets.map((b, idx) => ({
    rank: idx + 1,
    user: b.userId?.phone ? formatMaskedPhone(b.userId.phone) : '0712***21',
    bet: b.amount,
    mult: b.cashOutMultiplier || 1,
    payout: b.payout || 0,
    date: b.createdAt ? new Date(b.createdAt).toLocaleDateString() : 'Today',
  }));
}

async function getRoundBets(roundId) {
  if (!isValidObjectId(roundId)) return [];
  const bets = await Bet.find({ roundId })
    .populate('userId', 'phone')
    .sort({ createdAt: -1 })
    .lean();

  return bets.map((b) => ({
    id: String(b._id),
    username: b.userId?.phone ? formatMaskedPhone(b.userId.phone) : '0712***21',
    amount: b.amount,
    cashedOut: b.status === 'cashed_out',
    cashedOutAt: b.cashOutMultiplier || undefined,
    payout: b.payout || undefined,
    status: b.status,
    panelIndex: b.panelIndex || 1,
  }));
}

module.exports = {
  createRound,
  updateRound,
  getRound,
  listRounds,
  createBet,
  updateBet,
  getBetByUserAndRound,
  getUserBalance,
  adjustBalance,
  placeBetWithTransaction,
  cashOutWithTransaction,
  getUserBets,
  getTopBets,
  getRoundBets,
  formatMaskedPhone,
  isValidObjectId,
};

