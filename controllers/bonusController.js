'use strict';

const Bonus = require('../models/Bonus');
const { auditLogService } = require('../services/auditLogService');

/**
 * Get all bonuses with pagination and filters
 */
const getAllBonuses = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      type,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};
    
    if (type) {
      query.type = type;
    }
    
    if (status) {
      query.status = status;
    }

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const bonuses = await Bonus.find(query)
      .populate('createdBy', 'fullName username')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const total = await Bonus.countDocuments(query);

    res.json({
      bonuses,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalBonuses: total,
        perPage: limit
      }
    });
  } catch (error) {
    console.error('[Bonus Controller] Get all bonuses error:', error);
    res.status(500).json({ message: 'Failed to get bonuses' });
  }
};

/**
 * Get bonus by ID
 */
const getBonusById = async (req, res) => {
  try {
    const { bonusId } = req.params;

    const bonus = await Bonus.findById(bonusId)
      .populate('createdBy', 'fullName username')
      .populate('eligibleUsers', 'phone email');

    if (!bonus) {
      return res.status(404).json({ message: 'Bonus not found' });
    }

    res.json({ bonus });
  } catch (error) {
    console.error('[Bonus Controller] Get bonus by ID error:', error);
    res.status(500).json({ message: 'Failed to get bonus' });
  }
};

/**
 * Create bonus
 */
const createBonus = async (req, res) => {
  try {
    const bonusData = req.body;
    
    bonusData.createdBy = req.user.id;

    const bonus = await Bonus.create(bonusData);

    // Log audit
    await auditLogService.log({
      admin: req.user.id,
      adminName: req.user.fullName,
      adminRole: req.user.role,
      action: 'create_bonus',
      actionDetails: `Created bonus: ${bonus.name}`,
      targetType: 'bonus',
      targetId: bonus._id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      browser: req.headers['user-agent'],
      device: req.headers['user-agent'],
      metadata: {
        bonusName: bonus.name,
        bonusType: bonus.type,
        amount: bonus.amount
      }
    });

    res.status(201).json({ message: 'Bonus created successfully', bonus });
  } catch (error) {
    console.error('[Bonus Controller] Create bonus error:', error);
    res.status(500).json({ message: 'Failed to create bonus' });
  }
};

/**
 * Update bonus
 */
const updateBonus = async (req, res) => {
  try {
    const { bonusId } = req.params;
    const updates = req.body;

    const bonus = await Bonus.findById(bonusId);

    if (!bonus) {
      return res.status(404).json({ message: 'Bonus not found' });
    }

    Object.assign(bonus, updates);
    await bonus.save();

    // Log audit
    await auditLogService.log({
      admin: req.user.id,
      adminName: req.user.fullName,
      adminRole: req.user.role,
      action: 'update_bonus',
      actionDetails: `Updated bonus: ${bonus.name}`,
      targetType: 'bonus',
      targetId: bonusId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      browser: req.headers['user-agent'],
      device: req.headers['user-agent']
    });

    res.json({ message: 'Bonus updated successfully', bonus });
  } catch (error) {
    console.error('[Bonus Controller] Update bonus error:', error);
    res.status(500).json({ message: 'Failed to update bonus' });
  }
};

/**
 * Delete bonus
 */
const deleteBonus = async (req, res) => {
  try {
    const { bonusId } = req.params;

    const bonus = await Bonus.findById(bonusId);

    if (!bonus) {
      return res.status(404).json({ message: 'Bonus not found' });
    }

    await Bonus.findByIdAndDelete(bonusId);

    // Log audit
    await auditLogService.log({
      admin: req.user.id,
      adminName: req.user.fullName,
      adminRole: req.user.role,
      action: 'delete_bonus',
      actionDetails: `Deleted bonus: ${bonus.name}`,
      targetType: 'bonus',
      targetId: bonusId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      browser: req.headers['user-agent'],
      device: req.headers['user-agent']
    });

    res.json({ message: 'Bonus deleted successfully' });
  } catch (error) {
    console.error('[Bonus Controller] Delete bonus error:', error);
    res.status(500).json({ message: 'Failed to delete bonus' });
  }
};

/**
 * Get bonus statistics
 */
const getBonusStatistics = async (req, res) => {
  try {
    const stats = await Bonus.aggregate([
      {
        $group: {
          _id: '$type',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
          totalIssued: { $sum: '$totalIssued' },
          totalUsed: { $sum: '$totalUsed' }
        }
      }
    ]);

    const statistics = {
      welcome: { totalAmount: 0, count: 0, totalIssued: 0, totalUsed: 0 },
      deposit: { totalAmount: 0, count: 0, totalIssued: 0, totalUsed: 0 },
      cashback: { totalAmount: 0, count: 0, totalIssued: 0, totalUsed: 0 },
      referral: { totalAmount: 0, count: 0, totalIssued: 0, totalUsed: 0 },
      vip: { totalAmount: 0, count: 0, totalIssued: 0, totalUsed: 0 },
      promo_code: { totalAmount: 0, count: 0, totalIssued: 0, totalUsed: 0 }
    };

    stats.forEach(stat => {
      if (statistics[stat._id]) {
        statistics[stat._id] = stat;
      }
    });

    res.json({ statistics });
  } catch (error) {
    console.error('[Bonus Controller] Get statistics error:', error);
    res.status(500).json({ message: 'Failed to get bonus statistics' });
  }
};

module.exports = {
  getAllBonuses,
  getBonusById,
  createBonus,
  updateBonus,
  deleteBonus,
  getBonusStatistics
};
