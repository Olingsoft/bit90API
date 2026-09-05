const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { authMiddleware } = require('../middleware/auth');
const mpesaService = require('../services/mpesaService');

const router = express.Router();

function formatUser(user) {
  return {
    id: String(user._id),
    phone: user.phone,
    username: user.username,
    email: user.email,
    balance: user.balance,
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
router.post('/mpesa/callback', async (req, res) => {
  // ALWAYS respond 200 immediately — Safaricom will retry on non-200
  res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });

  // Process the callback asynchronously after responding
  try {
    const callbackData = req.body?.Body?.stkCallback;

    if (!callbackData) {
      console.error('[M-Pesa Callback] Invalid callback body — missing Body.stkCallback');
      return;
    }

    const {
      MerchantRequestID,
      CheckoutRequestID,
      ResultCode,
      ResultDesc,
      CallbackMetadata,
    } = callbackData;

    console.log(
      '[M-Pesa Callback] Received — CheckoutRequestID:', CheckoutRequestID,
      'ResultCode:', ResultCode,
      'ResultDesc:', ResultDesc
    );

    if (ResultCode === 0) {
      // ── SUCCESS ──────────────────────────────────────────────────
      // Extract metadata from callback
      const metadata = mpesaService.parseCallbackMetadata(
        CallbackMetadata?.Item || []
      );

      const confirmedAmount = metadata.Amount;
      const mpesaReceiptNumber = metadata.MpesaReceiptNumber || null;
      const mpesaPhone = metadata.PhoneNumber ? String(metadata.PhoneNumber) : null;

      // Parse M-Pesa transaction date (format: YYYYMMDDHHmmss)
      let transactionDate = null;
      if (metadata.TransactionDate) {
        const ds = String(metadata.TransactionDate);
        if (ds.length >= 14) {
          transactionDate = new Date(
            `${ds.slice(0, 4)}-${ds.slice(4, 6)}-${ds.slice(6, 8)}T${ds.slice(8, 10)}:${ds.slice(10, 12)}:${ds.slice(12, 14)}+03:00`
          );
        }
      }

      // Atomic update: only updates if status is still 'pending' (idempotency)
      const transaction = await Transaction.findOneAndUpdate(
        {
          $or: [
            { checkoutRequestId: CheckoutRequestID },
            { reference: CheckoutRequestID },
          ],
          status: 'pending',
        },
        {
          $set: {
            status: 'completed',
            checkoutRequestId: CheckoutRequestID,
            merchantRequestId: MerchantRequestID,
            resultCode: ResultCode,
            resultDesc: ResultDesc,
            mpesaReceiptNumber: mpesaReceiptNumber,
            transactionDate: transactionDate,
            processedAt: new Date(),
          },
        },
        { new: true }
      );

      if (!transaction) {
        console.warn(
          '[M-Pesa Callback] No pending transaction found for CheckoutRequestID:',
          CheckoutRequestID,
          '— likely already processed (idempotency check passed)'
        );
        return;
      }

      // Credit the user's balance
      const depositAmount = confirmedAmount || transaction.amount;
      const user = await User.findById(transaction.userId);

      if (user) {
        const newBalance = Number(user.balance || 0) + depositAmount;
        user.balance = newBalance;
        await user.save();

        // Update balanceAfter on the transaction
        transaction.balanceAfter = newBalance;
        await transaction.save();

        console.log(
          '[M-Pesa Callback] Payment SUCCESS — User:', user._id,
          'Amount:', depositAmount,
          'Receipt:', mpesaReceiptNumber,
          'NewBalance:', newBalance
        );
      } else {
        console.error(
          '[M-Pesa Callback] User not found for transaction:', transaction._id,
          'userId:', transaction.userId
        );
      }
    } else {
      // ── FAILURE ──────────────────────────────────────────────────
      const transaction = await Transaction.findOneAndUpdate(
        {
          $or: [
            { checkoutRequestId: CheckoutRequestID },
            { reference: CheckoutRequestID },
          ],
          status: 'pending',
        },
        {
          $set: {
            status: 'failed',
            checkoutRequestId: CheckoutRequestID,
            merchantRequestId: MerchantRequestID,
            resultCode: ResultCode,
            resultDesc: ResultDesc,
            processedAt: new Date(),
          },
        },
        { new: true }
      );

      if (transaction) {
        console.log(
          '[M-Pesa Callback] Payment FAILED — Transaction:', transaction._id,
          'ResultCode:', ResultCode,
          'ResultDesc:', ResultDesc
        );
      } else {
        console.warn(
          '[M-Pesa Callback] No pending transaction found for failed callback — CheckoutRequestID:',
          CheckoutRequestID
        );
      }
    }
  } catch (error) {
    console.error('[M-Pesa Callback] Processing error:', error.message, error.stack);
  }
});

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

    if (transaction.status !== 'pending') {
      return res.status(200).json({
        message: `Transaction already resolved as: ${transaction.status}`,
        transaction: {
          id: String(transaction._id),
          status: transaction.status,
          mpesaReceiptNumber: transaction.mpesaReceiptNumber,
          resultDesc: transaction.resultDesc,
        },
      });
    }

    // Query M-Pesa STK Push status
    const targetCheckoutId = transaction.checkoutRequestId || transaction.reference;
    const queryResult = await mpesaService.querySTKPushStatus(targetCheckoutId);

    if (String(queryResult.ResultCode) === '0') {
      // Payment was successful — update transaction
      const updated = await Transaction.findOneAndUpdate(
        { _id: transaction._id, status: 'pending' },
        {
          $set: {
            status: 'completed',
            resultCode: Number(queryResult.ResultCode),
            resultDesc: queryResult.ResultDesc,
            processedAt: new Date(),
          },
        },
        { new: true }
      );

      if (updated) {
        // Credit user balance
        const user = await User.findById(updated.userId);
        if (user) {
          const newBalance = Number(user.balance || 0) + updated.amount;
          user.balance = newBalance;
          await user.save();
          updated.balanceAfter = newBalance;
          await updated.save();

          console.log('[M-Pesa Verify] Payment confirmed SUCCESS — User:', user._id, 'Amount:', updated.amount);
        }

        return res.status(200).json({
          message: 'Payment verified and completed successfully',
          transaction: {
            id: String(updated._id),
            status: updated.status,
            amount: updated.amount,
            mpesaReceiptNumber: updated.mpesaReceiptNumber,
          },
        });
      }
    } else {
      // Payment failed or still pending
      const resultCode = Number(queryResult.ResultCode);

      // ResultCode 1032 = cancelled, 1037 = timeout, etc. — mark as failed
      if (resultCode !== 0) {
        await Transaction.findOneAndUpdate(
          { _id: transaction._id, status: 'pending' },
          {
            $set: {
              status: 'failed',
              resultCode: resultCode,
              resultDesc: queryResult.ResultDesc,
              processedAt: new Date(),
            },
          }
        );

        console.log('[M-Pesa Verify] Payment confirmed FAILED — ResultCode:', resultCode);

        return res.status(200).json({
          message: `Transaction failed: ${queryResult.ResultDesc}`,
          transaction: {
            id: String(transaction._id),
            status: 'failed',
            resultCode: resultCode,
            resultDesc: queryResult.ResultDesc,
          },
        });
      }
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
    return res.status(500).json({ message: 'Verification failed', error: error.message });
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

