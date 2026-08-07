'use strict';

const Admin = require('../models/Admin');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { auditLogService } = require('../services/auditLogService');

// Generate JWT token
const generateToken = (adminId) => {
  return jwt.sign(
    { id: adminId },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
};

// Generate refresh token
const generateRefreshToken = (adminId) => {
  return jwt.sign(
    { id: adminId, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key',
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
};

/**
 * Admin Login
 */
const login = async (req, res) => {
  try {
    const { email, password, twoFactorCode } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Find admin by email
    const admin = await Admin.findOne({ email }).select('+password +twoFactorSecret +twoFactorEnabled');
    
    if (!admin) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check if account is active
    if (admin.status !== 'active') {
      return res.status(403).json({ message: 'Account is not active' });
    }

    // Check if account is locked
    if (admin.isLocked()) {
      return res.status(423).json({ 
        message: 'Account is temporarily locked due to multiple failed login attempts',
        lockUntil: admin.lockUntil
      });
    }

    // Verify password
    const isPasswordValid = await admin.comparePassword(password);
    
    if (!isPasswordValid) {
      await admin.incrementFailedLogin();
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check 2FA if enabled
    if (admin.twoFactorEnabled) {
      if (!twoFactorCode) {
        return res.status(400).json({ 
          message: 'Two-factor authentication code is required',
          requiresTwoFactor: true
        });
      }
      
      // Verify 2FA code (using speakeasy or similar library)
      // For now, skip actual verification - implement with speakeasy
      // const verified = speakeasy.totp.verify({ secret: admin.twoFactorSecret, encoding: 'base32', token: twoFactorCode });
      // if (!verified) {
      //   await admin.incrementFailedLogin();
      //   return res.status(401).json({ message: 'Invalid two-factor code' });
      // }
    }

    // Reset failed login attempts
    await admin.resetFailedLogin();

    // Update last login
    admin.lastLogin = new Date();
    admin.lastLoginIP = req.ip;
    admin.lastLoginDevice = req.headers['user-agent'];
    await admin.save();

    // Generate tokens
    const token = generateToken(admin._id);
    const refreshToken = generateRefreshToken(admin._id);

    // Add session
    await admin.addSession({
      token: refreshToken,
      device: req.headers['user-agent'],
      browser: req.headers['user-agent'],
      ip: req.ip
    });

    // Log audit
    await auditLogService.log({
      admin: admin._id,
      adminName: admin.fullName,
      adminRole: admin.role,
      action: 'login',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      browser: req.headers['user-agent'],
      device: req.headers['user-agent']
    });

    // Return response
    res.json({
      message: 'Login successful',
      token,
      refreshToken,
      admin: {
        id: admin._id,
        fullName: admin.fullName,
        username: admin.username,
        email: admin.email,
        role: admin.role,
        permissions: Admin.getRolePermissions(admin.role),
        lastLogin: admin.lastLogin
      }
    });
  } catch (error) {
    console.error('[Admin Auth] Login error:', error);
    res.status(500).json({ message: 'Login failed' });
  }
};

/**
 * Refresh Token
 */
const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ message: 'Refresh token is required' });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key');
    
    if (decoded.type !== 'refresh') {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    // Find admin
    const admin = await Admin.findById(decoded.id);
    
    if (!admin || admin.status !== 'active') {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    // Check if session exists
    const session = admin.sessions.find(s => s.token === refreshToken && s.isActive);
    if (!session) {
      return res.status(401).json({ message: 'Session expired' });
    }

    // Update session activity
    session.lastActivity = new Date();
    await admin.save();

    // Generate new tokens
    const token = generateToken(admin._id);
    const newRefreshToken = generateRefreshToken(admin._id);

    // Update session token
    session.token = newRefreshToken;
    await admin.save();

    res.json({
      token,
      refreshToken: newRefreshToken
    });
  } catch (error) {
    console.error('[Admin Auth] Refresh token error:', error);
    res.status(401).json({ message: 'Invalid refresh token' });
  }
};

/**
 * Logout
 */
const logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (req.user) {
      const admin = await Admin.findById(req.user.id);
      
      if (admin) {
        if (refreshToken) {
          await admin.removeSession(refreshToken);
        }

        // Log audit
        await auditLogService.log({
          admin: admin._id,
          adminName: admin.fullName,
          adminRole: admin.role,
          action: 'logout',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          browser: req.headers['user-agent'],
          device: req.headers['user-agent']
        });
      }
    }

    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('[Admin Auth] Logout error:', error);
    res.status(500).json({ message: 'Logout failed' });
  }
};

/**
 * Logout from all devices
 */
const logoutAllDevices = async (req, res) => {
  try {
    const admin = await Admin.findById(req.user.id);
    
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    await admin.logoutAllDevices();

    // Log audit
    await auditLogService.log({
      admin: admin._id,
      adminName: admin.fullName,
      adminRole: admin.role,
      action: 'logout',
      actionDetails: 'Logged out from all devices',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      browser: req.headers['user-agent'],
      device: req.headers['user-agent']
    });

    res.json({ message: 'Logged out from all devices' });
  } catch (error) {
    console.error('[Admin Auth] Logout all devices error:', error);
    res.status(500).json({ message: 'Logout from all devices failed' });
  }
};

/**
 * Change Password
 */
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters' });
    }

    const admin = await Admin.findById(req.user.id).select('+password');
    
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    // Verify current password
    const isPasswordValid = await admin.comparePassword(currentPassword);
    
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    // Update password
    admin.password = newPassword;
    await admin.save();

    // Log audit
    await auditLogService.log({
      admin: admin._id,
      adminName: admin.fullName,
      adminRole: admin.role,
      action: 'other',
      actionDetails: 'Changed password',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      browser: req.headers['user-agent'],
      device: req.headers['user-agent']
    });

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('[Admin Auth] Change password error:', error);
    res.status(500).json({ message: 'Password change failed' });
  }
};

