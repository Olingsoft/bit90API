'use strict';

const AuditLog = require('../models/AuditLog');
const { createNotification } = require('../controllers/notificationController');

/**
 * Audit Log Service
 * Records all admin actions for security and compliance
 */
const auditLogService = {
  /**
   * Log an admin action
   */
  log: async (data) => {
    try {
      const auditLog = await AuditLog.create(data);
      
      // Create notification for critical actions
      if (['approve_withdrawal', 'reject_withdrawal', 'suspend_user', 'freeze_user'].includes(data.action)) {
        await createNotification({
          recipient: data.admin,
          type: 'system_alert',
          title: `Action Logged: ${data.action}`,
          message: data.actionDetails || `Admin ${data.adminName} performed ${data.action}`,
          priority: 'high',
          relatedType: data.targetType,
          relatedId: data.targetId,
          metadata: data.metadata
        });
      }
      
      return auditLog;
    } catch (error) {
      console.error('[Audit Log Service] Error logging action:', error);
      // Don't throw error - audit logging should not break the main flow
      return null;
    }
  },

  /**
   * Get audit logs with filters
   */
  getLogs: async (filters = {}) => {
    try {
      const {
        adminId,
        action,
        targetType,
        targetId,
        startDate,
        endDate,
        page = 1,
        limit = 50
      } = filters;

      const query = {};
      
      if (adminId) query.admin = adminId;
      if (action) query.action = action;
      if (targetType) query.targetType = targetType;
      if (targetId) query.targetId = targetId;
      
      if (startDate || endDate) {
        query.timestamp = {};
        if (startDate) query.timestamp.$gte = new Date(startDate);
        if (endDate) query.timestamp.$lte = new Date(endDate);
      }

      const skip = (page - 1) * limit;

      const logs = await AuditLog.find(query)
        .populate('admin', 'fullName username')
        .populate('targetUser', 'phone email')
        .populate('targetAdmin', 'fullName username')
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit);

      const total = await AuditLog.countDocuments(query);

      return {
        logs,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalLogs: total,
          perPage: limit
        }
      };
    } catch (error) {
      console.error('[Audit Log Service] Error getting logs:', error);
      throw error;
    }
  },

  /**
   * Get audit logs for a specific admin
   */
  getAdminLogs: async (adminId, page = 1, limit = 50) => {
    return auditLogService.getLogs({ adminId, page, limit });
  },

  /**
   * Get audit logs for a specific target user
   */
  getUserLogs: async (userId, page = 1, limit = 50) => {
    return auditLogService.getLogs({ targetId: userId, targetType: 'user', page, limit });
  },

  /**
   * Get audit logs by action type
   */
  getLogsByAction: async (action, page = 1, limit = 50) => {
    return auditLogService.getLogs({ action, page, limit });
  },

  /**
   * Get audit log statistics
   */
  getStatistics: async (startDate, endDate) => {
    try {
      const matchQuery = {};
      if (startDate || endDate) {
        matchQuery.timestamp = {};
        if (startDate) matchQuery.timestamp.$gte = new Date(startDate);
        if (endDate) matchQuery.timestamp.$lte = new Date(endDate);
      }

      const actionStats = await AuditLog.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: '$action',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } }
      ]);

      const adminStats = await AuditLog.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: '$admin',
            adminName: { $first: '$adminName' },
            adminRole: { $first: '$adminRole' },
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]);

      const totalActions = await AuditLog.countDocuments(matchQuery);

      return {
        totalActions,
        byAction: actionStats,
        topAdmins: adminStats
      };
    } catch (error) {
      console.error('[Audit Log Service] Error getting statistics:', error);
      throw error;
    }
  }
};

module.exports = { auditLogService };
