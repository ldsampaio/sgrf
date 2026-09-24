const express = require('express');
const c = require('../controllers/userController');
const bc = require('../controllers/userBatchController');
const { authJwt } = require('../middlewares/auth');
const { requirePermission } = require('../middlewares/permissions');

const router = express.Router();
router.use(authJwt);
router.get('/', requirePermission('users:list'), c.list);
router.post('/batch/preview', requirePermission('users:batch'), bc.upload.single('file'), bc.preview);
router.post('/batch/confirm', requirePermission('users:batch'), bc.upload.single('file'), bc.confirm);
router.post('/', requirePermission('users:create'), c.create);
// PATCHs declaram ação ampla; o gate alvo-dependente (canManageUsers) vive no handler.
router.patch('/:id', requirePermission('users:patch'), c.patch);
router.patch('/:id/role', requirePermission('users:patch-role'), c.patchRole);
router.post('/:id/resend-invite', requirePermission('users:invite'), c.resendInvite);
// D-11: mantém admin+chefe; o bloqueio chefe→admin (canManageUsers) entra no handler (04-02).
router.post('/:id/force-password-reset', requirePermission('users:force-reset'), c.resendInvite);

module.exports = router;
