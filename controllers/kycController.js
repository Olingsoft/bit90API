'use strict';

const KYC = require('../models/KYC');
const User = require('../models/User');
const { auditLogService } = require('../services/auditLogService');

/**
 * Get all KYC submissions with pagination and filters
 */
const getAllKYC = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      documentType,
      sortBy = 'submittedAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};
    
    if (status) {
      query.status = status;
    }
    
    if (documentType) {
      query.documentType = documentType;
    }

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const kycSubmissions = await KYC.find(query)
      .populate('user', 'phone email')
      .populate('reviewedBy', 'fullName username')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const total = await KYC.countDocuments(query);

    res.json({
      kycSubmissions,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalSubmissions: total,
        perPage: limit
      }
    });
  } catch (error) {
    console.error('[KYC Controller] Get all KYC error:', error);
    res.status(500).json({ message: 'Failed to get KYC submissions' });
  }
};

/**
 * Get KYC by ID
 */
const getKYCById = async (req, res) => {
  try {
    const { kycId } = req.params;

    const kyc = await KYC.findById(kycId)
      .populate('user', 'phone email fullName')
      .populate('reviewedBy', 'fullName username');

    if (!kyc) {
      return res.status(404).json({ message: 'KYC submission not found' });
    }

    res.json({ kyc });
  } catch (error) {
    console.error('[KYC Controller] Get KYC by ID error:', error);
    res.status(500).json({ message: 'Failed to get KYC submission' });
  }
};

/**
 * Get KYC by user ID
 */
const getKYCByUserId = async (req, res) => {
  try {
    const { userId } = req.params;

    const kyc = await KYC.findOne({ user: userId })
      .populate('user', 'phone email fullName')
      .populate('reviewedBy', 'fullName username');

    if (!kyc) {
      return res.status(404).json({ message: 'KYC submission not found' });
    }

    res.json({ kyc });
  } catch (error) {
    console.error('[KYC Controller] Get KYC by user ID error:', error);
    res.status(500).json({ message: 'Failed to get KYC submission' });
  }
};

/**
 * Approve KYC
 */
const approveKYC = async (req, res) => {
  try {
    const { kycId } = req.params;
    const { notes } = req.body;

    const kyc = await KYC.findById(kycId).populate('user');

    if (!kyc) {
      return res.status(404).json({ message: 'KYC submission not found' });
    }

    if (kyc.status === 'approved') {
      return res.status(400).json({ message: 'KYC already approved' });
    }

    kyc.status = 'approved';
    kyc.reviewedBy = req.user.id;
    kyc.reviewedAt = new Date();
    kyc.notes = notes;
    await kyc.save();

    // Update user KYC status
    const user = await User.findById(kyc.user._id);
    if (user) {
      user.kycStatus = 'approved';
      user.kycVerifiedAt = new Date();
      await user.save();
    }

    // Log audit
    await auditLogService.log({
      admin: req.user.id,
      adminName: req.user.fullName,
      adminRole: req.user.role,
      action: 'approve_kyc',
      actionDetails: notes || 'KYC approved',
      targetType: 'kyc',
      targetId: kycId,
      targetUser: kyc.user._id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      browser: req.headers['user-agent'],
      device: req.headers['user-agent']
    });

    res.json({ message: 'KYC approved successfully', kyc });
  } catch (error) {
    console.error('[KYC Controller] Approve KYC error:', error);
    res.status(500).json({ message: 'Failed to approve KYC' });
  }
};

/**
 * Reject KYC
 */
const rejectKYC = async (req, res) => {
  try {
    const { kycId } = req.params;
    const { reason, notes } = req.body;

    if (!reason) {
      return res.status(400).json({ message: 'Rejection reason is required' });
    }

    const kyc = await KYC.findById(kycId).populate('user');

    if (!kyc) {
      return res.status(404).json({ message: 'KYC submission not found' });
    }

    kyc.status = 'rejected';
    kyc.reviewedBy = req.user.id;
    kyc.reviewedAt = new Date();
    kyc.rejectionReason = reason;
    kyc.notes = notes;
    await kyc.save();

    // Update user KYC status
    const user = await User.findById(kyc.user._id);
    if (user) {
      user.kycStatus = 'rejected';
      await user.save();
    }

    // Log audit
    await auditLogService.log({
      admin: req.user.id,
      adminName: req.user.fullName,
      adminRole: req.user.role,
      action: 'reject_kyc',
      actionDetails: `Reason: ${reason}. ${notes || ''}`,
      targetType: 'kyc',
      targetId: kycId,
      targetUser: kyc.user._id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      browser: req.headers['user-agent'],
      device: req.headers['user-agent']
    });

    res.json({ message: 'KYC rejected successfully', kyc });
  } catch (error) {
    console.error('[KYC Controller] Reject KYC error:', error);
    res.status(500).json({ message: 'Failed to reject KYC' });
  }
};

/**
 * Request KYC resubmission
 */
const requestKYCResubmission = async (req, res) => {
  try {
    const { kycId } = req.params;
    const { reason, notes } = req.body;

    if (!reason) {
      return res.status(400).json({ message: 'Reason is required' });
    }

    const kyc = await KYC.findById(kycId).populate('user');

    if (!kyc) {
      return res.status(404).json({ message: 'KYC submission not found' });
    }

    kyc.status = 'resubmission_requested';
    kyc.reviewedBy = req.user.id;
    kyc.reviewedAt = new Date();
    kyc.rejectionReason = reason;
    kyc.notes = notes;
    await kyc.save();

    // Update user KYC status
    const user = await User.findById(kyc.user._id);
    if (user) {
      user.kycStatus = 'pending';
      await user.save();
    }

    // Log audit
    await auditLogService.log({
      admin: req.user.id,
      adminName: req.user.fullName,
      adminRole: req.user.role,
      action: 'request_kyc_resubmission',
      actionDetails: `Reason: ${reason}. ${notes || ''}`,
      targetType: 'kyc',
      targetId: kycId,
      targetUser: kyc.user._id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      browser: req.headers['user-agent'],
      device: req.headers['user-agent']
    });

    res.json({ message: 'KYC resubmission requested successfully', kyc });
  } catch (error) {
    console.error('[KYC Controller] Request resubmission error:', error);
    res.status(500).json({ message: 'Failed to request KYC resubmission' });
  }
};

/**
 * Get KYC statistics
 */
const getKYCStatistics = async (req, res) => {
  try {
    const stats = await KYC.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const statistics = {
      pending: 0,
      approved: 0,
      rejected: 0,
      resubmission_requested: 0,
      total: 0
    };

    stats.forEach(stat => {
      statistics[stat._id] = stat.count;
      statistics.total += stat.count;
    });

    res.json({ statistics });
  } catch (error) {
    console.error('[KYC Controller] Get statistics error:', error);
    res.status(500).json({ message: 'Failed to get KYC statistics' });
  }
};

module.exports = {
  getAllKYC,
  getKYCById,
  getKYCByUserId,
  approveKYC,
  rejectKYC,
  requestKYCResubmission,
  getKYCStatistics
};
