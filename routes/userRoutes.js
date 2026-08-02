const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

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

module.exports = router;
