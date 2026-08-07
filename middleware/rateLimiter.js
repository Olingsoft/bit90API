'use strict';

const rateLimit = require('express-rate-limit');

/**
 * General rate limiter for all API requests
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    message: 'Too many requests from this IP, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Strict rate limiter for authentication endpoints
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 auth requests per windowMs
  message: {
    message: 'Too many authentication attempts, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Strict rate limiter for sensitive operations (password reset, etc.)
 */
const sensitiveLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 sensitive requests per windowMs
  message: {
    message: 'Too many sensitive operations attempted, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 API rate limiter for admin operations
 */
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 admin requests per windowMs
  message: {
    message: 'Too many admin requests from this IP, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = {
  generalLimiter,
  authLimiter,
  sensitiveLimiter,
  adminLimiter
};
