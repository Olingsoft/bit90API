const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { authMiddleware } = require('../middleware/auth');
const mpesaService = require('../services/mpesaService');
const depositSettlement = require('../services/depositSettlement');

const router = express.Router();

// Safaricom STK Query: 4999 = still processing. Never treat as a final failure.
const MPESA_PROCESSING_CODES = new Set([4999]);
const MPESA_TERMINAL_FAILURE_CODES = new Set([
  1,    // Insufficient funds
  1001, // Unable to lock subscriber
  1019, // Transaction expired
  1025, // Error occurred during transaction
  1032, // Request cancelled by user
  1037, // Timeout / DS timeout (PIN not entered)
  2001, // Wrong PIN
]);

function parseMpesaResultCode(value) {
  if (value === undefined || value === null || value === '' || value === 'PROCESSING') {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function isMpesaSuccessCode(value) {
  return parseMpesaResultCode(value) === 0 || String(value) === '0';
}

function isMpesaProcessingResult(value, desc) {
  if (value === 'PROCESSING') return true;
  const code = parseMpesaResultCode(value);
  if (code !== null && MPESA_PROCESSING_CODES.has(code)) return true;
  const text = String(desc || '').toLowerCase();
  return text.includes('still under processing') || text.includes('being processed');
}

function isMpesaTerminalFailureCode(code) {
  return MPESA_TERMINAL_FAILURE_CODES.has(code);
}

const STK_PROMPT_GRACE_MS = 120000;

function isFinalFailure(transaction) {
  if (!transaction || transaction.credited || transaction.status === 'completed') return false;
  if (transaction.status !== 'failed') return false;
  if (transaction.mpesaReceiptNumber) return false;

  const createdAt = transaction.createdAt ? new Date(transaction.createdAt).getTime() : 0;
  const ageMs = createdAt ? Date.now() - createdAt : 0;
  if (ageMs < STK_PROMPT_GRACE_MS) return false;

  const code = parseMpesaResultCode(transaction.resultCode);
  if (code === null || MPESA_PROCESSING_CODES.has(code)) return false;
  if (!isMpesaTerminalFailureCode(code)) return false;

  return true;
}

function getPublicDepositStatus(transaction) {
  if (transaction.credited || transaction.status === 'completed') return 'completed';
  if (transaction.status === 'failed' && !isFinalFailure(transaction)) {
    return 'pending';
  }
  return transaction.status;
}

function formatUser(user) {
  return {
    id: String(user._id),
    phone: user.phone,
    username: user.username,
    email: user.email,
    balance: Number(user.balance || 0),
    isAdmin: user.isAdmin,
    role: user.role,
    createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : user.createdAt,
  };
}

router.get('/', async (req, res) => {
  try {
    const users = await User.find().lean();
    res.status(200).json(users.map(formatUser));
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch users', error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { phone, password, balance, username, email } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ message: 'Phone and password are required' });
    }

    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(409).json({ message: 'Phone already exists' });
    }

    const user = await User.create({
      phone,
      password,
      username: username || null,
      email: email || null,
      balance: balance !== undefined ? Number(balance) : 0,
    });

    const userData = formatUser(user.toObject());
    res.status(201).json({
      message: 'User created successfully',
      user: userData,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Phone already exists' });
    }
    res.status(500).json({ message: 'Failed to create user', error: error.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ message: 'Phone and password are required' });
    }

    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(401).json({ message: 'Invalid phone or password' });
    }

    if (user.password !== password) {
      return res.status(401).json({ message: 'Invalid phone or password' });
    }

    const token = jwt.sign(
      { id: String(user._id), phone: user.phone },
      process.env.JWT_SECRET || 'default_jwt_secret',
      { expiresIn: '1h' }
    );

    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: String(user._id),
        phone: user.phone,
        balance: user.balance,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Login failed', error: error.message });
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const payload = formatUser(user);
    payload.balance = Number(user.balance || 0);
    return res.status(200).json(payload);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch profile', error: error.message });
  }
});

