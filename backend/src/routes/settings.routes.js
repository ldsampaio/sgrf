const express = require('express');
const c = require('../controllers/settingsController');
const { authJwt } = require('../middlewares/auth');
const { requirePermission } = require('../middlewares/permissions');

const router = express.Router();
router.use(authJwt);
router.get('/', requirePermission('settings:view'), c.get);
router.patch('/financial', requirePermission('settings:financial:edit'), c.patchFinancial);
router.patch('/balance', requirePermission('settings:financial:edit'), c.patchBalance);
router.get('/transactions', requirePermission('settings:transactions:view'), c.transactions);
// Stubs
router.patch('/email', requirePermission('settings:email:edit'), (req, res) => res.json({ ok: true, note: 'SMTP via .env nesta versão MVP' }));
router.post('/email/test', requirePermission('settings:email:edit'), (req, res) => res.json({ ok: true }));

module.exports = router;
