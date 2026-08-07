'use strict';

const PaymentSettings = require('../models/PaymentSettings');
const { auditLogService } = require('../services/auditLogService');

/**
 * Get payment settings
 */
const getPaymentSettings = async (req, res) => {
  try {
    let settings = await PaymentSettings.findOne();
    
    if (!settings) {
      // Create default settings
      settings = await PaymentSettings.create({
        updatedBy: req.user.id
      });
    }

    // Don't return sensitive data
    const sanitizedSettings = settings.toObject();
    if (sanitizedSettings.mpesa) {
      delete sanitizedSettings.mpesa.passkey;
      delete sanitizedSettings.mpesa.consumerSecret;
    }
    if (sanitizedSettings.airtel) {
      delete sanitizedSettings.airtel.clientSecret;
    }

    res.json({ settings: sanitizedSettings });
  } catch (error) {
    console.error('[Payment Settings Controller] Get settings error:', error);
    res.status(500).json({ message: 'Failed to get payment settings' });
  }
};

/**
 * Update M-Pesa settings
 */
const updateMpesaSettings = async (req, res) => {
  try {
    const { shortcode, passkey, consumerKey, consumerSecret, environment, minDeposit, maxDeposit, minWithdrawal, maxWithdrawal, transactionFee, processingTime } = req.body;

    let settings = await PaymentSettings.findOne();
    
    if (!settings) {
      settings = await PaymentSettings.create({
        updatedBy: req.user.id
      });
    }

    settings.mpesa = {
      ...settings.mpesa,
      enabled: true,
      shortcode: shortcode || settings.mpesa.shortcode,
      passkey: passkey || settings.mpesa.passkey,
      consumerKey: consumerKey || settings.mpesa.consumerKey,
      consumerSecret: consumerSecret || settings.mpesa.consumerSecret,
      environment: environment || settings.mpesa.environment,
      minDeposit: minDeposit !== undefined ? minDeposit : settings.mpesa.minDeposit,
      maxDeposit: maxDeposit !== undefined ? maxDeposit : settings.mpesa.maxDeposit,
      minWithdrawal: minWithdrawal !== undefined ? minWithdrawal : settings.mpesa.minWithdrawal,
      maxWithdrawal: maxWithdrawal !== undefined ? maxWithdrawal : settings.mpesa.maxWithdrawal,
      transactionFee: transactionFee !== undefined ? transactionFee : settings.mpesa.transactionFee,
      processingTime: processingTime !== undefined ? processingTime : settings.mpesa.processingTime
    };
    settings.updatedBy = req.user.id;
    await settings.save();

    // Log audit
    await auditLogService.log({
      admin: req.user.id,
      adminName: req.user.fullName,
      adminRole: req.user.role,
      action: 'update_payment_settings',
      actionDetails: 'Updated M-Pesa settings',
      targetType: 'setting',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      browser: req.headers['user-agent'],
      device: req.headers['user-agent']
    });

    res.json({ message: 'M-Pesa settings updated successfully', settings });
  } catch (error) {
    console.error('[Payment Settings Controller] Update M-Pesa error:', error);
    res.status(500).json({ message: 'Failed to update M-Pesa settings' });
  }
};

/**
 * Update Airtel Money settings
 */
