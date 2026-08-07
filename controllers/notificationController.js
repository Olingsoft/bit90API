'use strict';

const Notification = require('../models/Notification');

/**
 * Get all notifications for current admin
 */
const getNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20, unreadOnly = false } = req.query;

    const query = { recipient: req.user.id };
    
    if (unreadOnly === 'true') {
      query.isRead = false;
    }

    const skip = (page - 1) * limit;

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.countDocuments({ 
      recipient: req.user.id, 
      isRead: false 
    });

    res.json({
      notifications,
      unreadCount,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalNotifications: total,
        perPage: limit
      }
    });
  } catch (error) {
    console.error('[Notification Controller] Get notifications error:', error);
    res.status(500).json({ message: 'Failed to get notifications' });
  }
};

/**
 * Mark notification as read
 */
const markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;

    const notification = await Notification.findOne({
      _id: notificationId,
      recipient: req.user.id
    });

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();

    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('[Notification Controller] Mark as read error:', error);
    res.status(500).json({ message: 'Failed to mark notification as read' });
  }
};

/**
 * Mark all notifications as read
 */
const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user.id, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('[Notification Controller] Mark all as read error:', error);
    res.status(500).json({ message: 'Failed to mark all notifications as read' });
  }
};

/**
 * Delete notification
 */
const deleteNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;

    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      recipient: req.user.id
    });

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json({ message: 'Notification deleted' });
  } catch (error) {
    console.error('[Notification Controller] Delete notification error:', error);
    res.status(500).json({ message: 'Failed to delete notification' });
  }
};

/**
 * Create notification (internal use)
 */
const createNotification = async (data) => {
  try {
    const notification = await Notification.create(data);
    return notification;
  } catch (error) {
    console.error('[Notification Controller] Create notification error:', error);
    throw error;
  }
};

/**
 * Send notification multiple admins
 */
const sendBulkNotifications = async (recipientIds, notificationData) => {
  try {
    const notifications = recipientIds.map(recipientId => ({
      ...notificationData,
      recipient: recipientId
    }));

    const result = await Notification.insertMany(notifications);
    return result;
  } catch (error) {
    console.error('[Notification Controller] Send bulk notifications error:', error);
    throw error;
  }
};

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  createNotification,
  sendBulkNotifications
};
