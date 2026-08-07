'use strict';

const SupportTicket = require('../models/SupportTicket');
const { auditLogService } = require('../services/auditLogService');

/**
 * Get all support tickets with pagination and filters
 */
const getAllTickets = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      priority,
      category,
      assignedTo,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};
    
    if (status) {
      query.status = status;
    }
    
    if (priority) {
      query.priority = priority;
    }
    
    if (category) {
      query.category = category;
    }
    
    if (assignedTo) {
      query.assignedTo = assignedTo;
    }

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const tickets = await SupportTicket.find(query)
      .populate('user', 'phone email')
      .populate('assignedTo', 'fullName username')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const total = await SupportTicket.countDocuments(query);

    res.json({
      tickets,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalTickets: total,
        perPage: limit
      }
    });
  } catch (error) {
    console.error('[Support Controller] Get all tickets error:', error);
    res.status(500).json({ message: 'Failed to get support tickets' });
  }
};

/**
 * Get ticket by ID
 */
const getTicketById = async (req, res) => {
  try {
    const { ticketId } = req.params;

    const ticket = await SupportTicket.findById(ticketId)
      .populate('user', 'phone email fullName')
      .populate('assignedTo', 'fullName username')
      .populate('messages.sender');

    if (!ticket) {
      return res.status(404).json({ message: 'Support ticket not found' });
    }

    res.json({ ticket });
  } catch (error) {
    console.error('[Support Controller] Get ticket by ID error:', error);
    res.status(500).json({ message: 'Failed to get support ticket' });
  }
};

/**
 * Create support ticket (admin can create on behalf of user)
 */
const createTicket = async (req, res) => {
  try {
    const { userId, subject, category, priority, message } = req.body;

    if (!userId || !subject || !category || !message) {
      return res.status(400).json({ 
        message: 'User ID, subject, category, and message are required' 
      });
    }

    const ticket = await SupportTicket.create({
      user: userId,
      subject,
      category,
      priority: priority || 'medium',
      messages: [{
        sender: req.user.id,
        senderModel: 'Admin',
        message,
        createdAt: new Date()
      }]
    });

    res.status(201).json({ message: 'Support ticket created successfully', ticket });
  } catch (error) {
    console.error('[Support Controller] Create ticket error:', error);
    res.status(500).json({ message: 'Failed to create support ticket' });
  }
};

/**
 * Add message to ticket
 */
const addMessage = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { message, attachments, isInternal } = req.body;

    if (!message) {
      return res.status(400).json({ message: 'Message is required' });
    }

    const ticket = await SupportTicket.findById(ticketId);

    if (!ticket) {
      return res.status(404).json({ message: 'Support ticket not found' });
    }

    ticket.messages.push({
      sender: req.user.id,
      senderModel: 'Admin',
      message,
      attachments: attachments || [],
      isInternal: isInternal || false,
      createdAt: new Date()
    });

    // Update status if adding first admin message
    if (ticket.status === 'open') {
      ticket.status = 'in_progress';
    }

    await ticket.save();

    res.json({ message: 'Message added successfully', ticket });
  } catch (error) {
    console.error('[Support Controller] Add message error:', error);
    res.status(500).json({ message: 'Failed to add message' });
  }
};

/**
 * Assign ticket to admin
 */
const assignTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { adminId } = req.body;

    if (!adminId) {
      return res.status(400).json({ message: 'Admin ID is required' });
    }

    const ticket = await SupportTicket.findById(ticketId);

    if (!ticket) {
      return res.status(404).json({ message: 'Support ticket not found' });
    }

    ticket.assignedTo = adminId;
    ticket.assignedAt = new Date();
    ticket.status = 'in_progress';
    await ticket.save();

    res.json({ message: 'Ticket assigned successfully', ticket });
  } catch (error) {
    console.error('[Support Controller] Assign ticket error:', error);
    res.status(500).json({ message: 'Failed to assign ticket' });
  }
};

/**
 * Resolve ticket
 */
const resolveTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { resolution } = req.body;

    const ticket = await SupportTicket.findById(ticketId);

    if (!ticket) {
      return res.status(404).json({ message: 'Support ticket not found' });
    }

    ticket.status = 'resolved';
    ticket.resolvedBy = req.user.id;
    ticket.resolvedAt = new Date();
    ticket.resolution = resolution;
    await ticket.save();

    // Log audit
    await auditLogService.log({
      admin: req.user.id,
      adminName: req.user.fullName,
      adminRole: req.user.role,
      action: 'resolve_ticket',
      actionDetails: `Resolved ticket: ${ticket.ticketNumber}`,
      targetType: 'ticket',
      targetId: ticketId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      browser: req.headers['user-agent'],
      device: req.headers['user-agent'],
      metadata: {
        ticketNumber: ticket.ticketNumber,
        resolution
      }
    });

    res.json({ message: 'Ticket resolved successfully', ticket });
  } catch (error) {
    console.error('[Support Controller] Resolve ticket error:', error);
    res.status(500).json({ message: 'Failed to resolve ticket' });
  }
};

/**
 * Close ticket
 */
const closeTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;

    const ticket = await SupportTicket.findById(ticketId);

    if (!ticket) {
      return res.status(404).json({ message: 'Support ticket not found' });
    }

    ticket.status = 'closed';
    await ticket.save();

    res.json({ message: 'Ticket closed successfully', ticket });
  } catch (error) {
    console.error('[Support Controller] Close ticket error:', error);
    res.status(500).json({ message: 'Failed to close ticket' });
  }
};

/**
 * Get ticket statistics
 */
const getTicketStatistics = async (req, res) => {
  try {
    const stats = await SupportTicket.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const priorityStats = await SupportTicket.aggregate([
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 }
        }
      }
    ]);

    const statistics = {
      byStatus: {
        open: 0,
        pending: 0,
        in_progress: 0,
        resolved: 0,
        closed: 0
      },
      byPriority: {
        low: 0,
        medium: 0,
        high: 0,
        urgent: 0
      }
    };

    stats.forEach(stat => {
      statistics.byStatus[stat._id] = stat.count;
    });

    priorityStats.forEach(stat => {
      statistics.byPriority[stat._id] = stat.count;
    });

    res.json({ statistics });
  } catch (error) {
    console.error('[Support Controller] Get statistics error:', error);
    res.status(500).json({ message: 'Failed to get ticket statistics' });
  }
};

module.exports = {
  getAllTickets,
  getTicketById,
  createTicket,
  addMessage,
  assignTicket,
  resolveTicket,
  closeTicket,
  getTicketStatistics
};
