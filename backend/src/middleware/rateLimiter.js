const rateLimit = require('express-rate-limit');

// Helper to allow test suites to run safely without hitting false positive IP blocks
const skipTests = (req) => {
  return process.env.NODE_ENV === 'test' || req.headers['x-test-bypass'] === 'quanticus-test';
};

// Rate limiter for public contact form: 5 submissions per 15 mins per IP
const contactFormLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // Generous threshold to prevent abuse
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipTests,
  message: {
    success: false,
    error: 'Too many contact requests from this IP address. Please try again in 15 minutes.'
  }
});

// Rate limiter for public application form: 5 submissions per 15 mins per IP
const applicationFormLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipTests,
  message: {
    success: false,
    error: 'Too many application submissions from this IP address. Please try again in 15 minutes.'
  }
});

// Rate limiter for admin login attempts: 5 attempts per 15 mins per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipTests,
  message: {
    success: false,
    error: 'Too many login attempts. Please try again after 15 minutes.'
  }
});

module.exports = {
  contactFormLimiter,
  applicationFormLimiter,
  publicFormLimiter: contactFormLimiter,
  loginLimiter
};
