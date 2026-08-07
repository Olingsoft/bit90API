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

    // First try to find in new Admin model
    let admin = await Admin.findOne({ phone }).select('+password');
    let role = 'admin';

    if (admin) {
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
      role = admin.role;
    } else {
      // Try old User model for backward compatibility
      const user = await User.findOne({ phone });
      if (!user) {
        return res.status(400).json({ success: false, message: 'Invalid phone or password' });
      }

      if (!(user.isAdmin === true || user.role === 'admin' || user.role === 'superadmin')) {
        return res.status(403).json({ success: false, message: 'Admin access required' });
      }

      // Old User model stores password in plain text (not hashed)
      if (user.password !== password) {
        return res.status(400).json({ success: false, message: 'Invalid phone or password' });
      }

      role = user.role === 'superadmin' ? 'super_admin' : 'admin';
      admin = user;
    }

    const token = require('jsonwebtoken').sign(
      { id: admin._id, phone: admin.phone, role: role },
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

    const existingAdmin = await Admin.findOne({ phone });
    if (existingAdmin) {
      return res.status(400).json({ success: false, message: 'Phone already exists' });
    }

    const admin = await Admin.create({
      fullName: 'Admin',
      username: phone,
      email: `${phone}@bit90.com`,
      phone,
      password,
      role: 'super_admin',
      status: 'active',
      createdBy: null
    });

    const token = require('jsonwebtoken').sign(
      { id: admin._id, phone: admin.phone, role: admin.role },
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
    console.error('Admin signup failed', error);
    res.status(500).json({ success: false, message: 'Signup failed' });
  }
});

router.get('/logout', (req, res) => {
  res.clearCookie('admin_token');
  res.json({ success: true });
});

module.exports = router;
