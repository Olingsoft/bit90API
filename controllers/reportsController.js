'use strict';

const User = require('../models/User');
const Bet = require('../models/Bet');
const Transaction = require('../models/Transaction');
const Round = require('../models/Round');
const Bonus = require('../models/Bonus');

/**
 * Generate revenue report
 */
const generateRevenueReport = async (req, res) => {
  try {
    const { startDate, endDate, period = 'daily' } = req.query;

    const matchQuery = {};
    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
      if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
    }

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
      { $match: matchQuery },
      {
        $group: {
          _id: groupBy,
          revenue: { $sum: '$houseProfit' },
          totalBets: { $sum: 1 },
          totalBetAmount: { $sum: '$totalBetAmount' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({ 
      report: 'revenue',
      period,
      data: revenueData 
    });
  } catch (error) {
    console.error('[Reports Controller] Generate revenue report error:', error);
    res.status(500).json({ message: 'Failed to generate revenue report' });
  }
};

/**
 * Generate deposits report
 */
const generateDepositsReport = async (req, res) => {
  try {
    const { startDate, endDate, paymentMethod, status, period = 'daily' } = req.query;

    const matchQuery = { type: 'deposit' };
    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
      if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
    }
    if (paymentMethod) matchQuery.paymentMethod = paymentMethod;
    if (status) matchQuery.status = status;

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

    const depositData = await Transaction.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: groupBy,
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
          avgAmount: { $avg: '$amount' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({ 
      report: 'deposits',
      period,
      data: depositData 
    });
  } catch (error) {
    console.error('[Reports Controller] Generate deposits report error:', error);
    res.status(500).json({ message: 'Failed to generate deposits report' });
  }
};

/**
 * Generate withdrawals report
 */
const generateWithdrawalsReport = async (req, res) => {
  try {
    const { startDate, endDate, paymentMethod, status, period = 'daily' } = req.query;

    const matchQuery = { type: 'withdrawal' };
    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
      if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
    }
    if (paymentMethod) matchQuery.paymentMethod = paymentMethod;
    if (status) matchQuery.status = status;

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

    const withdrawalData = await Transaction.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: groupBy,
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
          avgAmount: { $avg: '$amount' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({ 
      report: 'withdrawals',
      period,
      data: withdrawalData 
    });
  } catch (error) {
    console.error('[Reports Controller] Generate withdrawals report error:', error);
    res.status(500).json({ message: 'Failed to generate withdrawals report' });
  }
};

/**
 * Generate bets report
 */
const generateBetsReport = async (req, res) => {
  try {
    const { startDate, endDate, period = 'daily' } = req.query;

    const matchQuery = {};
    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
      if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
    }

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
      { $match: matchQuery },
      {
        $group: {
          _id: groupBy,
          totalBets: { $sum: 1 },
          totalBetAmount: { $sum: '$amount' },
          totalWinAmount: { $sum: '$winAmount' },
          totalLoss: { $sum: { $cond: [{ $eq: ['$status', 'lost'] }, '$amount', 0] } },
          totalWin: { $sum: { $cond: [{ $eq: ['$status', 'won'] }, '$winAmount', 0] } }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({ 
      report: 'bets',
      period,
      data: betsData 
    });
  } catch (error) {
    console.error('[Reports Controller] Generate bets report error:', error);
    res.status(500).json({ message: 'Failed to generate bets report' });
  }
};

/**
 * Generate users report
 */
const generateUsersReport = async (req, res) => {
  try {
    const { startDate, endDate, period = 'daily' } = req.query;

    const matchQuery = {};
    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
      if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
    }

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
      { $match: matchQuery },
      {
        $group: {
          _id: groupBy,
          newUsers: { $sum: 1 },
          activeUsers: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({ 
      report: 'users',
      period,
      data: usersData 
    });
  } catch (error) {
    console.error('[Reports Controller] Generate users report error:', error);
    res.status(500).json({ message: 'Failed to generate users report' });
  }
};

/**
 * Generate bonus costs report
 */
const generateBonusCostsReport = async (req, res) => {
  try {
    const { startDate, endDate, period = 'daily' } = req.query;

    const matchQuery = {};
    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
      if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
    }

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

    const bonusData = await Bonus.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: groupBy,
          totalBonusAmount: { $sum: '$amount' },
          totalIssued: { $sum: '$totalIssued' },
          totalUsed: { $sum: '$totalUsed' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({ 
      report: 'bonus_costs',
      period,
      data: bonusData 
    });
  } catch (error) {
    console.error('[Reports Controller] Generate bonus costs report error:', error);
    res.status(500).json({ message: 'Failed to generate bonus costs report' });
  }
};

/**
 * Export report as CSV
 */
const exportReportCSV = async (req, res) => {
  try {
    const { reportType, startDate, endDate } = req.query;

    let data;
    let filename;

    switch (reportType) {
      case 'revenue':
        const revenueResult = await generateRevenueReport({ query: { startDate, endDate, period: 'daily' } });
        data = revenueResult.data;
        filename = 'revenue_report.csv';
        break;
      case 'deposits':
        const depositsResult = await generateDepositsReport({ query: { startDate, endDate, period: 'daily' } });
        data = depositsResult.data;
        filename = 'deposits_report.csv';
        break;
      case 'withdrawals':
        const withdrawalsResult = await generateWithdrawalsReport({ query: { startDate, endDate, period: 'daily' } });
        data = withdrawalsResult.data;
        filename = 'withdrawals_report.csv';
        break;
      case 'bets':
        const betsResult = await generateBetsReport({ query: { startDate, endDate, period: 'daily' } });
        data = betsResult.data;
        filename = 'bets_report.csv';
        break;
      default:
        return res.status(400).json({ message: 'Invalid report type' });
    }

    // Convert to CSV
    const csv = convertToCSV(data);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error) {
    console.error('[Reports Controller] Export CSV error:', error);
    res.status(500).json({ message: 'Failed to export report' });
  }
};

/**
 * Convert data to CSV format
 */
const convertToCSV = (data) => {
  if (!data || data.length === 0) return 'No data available';

  const headers = Object.keys(data[0]).join(',');
  const rows = data.map(row => 
    Object.values(row).map(value => 
      typeof value === 'object' ? JSON.stringify(value) : value
    ).join(',')
  );

  return [headers, ...rows].join('\n');
};

module.exports = {
  generateRevenueReport,
  generateDepositsReport,
  generateWithdrawalsReport,
  generateBetsReport,
  generateUsersReport,
  generateBonusCostsReport,
  exportReportCSV
};
