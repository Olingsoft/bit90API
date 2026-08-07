'use strict';

const os = require('os');
const mongoose = require('mongoose');

/**
 * Get server health status
 */
const getServerHealth = async (req, res) => {
  try {
    // CPU Usage
    const cpuUsage = process.cpuUsage();
    const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000;

    // Memory Usage
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsage = {
      total: Math.round(totalMemory / 1024 / 1024 / 1024), // GB
      used: Math.round(usedMemory / 1024 / 1024 / 1024), // GB
      free: Math.round(freeMemory / 1024 / 1024 / 1024), // GB
      percentage: Math.round((usedMemory / totalMemory) * 100)
    };

    // Disk Usage (simplified - in production use proper disk monitoring)
    const diskUsage = {
      total: 100, // GB (placeholder)
      used: 50, // GB (placeholder)
      free: 50, // GB (placeholder)
      percentage: 50 // (placeholder)
    };

    // Database Status
    let dbStatus = 'connected';
    let dbLatency = 0;
    try {
      const start = Date.now();
      await mongoose.connection.db.admin().ping();
      dbLatency = Date.now() - start;
    } catch (error) {
      dbStatus = 'disconnected';
    }

    // Uptime
    const uptime = process.uptime();
    const uptimeFormatted = formatUptime(uptime);

    // Active sessions (placeholder - implement based on your session management)
    const activeSessions = 0;

    const health = {
      cpu: {
        usage: Math.round(cpuPercent),
        cores: os.cpus().length
      },
      memory: memoryUsage,
      disk: diskUsage,
      database: {
        status: dbStatus,
        latency: dbLatency
      },
      api: {
        status: 'healthy',
        uptime: uptimeFormatted,
        uptimeSeconds: Math.round(uptime)
      },
      activeSessions,
      timestamp: new Date().toISOString()
    };

    res.json({ health });
  } catch (error) {
    console.error('[Server Monitoring] Get health error:', error);
    res.status(500).json({ message: 'Failed to get server health' });
  }
};

/**
 * Format uptime
 */
const formatUptime = (seconds) => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
};

/**
 * Get system logs (simplified - in production use proper logging system)
 */
const getSystemLogs = async (req, res) => {
  try {
    const { level = 'info', limit = 100 } = req.query;

    // Placeholder - implement based on your logging system
    const logs = [];

    res.json({ 
      logs,
      pagination: {
        total: logs.length,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('[Server Monitoring] Get logs error:', error);
    res.status(500).json({ message: 'Failed to get system logs' });
  }
};

/**
 * Get error logs
 */
const getErrorLogs = async (req, res) => {
  try {
    const { limit = 50 } = req.query;

    // Placeholder - implement based on your logging system
    const errorLogs = [];

    res.json({ 
      errorLogs,
      pagination: {
        total: errorLogs.length,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('[Server Monitoring] Get error logs error:', error);
    res.status(500).json({ message: 'Failed to get error logs' });
  }
};

module.exports = {
  getServerHealth,
  getSystemLogs,
  getErrorLogs
};