// POST /users/deposit - Initiate M-Pesa STK Push and create pending transaction
router.post('/deposit', async (req, res) => {
  try {
    const { phone, amount } = req.body;
    const numAmount = Number(amount);

    if (!numAmount || isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ message: 'A valid deposit amount greater than 0 is required' });
    }

    let user = null;

    // Check token authentication header if available
    const tokenHeader = req.headers.authorization || '';
    if (tokenHeader.startsWith('Bearer ')) {
      try {
        const token = tokenHeader.slice(7);
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_jwt_secret');
        if (decoded && decoded.id) {
          user = await User.findById(decoded.id);
        }
      } catch (e) {
        // Ignore token decode error and fall back to phone match
      }
    }

    // Fallback to phone number lookup if user not found via token
    if (!user && phone) {
      const cleanPhone = String(phone).trim();
      const digitsOnly = cleanPhone.replace(/\D/g, '');
      const localPhone = digitsOnly.startsWith('254') ? `0${digitsOnly.slice(3)}` : digitsOnly;
      const intlPhone = digitsOnly.startsWith('254') ? `+${digitsOnly}` : `+254${digitsOnly.replace(/^0/, '')}`;

      user = await User.findOne({
        $or: [{ phone: cleanPhone }, { phone: localPhone }, { phone: intlPhone }],
      });
    }

    if (!user) {
      return res.status(404).json({ message: 'User not found. Please register or log in first.' });
    }

    const balanceBefore = Number(user.balance || 0);

    // Initiate M-Pesa STK Push via service
    const stkData = await mpesaService.initiateSTKPush({
      phone: user.phone,
      amount: numAmount,
      accountRef: 'Bit90 Deposit',
      transactionDesc: 'Deposit',
    });

    console.log('[Deposit] STK Push response received — CheckoutRequestID:', stkData.CheckoutRequestID);

    // Create pending transaction with M-Pesa tracking IDs
    const formattedPhone = mpesaService.formatPhone(user.phone);
    const transaction = await Transaction.create({
      userId: user._id,
      amount: numAmount,
      type: 'deposit',
      status: 'pending',
      balanceBefore,
      balanceAfter: balanceBefore, // unchanged until callback
      reference: stkData.CheckoutRequestID,
      paymentMethod: 'mpesa',
      phone: formattedPhone,
      merchantRequestId: stkData.MerchantRequestID,
      checkoutRequestId: stkData.CheckoutRequestID,
    });

    console.log('[Deposit] Pending transaction created:', transaction._id);

    return res.status(200).json({
      message: 'M-Pesa prompt sent successfully. Check your phone to complete.',
      transaction: {
        id: String(transaction._id),
        amount: transaction.amount,
        type: transaction.type,
        reference: transaction.reference,
        createdAt: transaction.createdAt,
      },
    });
  } catch (error) {
    console.error('[Deposit] Error:', error.message);
    return res.status(500).json({ message: 'Deposit failed', error: error.message });
  }
});

// POST /users/mpesa/callback - Handle Safaricom STK Push Callback (idempotent)
router.post('/mpesa/callback', depositSettlement.handleStkCallback);

// POST /users/mpesa/verify - Manually verify a pending M-Pesa transaction
router.post('/mpesa/verify', authMiddleware, async (req, res) => {
  try {
    const { checkoutRequestId, transactionId } = req.body;

    if (!checkoutRequestId && !transactionId) {
      return res.status(400).json({ message: 'checkoutRequestId or transactionId is required' });
    }

    // Find the transaction
    let transaction;
    if (transactionId) {
      transaction = await Transaction.findById(transactionId);
    } else {
      transaction = await Transaction.findOne({
        $or: [
          { checkoutRequestId },
          { reference: checkoutRequestId },
        ],
      });
    }

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    // Only verify the requesting user's own transactions
    if (String(transaction.userId) !== String(req.user.id)) {
      return res.status(403).json({ message: 'Not authorized to verify this transaction' });
    }

    // Repair false failures from STK Query ResultCode 4999 ("still processing").
    if (
      transaction.status === 'failed' &&
      !transaction.mpesaReceiptNumber &&
      !transaction.credited &&
      [4999, 1037].includes(Number(transaction.resultCode))
    ) {
      transaction.status = 'pending';
      transaction.resultCode = null;
      transaction.resultDesc = 'The transaction is still under processing';
      transaction.processedAt = null;
      await transaction.save();
      console.log('[M-Pesa Verify] Reopened false FAILED (ResultCode 4999) as PENDING:', transaction._id);
    }

    const canRecoverFalseFailure =
      transaction.status === 'failed' && !transaction.mpesaReceiptNumber && !transaction.credited;

    if (transaction.status === 'completed' || transaction.credited) {
      const user = await User.findById(req.user.id).select('balance');
      return res.status(200).json({
        message: `Transaction already resolved as: ${transaction.status}`,
        transaction: {
          id: String(transaction._id),
          status: 'completed',
          amount: transaction.amount,
          balanceAfter: transaction.balanceAfter,
          mpesaReceiptNumber: transaction.mpesaReceiptNumber,
          resultDesc: transaction.resultDesc,
        },
        balance: Number(user?.balance ?? transaction.balanceAfter ?? 0),
      });
    }

    if (transaction.status !== 'pending' && !canRecoverFalseFailure) {
      return res.status(200).json({
        message: `Transaction already resolved as: ${transaction.status}`,
        transaction: {
          id: String(transaction._id),
          status: transaction.status,
          amount: transaction.amount,
          balanceAfter: transaction.balanceAfter,
          mpesaReceiptNumber: transaction.mpesaReceiptNumber,
          resultDesc: transaction.resultDesc,
        },
      });
    }

    const confirmed = await depositSettlement.tryConfirmPaidFromQuery(transaction);
    if (confirmed?.settled) {
      const user = await User.findById(req.user.id).select('balance');
      return res.status(200).json({
        message: 'Payment verified and completed successfully',
        transaction: {
          id: String(confirmed.settled._id),
          status: confirmed.settled.status,
          amount: confirmed.settled.amount,
          balanceAfter: confirmed.settled.balanceAfter,
          mpesaReceiptNumber: confirmed.settled.mpesaReceiptNumber,
        },
        balance: Number(user?.balance ?? confirmed.settled.balanceAfter ?? 0),
      });
    }

    const queryResult = confirmed?.queryResult;
    if (queryResult && depositSettlement.isProcessingResult(queryResult.ResultCode, queryResult.ResultDesc)) {
      console.log(
        '[M-Pesa Verify] Still processing — CheckoutRequestID:',
        transaction.checkoutRequestId,
        'ResultCode:',
        queryResult.ResultCode
      );
    } else if (queryResult) {
      console.log(
        '[M-Pesa Verify] Non-success query result kept PENDING — ResultCode:',
        queryResult.ResultCode,
        'ResultDesc:',
        queryResult.ResultDesc
      );
    }

    return res.status(200).json({
      message: 'Transaction is still being processed by M-Pesa',
      transaction: {
        id: String(transaction._id),
        status: 'pending',
      },
    });
  } catch (error) {
    console.error('[M-Pesa Verify] Error:', error.message);
    // Query/API errors must not flip PENDING → FAILED.
    return res.status(200).json({
      message: 'Transaction is still being processed by M-Pesa',
      transaction: {
        id: String(transaction._id),
        status: 'pending',
      },
    });
  }
});

