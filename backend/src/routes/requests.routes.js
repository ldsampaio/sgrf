const express = require('express');
const rc = require('../controllers/requestController');
const vc = require('../controllers/votingController');
const dc = require('../controllers/deliberationController');
const fc = require('../controllers/financeController');
const { authJwt } = require('../middlewares/auth');
const { requirePermission } = require('../middlewares/permissions');

const router = express.Router();
router.use(authJwt);
router.get('/', requirePermission('requests:list'), rc.list);
router.post('/', requirePermission('requests:create'), rc.create);
router.get('/:id', requirePermission('requests:get'), rc.getOne);
router.post('/:id/submit', requirePermission('requests:submit'), rc.submit);
router.post('/:id/cancel', requirePermission('requests:cancel'), rc.cancel);
router.get('/:id/history', requirePermission('requests:get'), rc.getOne);

// Votação (Fase 5)
router.get('/:id/votes', requirePermission('votes:list'), vc.listVotes);
router.post('/:id/votes', requirePermission('votes:cast'), vc.castVote);
router.put('/:id/votes/me', requirePermission('votes:cast'), vc.changeMyVote);
router.post('/:id/view-requests', requirePermission('votes:vista'), vc.requestVista);
router.post('/:id/close-voting', requirePermission('votes:close'), vc.closeManual);
router.post('/:id/suspend', requirePermission('votes:suspend'), vc.suspend);
router.post('/:id/unsuspend', requirePermission('votes:suspend'), vc.unsuspend);
router.post('/:id/colegiada-decision', requirePermission('votes:suspend'), vc.collegiateDecision);

// Discussão
router.get('/:id/messages', requirePermission('messages:list'), dc.list);
router.post('/:id/messages', requirePermission('messages:post'), dc.post);

// Financeiro
router.post('/:id/mark-spent', requirePermission('finance:mark-spent'), fc.markSpent);
router.post('/:id/reverse-provision', requirePermission('finance:reverse'), fc.reverseProvision);

module.exports = router;
