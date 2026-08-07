'use strict';

const Admin = require('../models/Admin');
const User = require('../models/User');

/**
 * Check if admin has required permission
 */
const hasPermission = (admin, requiredPermission) => {
  // Super admin has all permissions
  if (admin.role === 'super_admin') {
    return true;
  }
  
  // Check if admin has the specific permission
  return admin.permissions && admin.permissions.includes(requiredPermission);
};

/**
 * Check if admin has any of the required permissions
 */
const hasAnyPermission = (admin, requiredPermissions) => {
  // Super admin has all permissions
  if (admin.role === 'super_admin') {
    return true;
  }
  
  // Check if admin has any of the required permissions
  return requiredPermissions.some(permission => 
    admin.permissions && admin.permissions.includes(permission)
  );
};

/**
 * Middleware to check if admin has required permission
 */
const requirePermission = (permission) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      
      let admin = await Admin.findById(req.user.id).select('role permissions status');
      
      // If not found in Admin model, try old User model for backward compatibility
      if (!admin) {
        const user = await User.findById(req.user.id);
        if (user && (user.isAdmin === true || user.role === 'admin' || user.role === 'superadmin')) {
          // Create a temporary admin-like object from the user
          admin = {
            _id: user._id,
            role: user.role === 'superadmin' ? 'super_admin' : 'admin',
            status: 'active',
            permissions: [] // Old users don't have specific permissions, but superadmin has all
          };
        }
      }
      
      if (!admin) {
        return res.status(404).json({ message: 'Admin not found' });
      }
      
      if (admin.status !== 'active') {
        return res.status(403).json({ message: 'Admin account is not active' });
      }
      
      if (!hasPermission(admin, permission)) {
        return res.status(403).json({ 
          message: 'Insufficient permissions',
          required: permission
        });
      }
      
      req.admin = admin;
      next();
    } catch (error) {
      console.error('[RBAC Middleware] Error:', error);
      return res.status(500).json({ message: 'Permission check failed' });
    }
  };
};

/**
 * Middleware to check if admin has any of the required permissions
 */
const requireAnyPermission = (permissions) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      
      let admin = await Admin.findById(req.user.id).select('role permissions status');
      
      // If not found in Admin model, try old User model for backward compatibility
      if (!admin) {
        const user = await User.findById(req.user.id);
        if (user && (user.isAdmin === true || user.role === 'admin' || user.role === 'superadmin')) {
          // Create a temporary admin-like object from the user
          admin = {
            _id: user._id,
            role: user.role === 'superadmin' ? 'super_admin' : 'admin',
            status: 'active',
            permissions: [] // Old users don't have specific permissions, but superadmin has all
          };
        }
      }
      
      if (!admin) {
        return res.status(404).json({ message: 'Admin not found' });
      }
      
      if (admin.status !== 'active') {
        return res.status(403).json({ message: 'Admin account is not active' });
      }
      
      if (!hasAnyPermission(admin, permissions)) {
        return res.status(403).json({ 
          message: 'Insufficient permissions',
          required: permissions
        });
      }
      
      req.admin = admin;
      next();
    } catch (error) {
      console.error('[RBAC Middleware] Error:', error);
      return res.status(500).json({ message: 'Permission check failed' });
    }
  };
};

/**
 * Middleware to check if admin has required role
 */
const requireRole = (roles) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      
      let admin = await Admin.findById(req.user.id).select('role status');
      
      // If not found in Admin model, try old User model for backward compatibility
      if (!admin) {
        const user = await User.findById(req.user.id);
        if (user && (user.isAdmin === true || user.role === 'admin' || user.role === 'superadmin')) {
          // Create a temporary admin-like object from the user
          admin = {
            _id: user._id,
            role: user.role === 'superadmin' ? 'super_admin' : 'admin',
            status: 'active'
          };
        }
      }
      
      if (!admin) {
        return res.status(404).json({ message: 'Admin not found' });
      }
      
      if (admin.status !== 'active') {
        return res.status(403).json({ message: 'Admin account is not active' });
      }
      
      const allowedRoles = Array.isArray(roles) ? roles : [roles];
      
      if (!allowedRoles.includes(admin.role)) {
        return res.status(403).json({ 
          message: 'Insufficient role privileges',
          required: allowedRoles
        });
      }
      
      req.admin = admin;
      next();
    } catch (error) {
      console.error('[RBAC Middleware] Error:', error);
      return res.status(500).json({ message: 'Role check failed' });
    }
  };
};

/**
 * Middleware to check if admin is super admin
 */
const requireSuperAdmin = requireRole('super_admin');

/**
 * Middleware to check if admin can manage other admins
 */
const canManageAdmins = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    const admin = await Admin.findById(req.user.id).select('role status');
    
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    
    if (admin.status !== 'active') {
      return res.status(403).json({ message: 'Admin account is not active' });
    }
    
    // Only super admin can manage other admins
    if (admin.role !== 'super_admin') {
      return res.status(403).json({ message: 'Only super admin can manage other admins' });
    }
    
    req.admin = admin;
    next();
  } catch (error) {
    console.error('[RBAC Middleware] Error:', error);
    return res.status(500).json({ message: 'Admin management check failed' });
  }
};

/**
 * Middleware to check if admin can access financial operations
 */
const canAccessFinance = requireAnyPermission([
  'view_deposits',
  'view_withdrawals',
  'approve_withdrawals',
  'reject_withdrawals',
  'export_finance_reports'
]);

/**
 * Middleware to check if admin can approve/reject withdrawals
 */
const canProcessWithdrawals = requireAnyPermission([
  'approve_withdrawals',
  'reject_withdrawals'
]);

/**
 * Middleware to check if admin can access KYC operations
 */
const canAccessKYC = requireAnyPermission([
  'view_kyc',
  'approve_kyc',
  'reject_kyc',
  'request_kyc_resubmission'
]);

/**
 * Middleware to check if admin can manage users
 */
const canManageUsers = requireAnyPermission([
  'view_users',
  'freeze_users'
]);

/**
 * Middleware to check if admin can manage bonuses
 */
const canManageBonuses = requirePermission('create_bonuses');

/**
 * Middleware to check if admin can access support tickets
 */
const canAccessSupport = requireAnyPermission([
  'view_tickets',
  'resolve_tickets'
]);

/**
 * Middleware to check if admin can access system settings
 */
const canAccessSystemSettings = requireAnyPermission([
  'configure_payment_gateways',
  'view_server_health',
  'view_logs',
  'configure_maintenance_mode'
]);

module.exports = {
  hasPermission,
  hasAnyPermission,
  requirePermission,
  requireAnyPermission,
  requireRole,
  requireSuperAdmin,
  canManageAdmins,
  canAccessFinance,
  canProcessWithdrawals,
  canAccessKYC,
  canManageUsers,
  canManageBonuses,
  canAccessSupport,
  canAccessSystemSettings
};
