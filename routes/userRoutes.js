const express = require('express');
const jwt = require('jsonwebtoken');
const { db, collection, addDoc, getDocs, query, where } = require('../firebase');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const usersRef = collection(db, 'users');
    const snapshot = await getDocs(usersRef);
    const users = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch users', error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { phone, password, balance } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ message: 'Phone and password are required' });
    }

    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('phone', '==', phone));
    const existingUsers = await getDocs(q);

    if (!existingUsers.empty) {
      return res.status(409).json({ message: 'Phone already exists' });
    }

    const userData = {
      phone,
      password,
      balance: balance !== undefined ? Number(balance) : 0,
      createdAt: new Date().toISOString()
    };

    const docRef = await addDoc(usersRef, userData);
    res.status(201).json({
      message: 'User created successfully',
      user: { id: docRef.id, ...userData }
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to create user', error: error.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ message: 'Phone and password are required' });
    }

    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('phone', '==', phone));
    const existingUsers = await getDocs(q);

    if (existingUsers.empty) {
      return res.status(401).json({ message: 'Invalid phone or password' });
    }

    const userDoc = existingUsers.docs[0];
    const user = userDoc.data();

    if (user.password !== password) {
      return res.status(401).json({ message: 'Invalid phone or password' });
    }

    const token = jwt.sign(
      { id: userDoc.id, phone: user.phone },
      process.env.JWT_SECRET || 'default_jwt_secret',
      { expiresIn: '1h' }
    );

    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: userDoc.id,
        phone: user.phone,
        balance: user.balance
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Login failed', error: error.message });
  }
});

module.exports = router;
