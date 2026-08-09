const express = require('express');
const Admin = require('../models/Admin');
const User = require('../models/User');

const router = express.Router();

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

    // Find admin in Admin model by phoneNumber
    const admin = await Admin.findOne({ phoneNumber: phone }).select('+password');

    if (!admin) {
      return res.status(400).json({ success: false, message: 'Invalid phone or password' });
    }

    if (admin.status !== 'active') {
      return res.status(403).json({ success: false, message: 'Admin account is not active' });
    }

    if (admin.isLocked()) {
      return res.status(423).json({ success: false, message: 'Account is temporarily locked' });
    }

    const isPasswordValid = await admin.comparePassword(password);
    if (!isPasswordValid) {
      await admin.incrementFailedLogin();
      return res.status(400).json({ success: false, message: 'Invalid phone or password' });
    }

    await admin.resetFailedLogin();

    const token = require('jsonwebtoken').sign(
      { id: admin._id, phone: admin.phoneNumber, role: admin.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.cookie('admin_token', token, {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: 'lax',
      secure: false
    });

    res.json({ success: true, token });
  } catch (error) {
    console.error('Admin login failed', error);
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

    const existingAdmin = await Admin.findOne({ phoneNumber: phone });
    if (existingAdmin) {
      return res.status(400).json({ success: false, message: 'Phone already exists' });
    }

    // Check if this is the first admin
    const adminCount = await Admin.countDocuments();
    const isFirstAdmin = adminCount === 0;

    // Generate valid username from phone (remove special characters)
    const username = phone.replace(/[^a-zA-Z0-9_]/g, '');

    const admin = await Admin.create({
      fullName: 'Admin',
      username: username,
      email: `${phone}@bit90.com`,
      phoneNumber: phone,
      password,
      role: isFirstAdmin ? 'super_admin' : 'unassigned',
      status: 'active',
      createdBy: null
    });

    const token = require('jsonwebtoken').sign(
      { id: admin._id, phone: admin.phoneNumber, role: admin.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.cookie('admin_token', token, {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: 'lax',
      secure: false
    });

    res.json({ success: true, token, admin: { id: admin._id, role: admin.role, isFirstAdmin } });
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