const updateAirtelSettings = async (req, res) => {
  try {
    const { clientId, clientSecret, environment, minDeposit, maxDeposit, minWithdrawal, maxWithdrawal, transactionFee, processingTime } = req.body;

    let settings = await PaymentSettings.findOne();
    
    if (!settings) {
      settings = await PaymentSettings.create({
        updatedBy: req.user.id
      });
    }

    settings.airtel = {
      ...settings.airtel,
      enabled: true,
      clientId: clientId || settings.airtel.clientId,
      clientSecret: clientSecret || settings.airtel.clientSecret,
      environment: environment || settings.airtel.environment,
      minDeposit: minDeposit !== undefined ? minDeposit : settings.airtel.minDeposit,
      maxDeposit: maxDeposit !== undefined ? maxDeposit : settings.airtel.maxDeposit,
      minWithdrawal: minWithdrawal !== undefined ? minWithdrawal : settings.airtel.minWithdrawal,
      maxWithdrawal: maxWithdrawal !== undefined ? maxWithdrawal : settings.airtel.maxWithdrawal,
      transactionFee: transactionFee !== undefined ? transactionFee : settings.airtel.transactionFee,
      processingTime: processingTime !== undefined ? processingTime : settings.airtel.processingTime
    };
    settings.updatedBy = req.user.id;
    await settings.save();

    // Log audit
    await auditLogService.log({
      admin: req.user.id,
      adminName: req.user.fullName,
      adminRole: req.user.role,
      action: 'update_payment_settings',
      actionDetails: 'Updated Airtel Money settings',
      targetType: 'setting',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      browser: req.headers['user-agent'],
      device: req.headers['user-agent']
    });

    res.json({ message: 'Airtel Money settings updated successfully', settings });
  } catch (error) {
    console.error('[Payment Settings Controller] Update Airtel error:', error);
    res.status(500).json({ message: 'Failed to update Airtel Money settings' });
  }
};

/**
 * Update Bank Transfer settings
 */
const updateBankSettings = async (req, res) => {
  try {
    const { bankName, accountNumber, accountName, minDeposit, maxDeposit, minWithdrawal, maxWithdrawal, transactionFee, processingTime } = req.body;

    let settings = await PaymentSettings.findOne();
    
    if (!settings) {
      settings = await PaymentSettings.create({
        updatedBy: req.user.id
      });
    }

    settings.bank = {
      ...settings.bank,
      enabled: true,
      bankName: bankName || settings.bank.bankName,
      accountNumber: accountNumber || settings.bank.accountNumber,
      accountName: accountName || settings.bank.accountName,
      minDeposit: minDeposit !== undefined ? minDeposit : settings.bank.minDeposit,
      maxDeposit: maxDeposit !== undefined ? maxDeposit : settings.bank.maxDeposit,
      minWithdrawal: minWithdrawal !== undefined ? minWithdrawal : settings.bank.minWithdrawal,
      maxWithdrawal: maxWithdrawal !== undefined ? maxWithdrawal : settings.bank.maxWithdrawal,
      transactionFee: transactionFee !== undefined ? transactionFee : settings.bank.transactionFee,
      processingTime: processingTime !== undefined ? processingTime : settings.bank.processingTime
    };
    settings.updatedBy = req.user.id;
    await settings.save();

    // Log audit
    await auditLogService.log({
      admin: req.user.id,
      adminName: req.user.fullName,
      adminRole: req.user.role,
      action: 'update_payment_settings',
      actionDetails: 'Updated Bank Transfer settings',
      targetType: 'setting',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      browser: req.headers['user-agent'],
      device: req.headers['user-agent']
    });

    res.json({ message: 'Bank Transfer settings updated successfully', settings });
  } catch (error) {
    console.error('[Payment Settings Controller] Update Bank error:', error);
    res.status(500).json({ message: 'Failed to update Bank Transfer settings' });
  }
};

/**
 * Update Crypto settings
 */
