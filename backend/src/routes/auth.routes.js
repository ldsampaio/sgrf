const express = require('express');
const rateLimit = require('express-rate-limit');
const c = require('../controllers/authController');
const { authJwt } = require('../middlewares/auth');

const router = express.Router();
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });
const refreshLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false });
const forgotLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false });
const changeLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });

router.post('/login', loginLimiter, c.login);
router.post('/refresh', refreshLimiter, c.refresh);
router.post('/logout', c.logout);
router.post('/forgot-password', forgotLimiter, c.forgotPassword);
router.get('/me', authJwt, c.me);
router.post('/change-password', authJwt, changeLimiter, c.changePassword);

module.exports = router;
