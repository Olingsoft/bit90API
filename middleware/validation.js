'use strict';

const { body, param, query, validationResult } = require('express-validator');

/**
 * Validation middleware to check for errors
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

/**
 * Admin authentication validation
 */
const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters'),
  validate
];

const changePasswordValidation = [
  body('currentPassword')
    .isLength({ min: 8 })
    .withMessage('Current password must be at least 8 characters'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('New password must contain at least one uppercase letter, one lowercase letter, and one number'),
  validate
];

const resetPasswordValidation = [
  body('token')
    .notEmpty()
    .withMessage('Reset token is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('New password must contain at least one uppercase letter, one lowercase letter, and one number'),
  validate
];

/**
 * User management validation
 */
const userIdValidation = [
  param('userId')
    .isMongoId()
    .withMessage('Valid user ID is required'),
  validate
];

const updateUserValidation = [
  param('userId')
    .isMongoId()
    .withMessage('Valid user ID is required'),
  body('phone')
    .optional()
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage('Valid phone number is required'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  validate
];

/**
 * KYC validation
 */
const kycIdValidation = [
  param('kycId')
    .isMongoId()
    .withMessage('Valid KYC ID is required'),
  validate
];

const kycActionValidation = [
  param('kycId')
    .isMongoId()
    .withMessage('Valid KYC ID is required'),
  body('reason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Reason must not exceed 500 characters'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes must not exceed 1000 characters'),
  validate
];

/**
 * Finance validation
 */
const transactionIdValidation = [
  param('transactionId')
    .isMongoId()
    .withMessage('Valid transaction ID is required'),
  validate
];

const withdrawalActionValidation = [
  param('transactionId')
    .isMongoId()
    .withMessage('Valid transaction ID is required'),
  body('reason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Reason must not exceed 500 characters'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes must not exceed 1000 characters'),
  validate
];

/**
 * Bonus validation
 */
const bonusIdValidation = [
  param('bonusId')
    .isMongoId()
    .withMessage('Valid bonus ID is required'),
  validate
];

const createBonusValidation = [
  body('name')
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Bonus name must be between 3 and 100 characters'),
  body('type')
    .isIn(['welcome', 'deposit', 'cashback', 'referral', 'vip', 'promo_code'])
    .withMessage('Valid bonus type is required'),
  body('amount')
    .isFloat({ min: 0 })
    .withMessage('Bonus amount must be a positive number'),
  body('wagerRequirement')
    .isFloat({ min: 1 })
    .withMessage('Wager requirement must be at least 1x'),
  body('expiryDate')
    .isISO8601()
    .withMessage('Valid expiry date is required'),
  validate
];

/**
 * Support ticket validation
 */
const ticketIdValidation = [
  param('ticketId')
    .isMongoId()
    .withMessage('Valid ticket ID is required'),
  validate
];

const createTicketValidation = [
  body('userId')
    .isMongoId()
    .withMessage('Valid user ID is required'),
  body('subject')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Subject must be between 5 and 200 characters'),
  body('category')
    .isIn(['account', 'deposit', 'withdrawal', 'game', 'technical', 'kyc', 'bonus', 'other'])
    .withMessage('Valid category is required'),
  body('message')
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage('Message must be between 10 and 2000 characters'),
  validate
];

const addMessageValidation = [
  param('ticketId')
    .isMongoId()
    .withMessage('Valid ticket ID is required'),
  body('message')
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Message must be between 1 and 2000 characters'),
  validate
];

/**
 * Pagination validation
 */
const paginationValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  validate
];

/**
 * Date range validation
 */
const dateRangeValidation = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Valid start date is required'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('Valid end date is required'),
  validate
];

/**
 * Sanitize input to prevent XSS
 */
const sanitizeInput = (req, res, next) => {
  const sanitize = (obj) => {
    if (typeof obj !== 'object' || obj === null) return obj;
    
    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }
    
    const sanitized = {};
    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        // Remove potentially dangerous HTML/JS
        sanitized[key] = obj[key]
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#x27;')
          .replace(/\//g, '&#x2F;');
      } else if (typeof obj[key] === 'object') {
        sanitized[key] = sanitize(obj[key]);
      } else {
        sanitized[key] = obj[key];
      }
    }
    return sanitized;
  };

  if (req.body) {
    req.body = sanitize(req.body);
  }
  if (req.query) {
    req.query = sanitize(req.query);
  }
  if (req.params) {
    req.params = sanitize(req.params);
  }

  next();
};

module.exports = {
  validate,
  loginValidation,
  changePasswordValidation,
  resetPasswordValidation,
  userIdValidation,
  updateUserValidation,
  kycIdValidation,
  kycActionValidation,
  transactionIdValidation,
  withdrawalActionValidation,
  bonusIdValidation,
  createBonusValidation,
  ticketIdValidation,
  createTicketValidation,
  addMessageValidation,
  paginationValidation,
  dateRangeValidation,
  sanitizeInput
};