/**
 * Request Password Reset
 */
const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const admin = await Admin.findOne({ email });
    
    if (!admin) {
      // Don't reveal if email exists
      return res.json({ message: 'If the email exists, a reset link will be sent' });
    }

    // Generate reset token
    const resetToken = admin.createPasswordResetToken();
    await admin.save();

    // In production, send email with reset link
    // For now, return the token (for testing)
    console.log('[Admin Auth] Password reset token:', resetToken);

    // Log audit
    await auditLogService.log({
      admin: admin._id,
      adminName: admin.fullName,
      adminRole: admin.role,
      action: 'other',
      actionDetails: 'Requested password reset',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      browser: req.headers['user-agent'],
      device: req.headers['user-agent']
    });

    res.json({ 
      message: 'If the email exists, a reset link will be sent',
      resetToken // Remove in production
    });
  } catch (error) {
    console.error('[Admin Auth] Request password reset error:', error);
    res.status(500).json({ message: 'Password reset request failed' });
  }
};

/**
 * Reset Password
 */
const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ message: 'Token and new password are required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters' });
    }

    // Hash token to compare with stored token
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const admin = await Admin.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    }).select('+password');

    if (!admin) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    // Update password
    admin.password = newPassword;
    admin.passwordResetToken = undefined;
    admin.passwordResetExpires = undefined;
    admin.failedLoginAttempts = 0;
    admin.lockUntil = undefined;
    await admin.save();

    // Log audit
    await auditLogService.log({
      admin: admin._id,
      adminName: admin.fullName,
      adminRole: admin.role,
      action: 'other',
      actionDetails: 'Reset password',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      browser: req.headers['user-agent'],
      device: req.headers['user-agent']
    });

    res.json({ message: 'Password reset successful' });
  } catch (error) {
    console.error('[Admin Auth] Reset password error:', error);
    res.status(500).json({ message: 'Password reset failed' });
  }
};

/**
 * Enable 2FA
 */
const enableTwoFactor = async (req, res) => {
  try {
    const admin = await Admin.findById(req.user.id);
    
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    // Generate 2FA secret
    const secret = admin.generateTwoFactorSecret();
    await admin.save();

    // In production, generate QR code using speakeasy or similar
    // For now, return the secret
    res.json({
      message: 'Two-factor authentication enabled',
      secret,
      qrCode: `otpauth://totp/Bit90Admin:${admin.email}?secret=${secret}&issuer=Bit90`
    });
  } catch (error) {
    console.error('[Admin Auth] Enable 2FA error:', error);
    res.status(500).json({ message: 'Failed to enable two-factor authentication' });
  }
};

/**
 * Disable 2FA
 */
const disableTwoFactor = async (req, res) => {
  try {
    const { twoFactorCode } = req.body;

    const admin = await Admin.findById(req.user.id).select('+twoFactorSecret');
    
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    if (!admin.twoFactorEnabled) {
      return res.status(400).json({ message: 'Two-factor authentication is not enabled' });
    }

    // Verify 2FA code
    // Implement with speakeasy
    // const verified = speakeasy.totp.verify({ secret: admin.twoFactorSecret, encoding: 'base32', token: twoFactorCode });
    // if (!verified) {
    //   return res.status(401).json({ message: 'Invalid two-factor code' });
    // }

    admin.twoFactorEnabled = false;
    admin.twoFactorSecret = undefined;
    await admin.save();

    // Log audit
    await auditLogService.log({
      admin: admin._id,
      adminName: admin.fullName,
      adminRole: admin.role,
      action: 'other',
      actionDetails: 'Disabled two-factor authentication',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      browser: req.headers['user-agent'],
      device: req.headers['user-agent']
    });

    res.json({ message: 'Two-factor authentication disabled' });
  } catch (error) {
    console.error('[Admin Auth] Disable 2FA error:', error);
    res.status(500).json({ message: 'Failed to disable two-factor authentication' });
  }
};

/**
 * Get Current Admin Profile
 */
const getProfile = async (req, res) => {
  try {
    const admin = await Admin.findById(req.user.id).select('-password -twoFactorSecret -passwordResetToken');
    
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    res.json({
      admin: {
        id: admin._id,
        fullName: admin.fullName,
        username: admin.username,
        email: admin.email,
        phoneNumber: admin.phoneNumber,
        role: admin.role,
        permissions: Admin.getRolePermissions(admin.role),
        status: admin.status,
        twoFactorEnabled: admin.twoFactorEnabled,
        lastLogin: admin.lastLogin,
        lastLoginIP: admin.lastLoginIP,
        lastLoginDevice: admin.lastLoginDevice,
        sessions: admin.sessions.filter(s => s.isActive).map(s => ({
          device: s.device,
          browser: s.browser,
          ip: s.ip,
          loginAt: s.loginAt,
          lastActivity: s.lastActivity
        })),
        createdAt: admin.createdAt
      }
    });
  } catch (error) {
    console.error('[Admin Auth] Get profile error:', error);
    res.status(500).json({ message: 'Failed to get profile' });
  }
};

module.exports = {
  login,
  refreshToken,
  logout,
  logoutAllDevices,
  changePassword,
  requestPasswordReset,
  resetPassword,
  enableTwoFactor,
  disableTwoFactor,
  getProfile
};
