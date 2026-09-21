const express = require('express');
const c = require('../controllers/userController');
const bc = require('../controllers/userBatchController');
const { authJwt, requireRole } = require('../middlewares/auth');

const router = express.Router();
router.use(authJwt);
router.get('/', requireRole('ADMINISTRADOR', 'CHEFE_DEPARTAMENTO'), c.list);
router.post('/batch/preview', requireRole('ADMINISTRADOR'), bc.upload.single('file'), bc.preview);
router.post('/batch/confirm', requireRole('ADMINISTRADOR'), bc.upload.single('file'), bc.confirm);
router.post('/', requireRole('ADMINISTRADOR', 'CHEFE_DEPARTAMENTO'), c.create);
router.patch('/:id', c.patch);
router.patch('/:id/role', c.patchRole);
router.post('/:id/resend-invite', requireRole('ADMINISTRADOR', 'CHEFE_DEPARTAMENTO'), c.resendInvite);
router.post('/:id/force-password-reset', requireRole('ADMINISTRADOR', 'CHEFE_DEPARTAMENTO'), c.resendInvite);

module.exports = router;