// GET /users/deposits/:id/status — live payment status + current wallet balance
router.get('/deposits/:id/status', authMiddleware, async (req, res) => {
  try {
    let transaction = await Transaction.findById(req.params.id);
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }
    if (String(transaction.userId) !== String(req.user.id)) {
      return res.status(403).json({ message: 'Not authorized to view this transaction' });
    }

    const ageMs = transaction.createdAt ? Date.now() - new Date(transaction.createdAt).getTime() : 0;
    if (
      ageMs >= 12000 &&
      !transaction.credited &&
      transaction.status !== 'completed'
    ) {
      try {
        const confirmed = await depositSettlement.tryConfirmPaidFromQuery(transaction);
        if (confirmed?.settled) {
          transaction = confirmed.settled;
        }
      } catch (error) {
        console.warn('[Deposit Status] Query confirm skipped:', error.message);
      }
    }

    const user = await User.findById(req.user.id).select('balance');
    const status = getPublicDepositStatus(transaction);
    const finalFailure = isFinalFailure(transaction);

    return res.status(200).json({
      id: String(transaction._id),
      status,
      final: status === 'completed' || finalFailure,
      credited: Boolean(transaction.credited),
      amount: transaction.amount,
      resultCode: transaction.resultCode,
      resultDesc: transaction.resultDesc,
      mpesaReceiptNumber: transaction.mpesaReceiptNumber,
      balance: Number(user?.balance || 0),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch deposit status', error: error.message });
  }
});

// GET /users/transactions - Fetch user transaction history
router.get('/transactions', authMiddleware, async (req, res) => {
  try {
    const transactions = await Transaction.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return res.status(200).json(transactions);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch transactions', error: error.message });
  }
});

// POST /users/withdraw - Request a withdrawal and deduct from user balance
router.post('/withdraw', authMiddleware, async (req, res) => {
  try {
    const { amount, phone: phoneOverride } = req.body;
    const numAmount = Number(amount);

    if (!numAmount || isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ message: 'A valid withdrawal amount greater than 0 is required' });
    }

    if (numAmount < 50) {
      return res.status(400).json({ message: 'Minimum withdrawal amount is KSh 50' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const balanceBefore = Number(user.balance || 0);

    if (numAmount > balanceBefore) {
      return res.status(400).json({ message: `Insufficient balance. Your balance is KSh ${balanceBefore.toFixed(2)}` });
    }

    const balanceAfter = balanceBefore - numAmount;
    user.balance = balanceAfter;
    await user.save();

    const reference = `WTH-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const transaction = await Transaction.create({
      userId: user._id,
      amount: numAmount,
      type: 'withdrawal',
      status: 'pending',
      balanceBefore,
      balanceAfter,
      reference,
      phone: phoneOverride || user.phone,
      paymentMethod: 'mpesa',
    });

    return res.status(200).json({
      message: 'Withdrawal request submitted successfully',
      balance: user.balance,
      user: {
        id: String(user._id),
        phone: user.phone,
        balance: user.balance,
      },
      transaction: {
        id: String(transaction._id),
        amount: transaction.amount,
        type: transaction.type,
        status: transaction.status,
        reference: transaction.reference,
        createdAt: transaction.createdAt,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Withdrawal failed', error: error.message });
  }
});

module.exports = router;

