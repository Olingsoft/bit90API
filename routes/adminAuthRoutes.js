const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

function isAdminUser(user) {
  return Boolean(user && (user.isAdmin === true || user.role === 'admin' || user.role === 'superadmin'));
}

router.get('/login', (req, res) => {
  res.json({ message: 'Use frontend /admin/login to authenticate' });
});

router.get('/signup', (req, res) => {
  res.json({ message: 'Use frontend /admin/signup to create admin' });
});

router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) {
      return res.status(400).json({ success: false, message: 'Phone and password are required' });
    }

    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid phone or password' });
    }

    if (user.password !== password) {
      return res.status(400).json({ success: false, message: 'Invalid phone or password' });
    }

    if (!isAdminUser(user)) {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const token = jwt.sign(
      { id: String(user._id), phone: user.phone, isAdmin: true, role: user.role || 'admin' },
      process.env.JWT_SECRET || 'default_jwt_secret',
      { expiresIn: '1h' }
    );

    res.cookie('admin_token', token, { httpOnly: true, maxAge: 3600000 });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Login failed' });
  }
});

router.post('/signup', async (req, res) => {
  try {
    const { phone, password, secret } = req.body;
    if (!phone || !password || !secret) {
      return res.status(400).json({ success: false, message: 'Phone, password and signup secret are required' });
    }

    const signupSecret = process.env.ADMIN_SIGNUP_SECRET;
    if (!signupSecret) {
      return res.status(403).json({ success: false, message: 'Admin signup is disabled on this server' });
    }

    if (secret !== signupSecret) {
      return res.status(403).json({ success: false, message: 'Invalid signup secret' });
    }

    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Phone already exists' });
    }

    const user = await User.create({
      phone,
      password,
      balance: 0,
      isAdmin: true,
      role: 'admin',
    });

    const token = jwt.sign(
      { id: String(user._id), phone: user.phone, isAdmin: true, role: 'admin' },
      process.env.JWT_SECRET || 'default_jwt_secret',
      { expiresIn: '1h' }
    );

    res.cookie('admin_token', token, { httpOnly: true, maxAge: 3600000 });
    res.json({ success: true });
  } catch (error) {
    console.error('Admin signup failed', error);
    res.status(500).json({ success: false, message: 'Signup failed' });
  }
});

router.get('/logout', (req, res) => {
  res.clearCookie('admin_token');
  res.json({ success: true });
});

module.exports = router;
