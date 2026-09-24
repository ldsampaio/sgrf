const express = require('express');
const rc = require('../controllers/requestController');
const vc = require('../controllers/votingController');
const dc = require('../controllers/deliberationController');
const fc = require('../controllers/financeController');
const { authJwt } = require('../middlewares/auth');
const { requirePermission } = require('../middlewares/permissions');

const router = express.Router();
router.use(authJwt);
router.get('/', rc.list);
router.post('/', rc.create);
router.get('/:id', requirePermission('requests:get'), rc.getOne);
router.post('/:id/submit', rc.submit);
router.post('/:id/cancel', rc.cancel);
router.get('/:id/history', requirePermission('requests:get'), rc.getOne);

// Votação (Fase 5)
router.get('/:id/votes', vc.listVotes);
router.post('/:id/votes', vc.castVote);
router.put('/:id/votes/me', vc.changeMyVote);
router.post('/:id/view-requests', vc.requestVista);
router.post('/:id/close-voting', vc.closeManual);
router.post('/:id/suspend', vc.suspend);
router.post('/:id/unsuspend', vc.unsuspend);
router.post('/:id/colegiada-decision', vc.collegiateDecision);

// Discussão
router.get('/:id/messages', dc.list);
router.post('/:id/messages', dc.post);

// Financeiro
router.post('/:id/mark-spent', fc.markSpent);
router.post('/:id/reverse-provision', fc.reverseProvision);

module.exports = router;
