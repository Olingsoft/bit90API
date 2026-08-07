'use strict';

const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { auditLogService } = require('../services/auditLogService');

/**
 * Get all deposits with pagination and filters
 */
const getAllDeposits = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      paymentMethod,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = { type: 'deposit' };
    
    if (status) {
      query.status = status;
    }
    
    if (paymentMethod) {
      query.paymentMethod = paymentMethod;
    }
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    if (minAmount || maxAmount) {
      query.amount = {};
      if (minAmount) query.amount.$gte = Number(minAmount);
      if (maxAmount) query.amount.$lte = Number(maxAmount);
    }

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const deposits = await Transaction.find(query)
      .populate('user', 'phone email')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const total = await Transaction.countDocuments(query);

    res.json({
      deposits,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalDeposits: total,
        perPage: limit
      }
    });
  } catch (error) {
    console.error('[Finance Controller] Get all deposits error:', error);
    res.status(500).json({ message: 'Failed to get deposits' });
  }
};

/**
 * Get all withdrawals with pagination and filters
 */
const getAllWithdrawals = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      paymentMethod,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = { type: 'withdrawal' };
    
    if (status) {
      query.status = status;
    }
    
    if (paymentMethod) {
      query.paymentMethod = paymentMethod;
    }
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    if (minAmount || maxAmount) {
      query.amount = {};
      if (minAmount) query.amount.$gte = Number(minAmount);
      if (maxAmount) query.amount.$lte = Number(maxAmount);
    }

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const withdrawals = await Transaction.find(query)
      .populate('user', 'phone email')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const total = await Transaction.countDocuments(query);

    res.json({
      withdrawals,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalWithdrawals: total,
        perPage: limit
      }
    });
  } catch (error) {
    console.error('[Finance Controller] Get all withdrawals error:', error);
    res.status(500).json({ message: 'Failed to get withdrawals' });
  }
};

/**
 * Get transaction by ID
 */
const getTransactionById = async (req, res) => {
  try {
    const { transactionId } = req.params;

    const transaction = await Transaction.findById(transactionId)
      .populate('user', 'phone email fullName');

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    res.json({ transaction });
  } catch (error) {
    console.error('[Finance Controller] Get transaction by ID error:', error);
    res.status(500).json({ message: 'Failed to get transaction' });
  }
};

/**
 * Approve withdrawal
 */
const approveWithdrawal = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { notes } = req.body;

    const transaction = await Transaction.findById(transactionId).populate('user');

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    if (transaction.type !== 'withdrawal') {
      return res.status(400).json({ message: 'Transaction is not a withdrawal' });
    }

    if (transaction.status !== 'pending') {
      return res.status(400).json({ message: 'Withdrawal is not pending' });
    }

    transaction.status = 'completed';
    transaction.notes = notes;
    transaction.processedAt = new Date();
    await transaction.save();

    // Log audit
    await auditLogService.log({
      admin: req.user.id,
      adminName: req.user.fullName,
      adminRole: req.user.role,
      action: 'approve_withdrawal',
      actionDetails: notes || 'Withdrawal approved',
      targetType: 'withdrawal',
      targetId: transactionId,
      targetUser: transaction.user._id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      browser: req.headers['user-agent'],
      device: req.headers['user-agent'],
      metadata: {
        amount: transaction.amount,
        paymentMethod: transaction.paymentMethod
      }
    });

    res.json({ message: 'Withdrawal approved successfully', transaction });
  } catch (error) {
    console.error('[Finance Controller] Approve withdrawal error:', error);
    res.status(500).json({ message: 'Failed to approve withdrawal' });
  }
};

/**
 * Reject withdrawal
 */
const rejectWithdrawal = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { reason, notes } = req.body;

    if (!reason) {
      return res.status(400).json({ message: 'Rejection reason is required' });
    }

    const transaction = await Transaction.findById(transactionId).populate('user');

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    if (transaction.type !== 'withdrawal') {
      return res.status(400).json({ message: 'Transaction is not a withdrawal' });
    }

    if (transaction.status !== 'pending') {
      return res.status(400).json({ message: 'Withdrawal is not pending' });
    }

    transaction.status = 'rejected';
    transaction.rejectionReason = reason;
    transaction.notes = notes;
    transaction.processedAt = new Date();
    await transaction.save();

    // Refund user balance
    const user = await User.findById(transaction.user._id);
    if (user) {
      user.balance += transaction.amount;
      await user.save();
    }

    // Log audit
    await auditLogService.log({
      admin: req.user.id,
      adminName: req.user.fullName,
      adminRole: req.user.role,
      action: 'reject_withdrawal',
      actionDetails: `Reason: ${reason}. ${notes || ''}`,
      targetType: 'withdrawal',
      targetId: transactionId,
      targetUser: transaction.user._id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      browser: req.headers['user-agent'],
      device: req.headers['user-agent'],
      metadata: {
        amount: transaction.amount,
        paymentMethod: transaction.paymentMethod
      }
    });

    res.json({ message: 'Withdrawal rejected successfully', transaction });
  } catch (error) {
    console.error('[Finance Controller] Reject withdrawal error:', error);
    res.status(500).json({ message: 'Failed to reject withdrawal' });
  }
};

/**
 * Hold withdrawal
 */
const holdWithdrawal = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { notes } = req.body;

    const transaction = await Transaction.findById(transactionId);

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    if (transaction.type !== 'withdrawal') {
      return res.status(400).json({ message: 'Transaction is not a withdrawal' });
    }

    if (transaction.status !== 'pending') {
      return res.status(400).json({ message: 'Withdrawal is not pending' });
    }

    transaction.status = 'on_hold';
    transaction.notes = notes;
    await transaction.save();

    res.json({ message: 'Withdrawal placed on hold', transaction });
  } catch (error) {
    console.error('[Finance Controller] Hold withdrawal error:', error);
    res.status(500).json({ message: 'Failed to hold withdrawal' });
  }
};

/**
 * Get finance statistics
 */
const getFinanceStatistics = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayDeposits = await Transaction.aggregate([
      {
        $match: {
          type: 'deposit',
          status: 'completed',
          createdAt: { $gte: today }
        }
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    const todayWithdrawals = await Transaction.aggregate([
      {
        $match: {
          type: 'withdrawal',
          status: 'completed',
          createdAt: { $gte: today }
        }
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    const pendingWithdrawals = await Transaction.countDocuments({
      type: 'withdrawal',
      status: 'pending'
    });

    const stats = {
      todayDeposits: todayDeposits[0] || { totalAmount: 0, count: 0 },
      todayWithdrawals: todayWithdrawals[0] || { totalAmount: 0, count: 0 },
      pendingWithdrawals
    };

    res.json({ statistics: stats });
  } catch (error) {
    console.error('[Finance Controller] Get statistics error:', error);
    res.status(500).json({ message: 'Failed to get finance statistics' });
  }
};

module.exports = {
  getAllDeposits,
  getAllWithdrawals,
  getTransactionById,
  approveWithdrawal,
  rejectWithdrawal,
  holdWithdrawal,
  getFinanceStatistics
};
