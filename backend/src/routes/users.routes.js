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
// PATCHs declaram ação ampla; o gate alvo-dependente (canManageUsers) vive no handler.
router.patch('/:id', requirePermission('users:patch'), c.patch);
router.patch('/:id/role', requirePermission('users:patch-role'), c.patchRole);

// Removido: criação de usuário e reset de senha. Identidade e credencial são do
// saga; o sgrf só atribui papel em sgrf.user_roles.
module.exports = router;
