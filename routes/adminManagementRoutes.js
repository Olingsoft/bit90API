'use strict';

const express = require('express');
const router = express.Router();

const { adminAuthMiddleware } = require('../middleware/auth');
const {
  requireSuperAdmin,
  canAccessFinance,
  canProcessWithdrawals,
  canAccessKYC,
  canManageUsers,
  canManageBonuses,
  canAccessSupport,
  canAccessSystemSettings
} = require('../middleware/rbac');

// Controllers
const adminAuthController = require('../controllers/adminAuthController');
const adminUserController = require('../controllers/adminUserController');
const kycController = require('../controllers/kycController');
const financeController = require('../controllers/financeController');
const bonusController = require('../controllers/bonusController');
const supportController = require('../controllers/supportController');
const dashboardController = require('../controllers/dashboardController');
const reportsController = require('../controllers/reportsController');
const paymentSettingsController = require('../controllers/paymentSettingsController');
const serverMonitoringController = require('../controllers/serverMonitoringController');
const notificationController = require('../controllers/notificationController');

// ─── Authentication Routes ────────────────────────────────────────────────

router.post('/auth/login', adminAuthController.login);
router.post('/auth/refresh', adminAuthController.refreshToken);
router.post('/auth/logout', adminAuthMiddleware, adminAuthController.logout);
router.post('/auth/logout-all', adminAuthMiddleware, adminAuthController.logoutAllDevices);
router.post('/auth/change-password', adminAuthMiddleware, adminAuthController.changePassword);
router.post('/auth/reset-password/request', adminAuthController.requestPasswordReset);
router.post('/auth/reset-password/confirm', adminAuthController.resetPassword);
router.post('/auth/2fa/enable', adminAuthMiddleware, adminAuthController.enableTwoFactor);
router.post('/auth/2fa/disable', adminAuthMiddleware, adminAuthController.disableTwoFactor);
router.get('/auth/profile', adminAuthMiddleware, adminAuthController.getProfile);

// ─── Dashboard Routes ────────────────────────────────────────────────────────

router.get('/dashboard/statistics', adminAuthMiddleware, dashboardController.getDashboardStatistics);
router.get('/dashboard/revenue', adminAuthMiddleware, dashboardController.getRevenueChart);
router.get('/dashboard/bets', adminAuthMiddleware, dashboardController.getBetsChart);
router.get('/dashboard/deposits-withdrawals', adminAuthMiddleware, dashboardController.getDepositsWithdrawalsChart);
router.get('/dashboard/new-users', adminAuthMiddleware, dashboardController.getNewUsersChart);
router.get('/dashboard/monthly-profit', adminAuthMiddleware, dashboardController.getMonthlyProfitChart);

// ─── User Management Routes ──────────────────────────────────────────────────

router.get('/users', adminAuthMiddleware, canManageUsers, adminUserController.getAllUsers);
router.get('/users/:userId', adminAuthMiddleware, canManageUsers, adminUserController.getUserById);
router.put('/users/:userId', adminAuthMiddleware, canManageUsers, adminUserController.updateUser);
router.post('/users/:userId/freeze', adminAuthMiddleware, canManageUsers, adminUserController.freezeUser);
router.post('/users/:userId/suspend', adminAuthMiddleware, canManageUsers, adminUserController.suspendUser);
router.post('/users/:userId/activate', adminAuthMiddleware, canManageUsers, adminUserController.activateUser);
router.post('/users/:userId/reset-password', adminAuthMiddleware, canManageUsers, adminUserController.resetUserPassword);
router.get('/users/:userId/betting-history', adminAuthMiddleware, canManageUsers, adminUserController.getUserBettingHistory);
router.get('/users/:userId/deposits', adminAuthMiddleware, canManageUsers, adminUserController.getUserDeposits);
router.get('/users/:userId/withdrawals', adminAuthMiddleware, canManageUsers, adminUserController.getUserWithdrawals);
router.get('/users/:userId/login-history', adminAuthMiddleware, canManageUsers, adminUserController.getUserLoginHistory);
router.get('/users/:userId/referral-info', adminAuthMiddleware, canManageUsers, adminUserController.getUserReferralInfo);

// ─── Admin Management Routes (Super Admin Only) ────────────────────────────

router.get('/admins', adminAuthMiddleware, requireSuperAdmin, adminUserController.getAllAdmins);
router.put('/admins/:adminId/role', adminAuthMiddleware, requireSuperAdmin, adminUserController.updateAdminRole);

// ─── KYC Management Routes ───────────────────────────────────────────────────

router.get('/kyc', adminAuthMiddleware, canAccessKYC, kycController.getAllKYC);
router.get('/kyc/:kycId', adminAuthMiddleware, canAccessKYC, kycController.getKYCById);
router.get('/kyc/user/:userId', adminAuthMiddleware, canAccessKYC, kycController.getKYCByUserId);
router.post('/kyc/:kycId/approve', adminAuthMiddleware, canAccessKYC, kycController.approveKYC);
router.post('/kyc/:kycId/reject', adminAuthMiddleware, canAccessKYC, kycController.rejectKYC);
router.post('/kyc/:kycId/request-resubmission', adminAuthMiddleware, canAccessKYC, kycController.requestKYCResubmission);
router.get('/kyc/statistics', adminAuthMiddleware, canAccessKYC, kycController.getKYCStatistics);

// ─── Finance Routes ─────────────────────────────────────────────────────────

