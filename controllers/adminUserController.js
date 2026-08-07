'use strict';

const Admin = require('../models/Admin');
const User = require('../models/User');
const { auditLogService } = require('../services/auditLogService');

/**
 * Get all users with pagination and filters
 */
const getAllUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};
    
    if (search) {
      query.$or = [
        { phone: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (status) {
      query.status = status;
    }

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const users = await User.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .select('-password');

    const total = await User.countDocuments(query);

    res.json({
      users,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalUsers: total,
        perPage: limit
      }
    });
  } catch (error) {
    console.error('[Admin User] Get all users error:', error);
    res.status(500).json({ message: 'Failed to get users' });
  }
};

/**
 * Get user by ID
 */
const getUserById = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('[Admin User] Get user by ID error:', error);
    res.status(500).json({ message: 'Failed to get user' });
  }
};

/**
 * Update user
 */
const updateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const updates = req.body;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    Object.assign(user, updates);
    await user.save();

    // Log audit
    await auditLogService.log({
      admin: req.user.id,
      adminName: req.user.fullName,
      adminRole: req.user.role,
      action: 'other',
      actionDetails: `Updated user ${userId}`,
      targetType: 'user',
      targetId: userId,
      targetUser: userId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      browser: req.headers['user-agent'],
      device: req.headers['user-agent']
    });

    res.json({ message: 'User updated successfully', user });
  } catch (error) {
    console.error('[Admin User] Update user error:', error);
    res.status(500).json({ message: 'Failed to update user' });
  }
};

/**
 * Freeze user account
 */
const freezeUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.status = 'frozen';
    user.freezeReason = reason;
    user.frozenAt = new Date();
    await user.save();

    // Log audit
    await auditLogService.log({
      admin: req.user.id,
      adminName: req.user.fullName,
      adminRole: req.user.role,
      action: 'freeze_user',
      actionDetails: reason || 'No reason provided',
      targetType: 'user',
      targetId: userId,
      targetUser: userId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      browser: req.headers['user-agent'],
      device: req.headers['user-agent']
    });

    res.json({ message: 'User frozen successfully' });
  } catch (error) {
    console.error('[Admin User] Freeze user error:', error);
    res.status(500).json({ message: 'Failed to freeze user' });
  }
};

/**
 * Suspend user account
 */
const suspendUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.status = 'suspended';
    user.suspensionReason = reason;
    user.suspendedAt = new Date();
    await user.save();

    // Log audit
    await auditLogService.log({
      admin: req.user.id,
      adminName: req.user.fullName,
      adminRole: req.user.role,
      action: 'suspend_user',
      actionDetails: reason || 'No reason provided',
      targetType: 'user',
      targetId: userId,
      targetUser: userId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      browser: req.headers['user-agent'],
      device: req.headers['user-agent']
    });

    res.json({ message: 'User suspended successfully' });
  } catch (error) {
    console.error('[Admin User] Suspend user error:', error);
    res.status(500).json({ message: 'Failed to suspend user' });
  }
};

/**
 * Activate user account
 */
const activateUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.status = 'active';
    user.freezeReason = undefined;
    user.frozenAt = undefined;
    user.suspensionReason = undefined;
    user.suspendedAt = undefined;
    await user.save();

    // Log audit
    await auditLogService.log({
      admin: req.user.id,
      adminName: req.user.fullName,
      adminRole: req.user.role,
      action: 'activate_user',
      targetType: 'user',
      targetId: userId,
      targetUser: userId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      browser: req.headers['user-agent'],
      device: req.headers['user-agent']
    });

    res.json({ message: 'User activated successfully' });
  } catch (error) {
    console.error('[Admin User] Activate user error:', error);
    res.status(500).json({ message: 'Failed to activate user' });
  }
};

/**
 * Reset user password
 */
const resetUserPassword = async (req, res) => {
  try {
    const { userId } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters' });
    }

    const user = await User.findById(userId).select('+password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.password = newPassword;
    await user.save();

    // Log audit
    await auditLogService.log({
      admin: req.user.id,
      adminName: req.user.fullName,
      adminRole: req.user.role,
      action: 'reset_user_password',
      targetType: 'user',
      targetId: userId,
      targetUser: userId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      browser: req.headers['user-agent'],
      device: req.headers['user-agent']
    });

    res.json({ message: 'User password reset successfully' });
  } catch (error) {
    console.error('[Admin User] Reset password error:', error);
    res.status(500).json({ message: 'Failed to reset user password' });
  }
};

/**
 * Get user betting history
 */
const getUserBettingHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const Bet = require('../models/Bet');
    
    const skip = (page - 1) * limit;

    const bets = await Bet.find({ user: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Bet.countDocuments({ user: userId });

    res.json({
      bets,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalBets: total,
        perPage: limit
      }
    });
  } catch (error) {
    console.error('[Admin User] Get betting history error:', error);
    res.status(500).json({ message: 'Failed to get betting history' });
  }
};

/**
 * Get user deposits
 */
const getUserDeposits = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const Transaction = require('../models/Transaction');
    
    const skip = (page - 1) * limit;

    const deposits = await Transaction.find({ 
      user: userId,
      type: 'deposit'
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Transaction.countDocuments({ 
      user: userId,
      type: 'deposit'
    });

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
    console.error('[Admin User] Get deposits error:', error);
    res.status(500).json({ message: 'Failed to get deposits' });
  }
};

/**
 * Get user withdrawals
 */
const getUserWithdrawals = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const Transaction = require('../models/Transaction');
    
    const skip = (page - 1) * limit;

    const withdrawals = await Transaction.find({ 
      user: userId,
      type: 'withdrawal'
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Transaction.countDocuments({ 
      user: userId,
      type: 'withdrawal'
    });

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
    console.error('[Admin User] Get withdrawals error:', error);
    res.status(500).json({ message: 'Failed to get withdrawals' });
  }
};

/**
 * Get user login history
 */
const getUserLoginHistory = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select('loginHistory');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ 
      loginHistory: user.loginHistory || [] 
    });
  } catch (error) {
    console.error('[Admin User] Get login history error:', error);
    res.status(500).json({ message: 'Failed to get login history' });
  }
};

/**
 * Get user referral information
 */
const getUserReferralInfo = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select('referralCode referredBy referralEarnings referralCount');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get users referred by this user
    const referredUsers = await User.find({ referredBy: userId })
      .select('phone referralCode createdAt')
      .limit(50);

    res.json({
      referralCode: user.referralCode,
      referredBy: user.referredBy,
      referralEarnings: user.referralEarnings || 0,
      referralCount: user.referralCount || 0,
      referredUsers
    });
  } catch (error) {
    console.error('[Admin User] Get referral info error:', error);
    res.status(500).json({ message: 'Failed to get referral information' });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  updateUser,
  freezeUser,
  suspendUser,
  activateUser,
  resetUserPassword,
  getUserBettingHistory,
  getUserDeposits,
  getUserWithdrawals,
  getUserLoginHistory,
  getUserReferralInfo
};
