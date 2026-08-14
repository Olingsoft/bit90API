const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { authMiddleware } = require('../middleware/auth');

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

// POST /users/deposit - Process funds deposit and update user balance
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

    // 1. M-Pesa STK Push Integration
    const consumerKey = process.env.MPESA_CONSUMER_KEY || "cQJ4aARa4S8GrZAc0XWXlrFvFQjAvc4JK77H2NwhqHCOAgUg";
    const consumerSecret = process.env.MPESA_CONSUMER_SECRET || "CyPWywhC0jw2JGHQIrcGyH2AhbCIemYIXxzxQjJbiBjwlgLYECSBCMUAmFMH8lE2";
    const passkey = process.env.MPESA_PASSKEY || "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919";
    const shortcode = process.env.MPESA_SHORTCODE || "174379";

    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
    const tokenRes = await fetch("https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials", {
      headers: { Authorization: `Basic ${auth}` },
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error("M-Pesa Token Error:", err);
      return res.status(500).json({ message: 'Failed to authenticate with M-Pesa' });
    }

    const { access_token } = await tokenRes.json();

    const timestamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");

    let formattedPhone = user.phone.replace(/\D/g, "");
    if (formattedPhone.startsWith("0")) formattedPhone = `254${formattedPhone.slice(1)}`;
    if (formattedPhone.startsWith("+")) formattedPhone = formattedPhone.slice(1);
    if (!formattedPhone.startsWith("254")) formattedPhone = `254${formattedPhone}`;

    // Note: In production, CallBackURL should be your live server's webhook endpoint
    const callbackUrl = process.env.MPESA_CALLBACK_URL || "https://mydomain.com/api/users/mpesa/callback";

    const stkRes = await fetch("https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: Math.floor(numAmount),
        PartyA: formattedPhone,
        PartyB: shortcode,
        PhoneNumber: formattedPhone,
        CallBackURL: callbackUrl,
        AccountReference: "Bit90 Deposit",
        TransactionDesc: "Deposit",
      }),
    });

    if (!stkRes.ok) {
      const err = await stkRes.text();
      console.error("M-Pesa STK Push Error:", err);
      return res.status(500).json({ message: 'Failed to initiate STK Push' });
    }

    const stkData = await stkRes.json();
    const reference = stkData.CheckoutRequestID || `DEP-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const transaction = await Transaction.create({
      userId: user._id,
      amount: numAmount,
      type: 'deposit',
      status: 'pending',
      balanceBefore,
      balanceAfter: balanceBefore, // unchanged until callback
      reference,
    });

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
    return res.status(500).json({ message: 'Deposit failed', error: error.message });
  }
});

// POST /users/mpesa/callback - Handle Safaricom STK Push Callback
router.post('/mpesa/callback', async (req, res) => {
  try {
    const callbackData = req.body.Body.stkCallback;
    console.log("M-Pesa Callback Received:", JSON.stringify(callbackData, null, 2));

    const { CheckoutRequestID, ResultCode } = callbackData;

    // Acknowledge Safaricom immediately
    res.status(200).json({ ResultCode: 0, ResultDesc: "Success" });

    if (ResultCode === 0) {
      // Find the pending transaction by CheckoutRequestID
      const transaction = await Transaction.findOne({ reference: CheckoutRequestID });
      if (transaction && transaction.status === 'pending') {
        const user = await User.findById(transaction.userId);
        if (user) {
          const newBalance = Number(user.balance || 0) + transaction.amount;
          user.balance = newBalance;
          await user.save();

          transaction.status = 'completed';
          transaction.balanceAfter = newBalance;
          await transaction.save();
        }
      }
    } else {
      // Handle failed transaction
      const transaction = await Transaction.findOne({ reference: CheckoutRequestID });
      if (transaction) {
        transaction.status = 'failed';
        await transaction.save();
      }
    }
  } catch (error) {
    console.error("M-Pesa Callback Error:", error);
    // Already responded to Safaricom, but logging the error
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