router.get('/finance/deposits', adminAuthMiddleware, canAccessFinance, financeController.getAllDeposits);
router.get('/finance/withdrawals', adminAuthMiddleware, canAccessFinance, financeController.getAllWithdrawals);
router.get('/finance/transactions/:transactionId', adminAuthMiddleware, canAccessFinance, financeController.getTransactionById);
router.post('/finance/withdrawals/:transactionId/approve', adminAuthMiddleware, canProcessWithdrawals, financeController.approveWithdrawal);
router.post('/finance/withdrawals/:transactionId/reject', adminAuthMiddleware, canProcessWithdrawals, financeController.rejectWithdrawal);
router.post('/finance/withdrawals/:transactionId/hold', adminAuthMiddleware, canProcessWithdrawals, financeController.holdWithdrawal);
router.get('/finance/statistics', adminAuthMiddleware, canAccessFinance, financeController.getFinanceStatistics);

// ─── Bonus Management Routes ──────────────────────────────────────────────────

router.get('/bonuses', adminAuthMiddleware, canManageBonuses, bonusController.getAllBonuses);
router.get('/bonuses/:bonusId', adminAuthMiddleware, canManageBonuses, bonusController.getBonusById);
router.post('/bonuses', adminAuthMiddleware, canManageBonuses, bonusController.createBonus);
router.put('/bonuses/:bonusId', adminAuthMiddleware, canManageBonuses, bonusController.updateBonus);
router.delete('/bonuses/:bonusId', adminAuthMiddleware, canManageBonuses, bonusController.deleteBonus);
router.get('/bonuses/statistics', adminAuthMiddleware, canManageBonuses, bonusController.getBonusStatistics);

// ─── Support Ticket Routes ───────────────────────────────────────────────────

router.get('/support/tickets', adminAuthMiddleware, canAccessSupport, supportController.getAllTickets);
router.get('/support/tickets/:ticketId', adminAuthMiddleware, canAccessSupport, supportController.getTicketById);
router.post('/support/tickets', adminAuthMiddleware, canAccessSupport, supportController.createTicket);
router.post('/support/tickets/:ticketId/messages', adminAuthMiddleware, canAccessSupport, supportController.addMessage);
router.post('/support/tickets/:ticketId/assign', adminAuthMiddleware, canAccessSupport, supportController.assignTicket);
router.post('/support/tickets/:ticketId/resolve', adminAuthMiddleware, canAccessSupport, supportController.resolveTicket);
router.post('/support/tickets/:ticketId/close', adminAuthMiddleware, canAccessSupport, supportController.closeTicket);
router.get('/support/tickets/statistics', adminAuthMiddleware, canAccessSupport, supportController.getTicketStatistics);

// ─── Reports Routes ─────────────────────────────────────────────────────────

router.get('/reports/revenue', adminAuthMiddleware, canAccessFinance, reportsController.generateRevenueReport);
router.get('/reports/deposits', adminAuthMiddleware, canAccessFinance, reportsController.generateDepositsReport);
router.get('/reports/withdrawals', adminAuthMiddleware, canAccessFinance, reportsController.generateWithdrawalsReport);
router.get('/reports/bets', adminAuthMiddleware, canAccessFinance, reportsController.generateBetsReport);
router.get('/reports/users', adminAuthMiddleware, canManageUsers, reportsController.generateUsersReport);
router.get('/reports/bonus-costs', adminAuthMiddleware, canManageBonuses, reportsController.generateBonusCostsReport);
router.get('/reports/export', adminAuthMiddleware, canAccessFinance, reportsController.exportReportCSV);

// ─── Payment Settings Routes ────────────────────────────────────────────────

router.get('/settings/payment', adminAuthMiddleware, canAccessSystemSettings, paymentSettingsController.getPaymentSettings);
router.put('/settings/payment/mpesa', adminAuthMiddleware, canAccessSystemSettings, paymentSettingsController.updateMpesaSettings);
router.put('/settings/payment/airtel', adminAuthMiddleware, canAccessSystemSettings, paymentSettingsController.updateAirtelSettings);
router.put('/settings/payment/bank', adminAuthMiddleware, canAccessSystemSettings, paymentSettingsController.updateBankSettings);
router.put('/settings/payment/crypto', adminAuthMiddleware, canAccessSystemSettings, paymentSettingsController.updateCryptoSettings);
router.post('/settings/payment/maintenance', adminAuthMiddleware, canAccessSystemSettings, paymentSettingsController.toggleMaintenanceMode);
router.post('/settings/payment/gateway/toggle', adminAuthMiddleware, canAccessSystemSettings, paymentSettingsController.togglePaymentGateway);

// ─── Server Monitoring Routes ────────────────────────────────────────────────

router.get('/monitoring/health', adminAuthMiddleware, canAccessSystemSettings, serverMonitoringController.getServerHealth);
router.get('/monitoring/logs', adminAuthMiddleware, canAccessSystemSettings, serverMonitoringController.getSystemLogs);
router.get('/monitoring/error-logs', adminAuthMiddleware, canAccessSystemSettings, serverMonitoringController.getErrorLogs);

// ─── Notification Routes ─────────────────────────────────────────────────────

router.get('/notifications', adminAuthMiddleware, notificationController.getNotifications);
router.post('/notifications/:notificationId/read', adminAuthMiddleware, notificationController.markAsRead);
router.post('/notifications/read-all', adminAuthMiddleware, notificationController.markAllAsRead);
router.delete('/notifications/:notificationId', adminAuthMiddleware, notificationController.deleteNotification);

module.exports = router;
