const express = require('express');
const dc = require('../controllers/deliberationController');
const { authJwt } = require('../middlewares/auth');

const router = express.Router();
router.use(authJwt);
router.patch('/:mid', dc.patch);
router.delete('/:mid', dc.remove);

module.exports = router;
