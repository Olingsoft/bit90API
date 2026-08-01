const { db, collection, addDoc, getDocs, query, where, doc, setDoc, runTransaction, serverTimestamp, orderBy, limit, getDoc } = require('../firebase');

async function createRound(roundData) {
  if (!db) {
    return `local-round-${Date.now()}`;
  }

  const roundsRef = collection(db, 'aviator_rounds');
  const docRef = await addDoc(roundsRef, {
    ...roundData,
    createdAt: serverTimestamp ? serverTimestamp() : new Date().toISOString()
  });
  return docRef.id;
}

async function updateRound(roundId, data) {
  if (!db) return roundId;
  const roundRef = doc(db, 'aviator_rounds', roundId);
  await setDoc(roundRef, data, { merge: true });
  return roundId;
}

async function getRound(roundId) {
  if (!db) return null;
  const roundRef = doc(db, 'aviator_rounds', roundId);
  const snapshot = await getDoc(roundRef);
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

async function listRounds(limitCount = 20) {
  if (!db) return [];
  const roundsRef = collection(db, 'aviator_rounds');
  const q = query(roundsRef, orderBy('createdAt', 'desc'), limit(limitCount));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() }));
}

async function createBet(betData) {
  if (!db) {
    return `local-bet-${Date.now()}`;
  }

  const betsRef = collection(db, 'aviator_bets');
  const docRef = await addDoc(betsRef, {
    ...betData,
    createdAt: serverTimestamp ? serverTimestamp() : new Date().toISOString()
  });
  return docRef.id;
}

async function updateBet(betId, data) {
  if (!db) return betId;
  const betRef = doc(db, 'aviator_bets', betId);
  await setDoc(betRef, data, { merge: true });
  return betId;
}

async function getBetByUserAndRound(userId, roundId) {
  if (!db) return null;
  const betsRef = collection(db, 'aviator_bets');
  const q = query(betsRef, where('userId', '==', userId), where('roundId', '==', roundId));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const betDoc = snapshot.docs[0];
  return { id: betDoc.id, ...betDoc.data() };
}

async function getUserBalance(userId) {
  if (!db) return 0;
  const userRef = doc(db, 'users', userId);
  const snapshot = await getDoc(userRef);
  if (!snapshot.exists()) return 0;
  return Number(snapshot.data().balance || 0);
}

async function adjustBalance(userId, delta) {
  if (!db) return { userId, balance: 0, delta };

  const userRef = doc(db, 'users', userId);
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(userRef);
    if (!snapshot.exists()) {
      throw new Error('User not found');
    }

    const currentBalance = Number(snapshot.data().balance || 0);
    const nextBalance = currentBalance + delta;
    if (nextBalance < 0) {
      throw new Error('Insufficient balance');
    }

    transaction.update(userRef, { balance: nextBalance });
    return nextBalance;
  });
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
  adjustBalance
};
