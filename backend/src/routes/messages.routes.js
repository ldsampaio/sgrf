const express = require('express');
const dc = require('../controllers/deliberationController');
const { authJwt } = require('../middlewares/auth');
const { requirePermission } = require('../middlewares/permissions');

const router = express.Router();
router.use(authJwt);
router.patch('/:mid', requirePermission('messages:edit'), dc.patch);
router.delete('/:mid', requirePermission('messages:remove'), dc.remove);

module.exports = router;
