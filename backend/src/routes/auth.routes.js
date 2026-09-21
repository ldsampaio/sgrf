const express = require('express');
const rateLimit = require('express-rate-limit');
const c = require('../controllers/authController');
const { authJwt } = require('../middlewares/auth');

const router = express.Router();
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });

router.post('/login', loginLimiter, c.login);
router.post('/refresh', c.refresh);
router.post('/logout', c.logout);
router.post('/forgot-password', c.forgotPassword);
router.get('/me', authJwt, c.me);
router.post('/change-password', authJwt, c.changePassword);

module.exports = router;
