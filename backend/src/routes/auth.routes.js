const express = require('express');
const c = require('../controllers/authController');
const { authJwt } = require('../middlewares/auth');

const router = express.Router();

// Só `me`. Rate limit de login e bloqueio por tentativas são do saga — o sgrf
// não tem rota de credencial, então não tem limiter de credencial.
router.get('/me', authJwt, c.me);

module.exports = router;
