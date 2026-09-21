const express = require('express');
const c = require('../controllers/settingsController');
const { authJwt } = require('../middlewares/auth');

const router = express.Router();
router.use(authJwt);
router.get('/', c.get);
router.patch('/financial', c.patchFinancial);
router.patch('/balance', c.patchBalance);
router.get('/transactions', c.transactions);
// Stubs
router.patch('/email', (req, res) => res.json({ ok: true, note: 'SMTP via .env nesta versão MVP' }));
router.post('/email/test', (req, res) => res.json({ ok: true }));

module.exports = router;