const updateCryptoSettings = async (req, res) => {
  try {
    const { supportedCoins, walletAddress, minDeposit, maxDeposit, minWithdrawal, maxWithdrawal, transactionFee, processingTime } = req.body;

    let settings = await PaymentSettings.findOne();
    
    if (!settings) {
      settings = await PaymentSettings.create({
        updatedBy: req.user.id
      });
    }

    settings.crypto = {
      ...settings.crypto,
      enabled: true,
      supportedCoins: supportedCoins || settings.crypto.supportedCoins,
      walletAddress: walletAddress || settings.crypto.walletAddress,
      minDeposit: minDeposit !== undefined ? minDeposit : settings.crypto.minDeposit,
      maxDeposit: maxDeposit !== undefined ? maxDeposit : settings.crypto.maxDeposit,
      minWithdrawal: minWithdrawal !== undefined ? minWithdrawal : settings.crypto.minWithdrawal,
      maxWithdrawal: maxWithdrawal !== undefined ? maxWithdrawal : settings.crypto.maxWithdrawal,
      transactionFee: transactionFee !== undefined ? transactionFee : settings.crypto.transactionFee,
      processingTime: processingTime !== undefined ? processingTime : settings.crypto.processingTime
    };
    settings.updatedBy = req.user.id;
    await settings.save();

    // Log audit
    await auditLogService.log({
      admin: req.user.id,
      adminName: req.user.fullName,
      adminRole: req.user.role,
      action: 'update_payment_settings',
      actionDetails: 'Updated Crypto settings',
      targetType: 'setting',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      browser: req.headers['user-agent'],
      device: req.headers['user-agent']
    });

    res.json({ message: 'Crypto settings updated successfully', settings });
  } catch (error) {
    console.error('[Payment Settings Controller] Update Crypto error:', error);
    res.status(500).json({ message: 'Failed to update Crypto settings' });
  }
};

/**
 * Toggle maintenance mode
 */
const toggleMaintenanceMode = async (req, res) => {
  try {
    const { enabled, message } = req.body;

    let settings = await PaymentSettings.findOne();
    
    if (!settings) {
      settings = await PaymentSettings.create({
        updatedBy: req.user.id
      });
    }

    settings.maintenanceMode = enabled !== undefined ? enabled : !settings.maintenanceMode;
    if (message) {
      settings.maintenanceMessage = message;
    }
    settings.updatedBy = req.user.id;
    await settings.save();

    // Log audit
    await auditLogService.log({
      admin: req.user.id,
      adminName: req.user.fullName,
      adminRole: req.user.role,
      action: enabled ? 'enable_maintenance_mode' : 'disable_maintenance_mode',
      actionDetails: `Maintenance mode ${enabled ? 'enabled' : 'disabled'}`,
      targetType: 'setting',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      browser: req.headers['user-agent'],
      device: req.headers['user-agent']
    });

    res.json({ 
      message: `Maintenance mode ${settings.maintenanceMode ? 'enabled' : 'disabled'} successfully`,
      maintenanceMode: settings.maintenanceMode,
      maintenanceMessage: settings.maintenanceMessage
    });
  } catch (error) {
    console.error('[Payment Settings Controller] Toggle maintenance mode error:', error);
    res.status(500).json({ message: 'Failed to toggle maintenance mode' });
  }
};

/**
 * Enable/disable payment gateway
 */
const togglePaymentGateway = async (req, res) => {
  try {
    const { gateway, enabled } = req.body;

    if (!['mpesa', 'airtel', 'bank', 'crypto'].includes(gateway)) {
      return res.status(400).json({ message: 'Invalid payment gateway' });
    }

    let settings = await PaymentSettings.findOne();
    
    if (!settings) {
      settings = await PaymentSettings.create({
        updatedBy: req.user.id
      });
    }

    settings[gateway].enabled = enabled !== undefined ? enabled : !settings[gateway].enabled;
    settings.updatedBy = req.user.id;
    await settings.save();

    res.json({ 
      message: `${gateway} ${settings[gateway].enabled ? 'enabled' : 'disabled'} successfully`
    });
  } catch (error) {
    console.error('[Payment Settings Controller] Toggle gateway error:', error);
    res.status(500).json({ message: 'Failed to toggle payment gateway' });
  }
};

module.exports = {
  getPaymentSettings,
  updateMpesaSettings,
  updateAirtelSettings,
  updateBankSettings,
  updateCryptoSettings,
  toggleMaintenanceMode,
  togglePaymentGateway
};
