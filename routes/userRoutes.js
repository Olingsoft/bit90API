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
    const balanceAfter = balanceBefore + numAmount;
    user.balance = balanceAfter;
    await user.save();

    const reference = `DEP-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const transaction = await Transaction.create({
      userId: user._id,
      amount: numAmount,
      type: 'deposit',
      balanceBefore,
      balanceAfter,
      reference,
    });

    return res.status(200).json({
      message: 'Deposit completed successfully',
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
        reference: transaction.reference,
        createdAt: transaction.createdAt,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Deposit failed', error: error.message });
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

module.exports = router;
