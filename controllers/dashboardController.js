'use strict';

const User = require('../models/User');
const Bet = require('../models/Bet');
const Transaction = require('../models/Transaction');
const KYC = require('../models/KYC');
const Bonus = require('../models/Bonus');
const SupportTicket = require('../models/SupportTicket');
const Round = require('../models/Round');

/**
 * Get dashboard statistics
 */
const getDashboardStatistics = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // User statistics
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ status: 'active' });
    const onlineUsers = await User.countDocuments({ 
      lastSeen: { $gte: new Date(Date.now() - 5 * 60 * 1000) }
    });
    const newUsersToday = await User.countDocuments({ createdAt: { $gte: today } });

    // Financial statistics
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

    // KYC statistics
    const pendingKYC = await KYC.countDocuments({ status: 'pending' });

    // Betting statistics
    const totalBets = await Bet.countDocuments();
    const todayBets = await Bet.countDocuments({ createdAt: { $gte: today } });

    // Revenue statistics
    const totalRevenue = await Round.aggregate([
      {
        $group: {
          _id: null,
          totalHouseProfit: { $sum: '$houseProfit' }
        }
      }
    ]);

    const todayRevenue = await Round.aggregate([
      {
        $match: { createdAt: { $gte: today } }
      },
      {
        $group: {
          _id: null,
          totalHouseProfit: { $sum: '$houseProfit' }
        }
      }
    ]);

    // Bonus statistics
    const totalBonusesIssued = await Bonus.aggregate([
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    // Support ticket statistics
    const openTickets = await SupportTicket.countDocuments({ 
      status: { $in: ['open', 'in_progress'] }
    });

    // Referral statistics
    const totalReferrals = await User.countDocuments({ referredBy: { $ne: null } });

    const statistics = {
      users: {
        total: totalUsers,
        active: activeUsers,
        online: onlineUsers,
        newToday: newUsersToday
      },
      finance: {
        todayDeposits: todayDeposits[0] || { totalAmount: 0, count: 0 },
        todayWithdrawals: todayWithdrawals[0] || { totalAmount: 0, count: 0 },
        pendingWithdrawals
      },
      kyc: {
        pending: pendingKYC
      },
      betting: {
        total: totalBets,
        today: todayBets
      },
      revenue: {
        total: totalRevenue[0]?.totalHouseProfit || 0,
        today: todayRevenue[0]?.totalHouseProfit || 0
      },
      bonuses: {
        totalIssued: totalBonusesIssued[0]?.totalAmount || 0
      },
      support: {
        openTickets
      },
      referrals: {
        total: totalReferrals
      }
    };

    res.json({ statistics });
  } catch (error) {
    console.error('[Dashboard Controller] Get statistics error:', error);
    res.status(500).json({ message: 'Failed to get dashboard statistics' });
  }
};

/**
 * Get revenue chart data
 */
const getRevenueChart = async (req, res) => {
  try {
    const { period = 'daily' } = req.query;
    
    let groupBy;
    if (period === 'daily') {
      groupBy = {
        $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
      };
    } else if (period === 'monthly') {
      groupBy = {
        $dateToString: { format: '%Y-%m', date: '$createdAt' }
      };
    } else {
      groupBy = {
        $dateToString: { format: '%Y-%U', date: '$createdAt' }
      };
    }

    const revenueData = await Round.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: groupBy,
          revenue: { $sum: '$houseProfit' },
          bets: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    res.json({ data: revenueData });
  } catch (error) {
    console.error('[Dashboard Controller] Get revenue chart error:', error);
    res.status(500).json({ message: 'Failed to get revenue chart data' });
  }
};

/**
 * Get bets chart data
 */
const getBetsChart = async (req, res) => {
  try {
    const { period = 'daily' } = req.query;
    
    let groupBy;
    if (period === 'daily') {
      groupBy = {
        $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
      };
    } else if (period === 'monthly') {
      groupBy = {
        $dateToString: { format: '%Y-%m', date: '$createdAt' }
      };
    } else {
      groupBy = {
        $dateToString: { format: '%Y-%U', date: '$createdAt' }
      };
    }

    const betsData = await Bet.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: groupBy,
          totalBets: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          totalWinAmount: { $sum: '$winAmount' }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    res.json({ data: betsData });
  } catch (error) {
    console.error('[Dashboard Controller] Get bets chart error:', error);
    res.status(500).json({ message: 'Failed to get bets chart data' });
  }
};

/**
 * Get deposits vs withdrawals chart data
 */
const getDepositsWithdrawalsChart = async (req, res) => {
  try {
    const { period = 'daily' } = req.query;
    
    let groupBy;
    if (period === 'daily') {
      groupBy = {
        $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
      };
    } else if (period === 'monthly') {
      groupBy = {
        $dateToString: { format: '%Y-%m', date: '$createdAt' }
      };
    } else {
      groupBy = {
        $dateToString: { format: '%Y-%U', date: '$createdAt' }
      };
    }

    const deposits = await Transaction.aggregate([
      {
        $match: {
          type: 'deposit',
          status: 'completed',
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: groupBy,
          amount: { $sum: '$amount' }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    const withdrawals = await Transaction.aggregate([
      {
        $match: {
          type: 'withdrawal',
          status: 'completed',
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: groupBy,
          amount: { $sum: '$amount' }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    res.json({ 
      deposits,
      withdrawals
    });
  } catch (error) {
    console.error('[Dashboard Controller] Get deposits/withdrawals chart error:', error);
    res.status(500).json({ message: 'Failed to get deposits/withdrawals chart data' });
  }
};

/**
 * Get new users chart data
 */
const getNewUsersChart = async (req, res) => {
  try {
    const { period = 'daily' } = req.query;
    
    let groupBy;
    if (period === 'daily') {
      groupBy = {
        $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
      };
    } else if (period === 'monthly') {
      groupBy = {
        $dateToString: { format: '%Y-%m', date: '$createdAt' }
      };
    } else {
      groupBy = {
        $dateToString: { format: '%Y-%U', date: '$createdAt' }
      };
    }

    const usersData = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: groupBy,
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    res.json({ data: usersData });
  } catch (error) {
    console.error('[Dashboard Controller] Get new users chart error:', error);
    res.status(500).json({ message: 'Failed to get new users chart data' });
  }
};

/**
 * Get monthly profit chart data
 */
const getMonthlyProfitChart = async (req, res) => {
  try {
    const profitData = await Round.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(Date.now() - 12 * 30 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          profit: { $sum: '$houseProfit' },
          totalBets: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);

    res.json({ data: profitData });
  } catch (error) {
    console.error('[Dashboard Controller] Get monthly profit chart error:', error);
    res.status(500).json({ message: 'Failed to get monthly profit chart data' });
  }
};

module.exports = {
  getDashboardStatistics,
  getRevenueChart,
  getBetsChart,
  getDepositsWithdrawalsChart,
  getNewUsersChart,
  getMonthlyProfitChart
};
