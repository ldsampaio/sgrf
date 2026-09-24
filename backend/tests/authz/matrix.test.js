// Matriz authz completa (Fase 4 — SEC-01, plano 04-03).
//
// Ordem de checagem exercitada: authenticate → map gate (403) → fetch →
// visibility 404 → ownership 403. Prisma singleton mockado; JWTs reais por
// papel. D-08: 403 = papel errado em escopo visível; 404 = fora de escopo
// (existência escondida).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';
import { mockDb as prisma } from './mockDbState.js';
import { makeUser, makeRequest, makeVote, makeMessage, cookieFor } from './helpers.js';

// Os controllers usam `require('../config/db')` (CJS nativo), que não passa
// pelo registro do `vi.mock` — apenas o cache do Node os alcança. Semeia o
// mock ANTES de carregar o app (imports estáticos são hoisted, por isso o
// app entra via import dinâmico abaixo).
const _require = createRequire(import.meta.url);
const _dbPath = _require.resolve('../../src/config/db.js');
if (!_require.cache[_dbPath]) {
  _require.cache[_dbPath] = { id: _dbPath, filename: _dbPath, loaded: true, exports: prisma };
}

const { default: createApp } = await import('../../src/app.js');
const { requirePermission } = await import('../../src/middlewares/permissions.js');

const app = createApp();

describe('GET /api/requests/:id — papel então visibilidade', () => {
  let owner;
  let otherProf;
  let aluno;
  let admin;
  let draftReq;
  let openReq;
  let usersById;
  let requestsById;

  beforeEach(() => {
    vi.clearAllMocks();
    owner = makeUser('PROFESSOR');
    otherProf = makeUser('PROFESSOR');
    aluno = makeUser('ALUNO');
    admin = makeUser('ADMINISTRADOR');
    draftReq = makeRequest({ status: 'RASCUNHO', requesterId: owner.id });
    openReq = makeRequest({
      status: 'EM_VOTACAO',
      requesterId: otherProf.id,
      requestedAmountCents: 250000,
    });
    usersById = Object.fromEntries([owner, otherProf, aluno, admin].map((u) => [u.id, u]));
    requestsById = { [draftReq.id]: draftReq, [openReq.id]: openReq };
    prisma.user.findUnique.mockImplementation(async ({ where }) => usersById[where.id] || null);
    prisma.resourceRequest.findUnique.mockImplementation(async ({ where }) => requestsById[where.id] || null);
  });

  it('dono lê o próprio rascunho (200)', async () => {
    const res = await request(app)
      .get(`/api/requests/${draftReq.id}`)
      .set('Cookie', cookieFor(owner));
    expect(res.status).toBe(200);
    expect(res.body.request.id).toBe(draftReq.id);
  });

  it('terceiro lê rascunho alheio como 404 (D-08 esconde existência)', async () => {
    const res = await request(app)
      .get(`/api/requests/${draftReq.id}`)
      .set('Cookie', cookieFor(otherProf));
    expect(res.status).toBe(404);
  });

  it('PROFESSOR lê não-rascunho alheio com valores (200, D-05 sem redação)', async () => {
    const res = await request(app)
      .get(`/api/requests/${openReq.id}`)
      .set('Cookie', cookieFor(owner));
    expect(res.status).toBe(200);
    expect(res.body.request.requestedAmountCents).toBe(250000);
  });

  it('ALUNO lê não-rascunho (200, override D-03)', async () => {
    const res = await request(app)
      .get(`/api/requests/${openReq.id}`)
      .set('Cookie', cookieFor(aluno));
    expect(res.status).toBe(200);
  });

  it('ALUNO lê rascunho alheio como 404 (D-04)', async () => {
    const res = await request(app)
      .get(`/api/requests/${draftReq.id}`)
      .set('Cookie', cookieFor(aluno));
    expect(res.status).toBe(404);
  });

  it('ADMINISTRADOR lê qualquer rascunho (200, D-04)', async () => {
    const res = await request(app)
      .get(`/api/requests/${draftReq.id}`)
      .set('Cookie', cookieFor(admin));
    expect(res.status).toBe(200);
  });

  it('sem cookie responde 401', async () => {
    const res = await request(app).get(`/api/requests/${openReq.id}`);
    expect(res.status).toBe(401);
  });

  it('alias /:id/history herda a mesma guarda requests:get', async () => {
    const ok = await request(app)
      .get(`/api/requests/${openReq.id}/history`)
      .set('Cookie', cookieFor(aluno));
    expect(ok.status).toBe(200);
    const denied = await request(app)
      .get(`/api/requests/${draftReq.id}/history`)
      .set('Cookie', cookieFor(aluno));
    expect(denied.status).toBe(404);
  });
});

describe('requirePermission — fail-closed', () => {
  function fakeRes() {
    const res = {};
    res.status = vi.fn(() => res);
    res.json = vi.fn(() => res);
    return res;
  }

  it('ação não declarada falha fechada com 403', () => {
    const next = vi.fn();
    requirePermission('acao:inexistente')({ user: { role: 'ADMINISTRADOR' } }, fakeRes(), next);
    expect(next).not.toHaveBeenCalled();
  });

  it('sem req.user responde 401', () => {
    const res = fakeRes();
    const next = vi.fn();
    requirePermission('requests:get')({}, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('papel fora do mapa responde 403', () => {
    const res = fakeRes();
    const next = vi.fn();
    requirePermission('votes:cast')({ user: { role: 'ALUNO' } }, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('papel permitido chama next()', () => {
    const next = vi.fn();
    requirePermission('votes:cast')({ user: { role: 'CONSELHEIRO' } }, fakeRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});

// POST /api/requests/:id/cancel — matriz RN-010 (04-02) × 5 papéis.
// D-08: 403 papel errado em escopo visível; 404 fora de escopo.
describe('POST /api/requests/:id/cancel — matriz RN-010', () => {
  let users;
  let owner;
  let stranger;
  let draftReq;
  let votingReq;
  let approvedReq;
  let indeferidoReq;
  let doneReq;
  let requestsById;
  let usersById;

  beforeEach(() => {
    vi.clearAllMocks();
    users = {
      admin: makeUser('ADMINISTRADOR'),
      chefe: makeUser('CHEFE_DEPARTAMENTO'),
      conselheiro: makeUser('CONSELHEIRO'),
      professor: makeUser('PROFESSOR'),
      aluno: makeUser('ALUNO'),
    };
    owner = users.professor;
    stranger = makeUser('CONSELHEIRO');
    users.stranger = stranger;
    draftReq = makeRequest({ status: 'RASCUNHO', requesterId: owner.id });
    votingReq = makeRequest({ status: 'EM_VOTACAO', requesterId: owner.id });
    approvedReq = makeRequest({ status: 'APROVADO', requesterId: owner.id });
    indeferidoReq = makeRequest({ status: 'INDEFERIDO', requesterId: owner.id });
    doneReq = makeRequest({ status: 'CONCLUIDO', requesterId: owner.id });
    requestsById = Object.fromEntries(
      [draftReq, votingReq, approvedReq, indeferidoReq, doneReq].map((r) => [r.id, r]),
    );
    const usersByIdLocal = Object.fromEntries(Object.values(users).map((u) => [u.id, u]));
    usersById = usersByIdLocal;
    prisma.user.findUnique.mockImplementation(async ({ where }) => usersById[where.id] || null);
    prisma.resourceRequest.findUnique.mockImplementation(async ({ where }) => requestsById[where.id] || null);
    prisma.resourceRequest.update.mockImplementation(async ({ where }) => ({
      ...requestsById[where.id],
      status: 'CANCELADO',
    }));
  });

  const cancel = (reqId, user, body = { justification: 'Desisti do pedido' }) =>
    request(app).post(`/api/requests/${reqId}/cancel`).set('Cookie', cookieFor(user)).send(body);

  it('dono cancela próprio RASCUNHO (200, forma { ok, request })', async () => {
    const res = await cancel(draftReq.id, owner);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.request.status).toBe('CANCELADO');
  });

  it('dono cancela próprio EM_VOTACAO (200)', async () => {
    const res = await cancel(votingReq.id, owner);
    expect(res.status).toBe(200);
  });

  it('terceiro em escopo visível sem papel recebe 403 (D-08)', async () => {
    const res = await cancel(votingReq.id, stranger);
    expect(res.status).toBe(403);
  });

  it('terceiro fora de escopo (rascunho alheio) recebe 404 (D-08)', async () => {
    const res = await cancel(draftReq.id, stranger);
    expect(res.status).toBe(404);
  });

  it('sem justificativa responde 400', async () => {
    const res = await cancel(votingReq.id, owner, {});
    expect(res.status).toBe(400);
  });

  it('CONCLUIDO é imutável (400)', async () => {
    const res = await cancel(doneReq.id, owner);
    expect(res.status).toBe(400);
  });

  it('líder cancela APROVADO alheio-compatível (200, ramo com reversão Phase 6)', async () => {
    const res = await cancel(approvedReq.id, users.chefe);
    expect(res.status).toBe(200);
  });

  it('dono não-líder não cancela APROVADO próprio (403)', async () => {
    const res = await cancel(approvedReq.id, owner);
    expect(res.status).toBe(403);
  });

  it('ADMIN limpa INDEFERIDO alheio (200)', async () => {
    const res = await cancel(indeferidoReq.id, users.admin);
    expect(res.status).toBe(200);
  });

  it('varredura 5 papéis em EM_VOTACAO alheio: líderes 200, demais 403', async () => {
    const target = makeRequest({ status: 'EM_VOTACAO', requesterId: owner.id });
    requestsById[target.id] = target;
    const outsiderProf = makeUser('PROFESSOR');
    usersById[outsiderProf.id] = outsiderProf;
    const cases = [
      [users.admin, 200],
      [users.chefe, 200],
      [stranger, 403],
      [outsiderProf, 403],
      [users.aluno, 403],
    ];
    for (const [actor, want] of cases) {
      const res = await cancel(target.id, actor);
      expect(res.status, `papel ${actor.role}`).toBe(want);
    }
  });
});

// Mensagens: remove autor-ou-líder (D-07) + list com view-scope do pai.
describe('DELETE /api/messages/:mid + GET /:id/messages — guardas de discussão', () => {
  let author;
  let outsider;
  let aluno;
  let chefe;
  let conselheiro;
  let openReq;
  let draftReq;
  let msg;
  let msgsById;

  beforeEach(() => {
    vi.clearAllMocks();
    author = makeUser('PROFESSOR');
    outsider = makeUser('PROFESSOR');
    aluno = makeUser('ALUNO');
    chefe = makeUser('CHEFE_DEPARTAMENTO');
    conselheiro = makeUser('CONSELHEIRO');
    openReq = makeRequest({ status: 'EM_VOTACAO', requesterId: author.id });
    draftReq = makeRequest({ status: 'RASCUNHO', requesterId: author.id });
    msg = makeMessage(openReq.id, author.id);
    msgsById = { [msg.id]: msg };
    const usersById = Object.fromEntries([author, outsider, aluno, chefe, conselheiro].map((u) => [u.id, u]));
    const requestsById = { [openReq.id]: openReq, [draftReq.id]: draftReq };
    prisma.user.findUnique.mockImplementation(async ({ where }) => usersById[where.id] || null);
    prisma.user.findMany.mockImplementation(async () => Object.values(usersById));
    prisma.resourceRequest.findUnique.mockImplementation(async ({ where }) => requestsById[where.id] || null);
    prisma.deliberationMessage.findUnique.mockImplementation(async ({ where }) => msgsById[where.id] || null);
    prisma.deliberationMessage.findMany.mockImplementation(async () => Object.values(msgsById));
    prisma.deliberationMessage.update.mockImplementation(async ({ where, data }) => ({
      ...msgsById[where.id],
      ...data,
    }));
  });

  it('autor remove a própria mensagem (200)', async () => {
    const res = await request(app).delete(`/api/messages/${msg.id}`).set('Cookie', cookieFor(author));
    expect(res.status).toBe(200);
  });

  it('não-autor não-líder recebe 403', async () => {
    const res = await request(app).delete(`/api/messages/${msg.id}`).set('Cookie', cookieFor(outsider));
    expect(res.status).toBe(403);
  });

  it('ALUNO não-autor recebe 403 (mapa abre, guarda barra)', async () => {
    const res = await request(app).delete(`/api/messages/${msg.id}`).set('Cookie', cookieFor(aluno));
    expect(res.status).toBe(403);
  });

  it('CHEFE remove mensagem alheia (200, D-07)', async () => {
    const res = await request(app).delete(`/api/messages/${msg.id}`).set('Cookie', cookieFor(chefe));
    expect(res.status).toBe(200);
  });

  it('mensagem inexistente responde 404', async () => {
    const res = await request(app).delete('/api/messages/msg-inexistente').set('Cookie', cookieFor(author));
    expect(res.status).toBe(404);
  });

  it('list em pedido visível retorna mensagens (200)', async () => {
    const res = await request(app)
      .get(`/api/requests/${openReq.id}/messages`)
      .set('Cookie', cookieFor(conselheiro));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.messages)).toBe(true);
  });

  it('list em rascunho alheio responde 404 (view-scope do pai)', async () => {
    const res = await request(app)
      .get(`/api/requests/${draftReq.id}/messages`)
      .set('Cookie', cookieFor(outsider));
    expect(res.status).toBe(404);
  });
});

// GET /api/requests — scopeWhere ao nível HTTP: rascunhos invisíveis a
// terceiros, não-rascunhos visíveis a todos (D-03/D-04).
describe('GET /api/requests — invisibilidade de rascunho × visibilidade aberta', () => {
  let owner;
  let aluno;
  let admin;
  let conselheiro;
  let ownDraft;
  let otherDraft;
  let consDraft;
  let open;

  function matches(where, r, user) {
    if (where.OR) return where.OR.some((clause) => matches(clause, r, user));
    if (where.requesterId !== undefined) return String(r.requesterId) === String(where.requesterId);
    if (where.status !== undefined) {
      if (typeof where.status === 'string') return r.status === where.status;
      if (where.status.not) return r.status !== where.status.not;
    }
    return true;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    owner = makeUser('PROFESSOR');
    aluno = makeUser('ALUNO');
    admin = makeUser('ADMINISTRADOR');
    conselheiro = makeUser('CONSELHEIRO');
    const other = makeUser('PROFESSOR');
    ownDraft = makeRequest({ status: 'RASCUNHO', requesterId: owner.id });
    otherDraft = makeRequest({ status: 'RASCUNHO', requesterId: other.id });
    consDraft = makeRequest({ status: 'RASCUNHO', requesterId: conselheiro.id });
    open = makeRequest({ status: 'EM_VOTACAO', requesterId: other.id });
    const store = [ownDraft, otherDraft, consDraft, open];
    const usersById = Object.fromEntries([owner, aluno, admin, conselheiro, other].map((u) => [u.id, u]));
    prisma.user.findUnique.mockImplementation(async ({ where }) => usersById[where.id] || null);
    prisma.resourceRequest.findMany.mockImplementation(async ({ where = {} }) =>
      store.filter((r) => matches(where, r, null)),
    );
  });

  it('dono vê próprio rascunho + não-rascunhos, não o rascunho alheio', async () => {
    const res = await request(app).get('/api/requests').set('Cookie', cookieFor(owner));
    expect(res.status).toBe(200);
    const ids = res.body.requests.map((r) => r.id);
    expect(ids).toContain(ownDraft.id);
    expect(ids).toContain(open.id);
    expect(ids).not.toContain(otherDraft.id);
  });

  it('ALUNO vê não-rascunhos, nenhum rascunho alheio', async () => {
    const res = await request(app).get('/api/requests').set('Cookie', cookieFor(aluno));
    expect(res.status).toBe(200);
    const ids = res.body.requests.map((r) => r.id);
    expect(ids).toContain(open.id);
    expect(ids).not.toContain(ownDraft.id);
    expect(ids).not.toContain(otherDraft.id);
    expect(ids).not.toContain(consDraft.id);
  });

  it('CONSELHEIRO vê próprio rascunho + não-rascunhos, não rascunhos alheios (D-04, CR-01)', async () => {
    const res = await request(app).get('/api/requests').set('Cookie', cookieFor(conselheiro));
    expect(res.status).toBe(200);
    const ids = res.body.requests.map((r) => r.id);
    expect(ids).toContain(consDraft.id);
    expect(ids).toContain(open.id);
    expect(ids).not.toContain(ownDraft.id);
    expect(ids).not.toContain(otherDraft.id);
  });

  it('ADMIN vê tudo, inclusive rascunhos alheios', async () => {
    const res = await request(app).get('/api/requests').set('Cookie', cookieFor(admin));
    expect(res.status).toBe(200);
    const ids = res.body.requests.map((r) => r.id);
    expect(ids).toContain(ownDraft.id);
    expect(ids).toContain(otherDraft.id);
    expect(ids).toContain(consDraft.id);
    expect(ids).toContain(open.id);
  });
});

// GET /api/requests/:id/votes — view-scope com detalhe total (D-01/D-02).
describe('GET /api/requests/:id/votes — escopo de visão com detalhe', () => {
  let conselheiro;
  let aluno;
  let owner;
  let outsider;
  let openReq;
  let draftReq;
  let votes;

  beforeEach(() => {
    vi.clearAllMocks();
    conselheiro = makeUser('CONSELHEIRO');
    aluno = makeUser('ALUNO');
    owner = makeUser('PROFESSOR');
    outsider = makeUser('PROFESSOR');
    openReq = makeRequest({ status: 'EM_VOTACAO', requesterId: outsider.id });
    draftReq = makeRequest({ status: 'RASCUNHO', requesterId: owner.id });
    votes = [makeVote(openReq.id, conselheiro.id)];
    const usersById = Object.fromEntries([conselheiro, aluno, owner, outsider].map((u) => [u.id, u]));
    const requestsById = { [openReq.id]: openReq, [draftReq.id]: draftReq };
    prisma.user.findUnique.mockImplementation(async ({ where }) => usersById[where.id] || null);
    prisma.user.findMany.mockImplementation(async () => Object.values(usersById));
    prisma.resourceRequest.findUnique.mockImplementation(async ({ where }) => requestsById[where.id] || null);
    prisma.vote.findMany.mockImplementation(async ({ where }) =>
      votes.filter((v) => String(v.requestId) === String(where.requestId)),
    );
  });

  it('CONSELHEIRO lê votos sob votação com detalhe total (200, sem redação)', async () => {
    const res = await request(app)
      .get(`/api/requests/${openReq.id}/votes`)
      .set('Cookie', cookieFor(conselheiro));
    expect(res.status).toBe(200);
    expect(res.body.votes).toHaveLength(1);
    expect(res.body.votes[0].voteType).toBe('APROVAR');
    expect(res.body.votes[0].voterId).toBe(conselheiro.id);
  });

  it('ALUNO fora de escopo (rascunho alheio) recebe 404', async () => {
    const res = await request(app)
      .get(`/api/requests/${draftReq.id}/votes`)
      .set('Cookie', cookieFor(aluno));
    expect(res.status).toBe(404);
  });

  it('dono lê votos do próprio rascunho (200)', async () => {
    votes.push(makeVote(draftReq.id, conselheiro.id));
    const res = await request(app)
      .get(`/api/requests/${draftReq.id}/votes`)
      .set('Cookie', cookieFor(owner));
    expect(res.status).toBe(200);
    expect(res.body.votes).toHaveLength(1);
  });
});

// Settings: visão de transações aberta aos 5 papéis; mutação só líderes.
describe('GET /api/settings/transactions × PATCH /api/settings/financial', () => {
  let users;

  beforeEach(() => {
    vi.clearAllMocks();
    users = {
      admin: makeUser('ADMINISTRADOR'),
      chefe: makeUser('CHEFE_DEPARTAMENTO'),
      conselheiro: makeUser('CONSELHEIRO'),
      professor: makeUser('PROFESSOR'),
      aluno: makeUser('ALUNO'),
    };
    const usersById = Object.fromEntries(Object.values(users).map((u) => [u.id, u]));
    prisma.user.findUnique.mockImplementation(async ({ where }) => usersById[where.id] || null);
    prisma.financialTransaction.findMany.mockImplementation(async () => []);
    prisma.departmentSettings.findUnique.mockImplementation(async () => ({
      id: 'default',
      automaticApprovalLimitCents: 500000,
    }));
    prisma.departmentSettings.update.mockImplementation(async ({ data }) => ({ id: 'default', ...data }));
  });

  it.each(['admin', 'chefe', 'conselheiro', 'professor', 'aluno'])(
    'transações visíveis a %s (200)',
    async (key) => {
      const res = await request(app)
        .get('/api/settings/transactions')
        .set('Cookie', cookieFor(users[key]));
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.transactions)).toBe(true);
    },
  );

  it.each(['conselheiro', 'professor', 'aluno'])('PATCH financial barra %s (403, mapa)', async (key) => {
    const res = await request(app)
      .patch('/api/settings/financial')
      .set('Cookie', cookieFor(users[key]))
      .send({ votingDurationHours: 48 });
    expect(res.status).toBe(403);
  });

  it('ADMIN edita financial (200)', async () => {
    const res = await request(app)
      .patch('/api/settings/financial')
      .set('Cookie', cookieFor(users.admin))
      .send({ votingDurationHours: 48 });
    expect(res.status).toBe(200);
  });
});

// Users force-reset: chefe→admin 403 (D-11); admin→professor 200.
describe('POST /api/users/:id/force-password-reset — guarda de alvo', () => {
  let admin;
  let chefe;
  let professor;
  let target;

  beforeEach(() => {
    vi.clearAllMocks();
    admin = makeUser('ADMINISTRADOR');
    chefe = makeUser('CHEFE_DEPARTAMENTO');
    professor = makeUser('PROFESSOR');
    target = professor;
    const usersById = Object.fromEntries([admin, chefe, professor].map((u) => [u.id, u]));
    prisma.user.findUnique.mockImplementation(async ({ where }) => usersById[where.id] || null);
    prisma.user.update.mockImplementation(async ({ where, data }) => ({
      ...usersById[where.id],
      ...data,
    }));
    prisma.emailQueue.create.mockImplementation(async () => ({ id: 'mail-1' }));
  });

  it('CHEFE não reseta ADMIN (403, D-11)', async () => {
    const res = await request(app)
      .post(`/api/users/${admin.id}/force-password-reset`)
      .set('Cookie', cookieFor(chefe));
    expect(res.status).toBe(403);
  });

  it('ADMIN reseta PROFESSOR (200, fluxo intacto)', async () => {
    const res = await request(app)
      .post(`/api/users/${target.id}/force-password-reset`)
      .set('Cookie', cookieFor(admin));
    expect(res.status).toBe(200);
  });

  it('PROFESSOR é barrado no mapa (403)', async () => {
    const res = await request(app)
      .post(`/api/users/${target.id}/force-password-reset`)
      .set('Cookie', cookieFor(professor));
    expect(res.status).toBe(403);
  });
});

// GET /api/reports/voting — filtrado por canViewRequest (D-02).
describe('GET /api/reports/voting — escopo por pedido', () => {
  let aluno;
  let owner;
  let professor;
  let openReq;
  let draftReq;
  let openVote;
  let draftVote;

  beforeEach(() => {
    vi.clearAllMocks();
    aluno = makeUser('ALUNO');
    owner = makeUser('PROFESSOR');
    professor = makeUser('PROFESSOR');
    openReq = makeRequest({ status: 'EM_VOTACAO', requesterId: professor.id });
    draftReq = makeRequest({ status: 'RASCUNHO', requesterId: owner.id });
    openVote = makeVote(openReq.id, professor.id);
    draftVote = makeVote(draftReq.id, owner.id);
    const usersById = Object.fromEntries([aluno, owner, professor].map((u) => [u.id, u]));
    prisma.user.findUnique.mockImplementation(async ({ where }) => usersById[where.id] || null);
    prisma.vote.findMany.mockImplementation(async () => [openVote, draftVote]);
    prisma.viewRequest.findMany.mockImplementation(async () => []);
    prisma.resourceRequest.findMany.mockImplementation(async () => [openReq, draftReq]);
  });

  it('ALUNO vê só votos de pedidos visíveis (rascunho alheio excluído)', async () => {
    const res = await request(app).get('/api/reports/voting').set('Cookie', cookieFor(aluno));
    expect(res.status).toBe(200);
    const ids = res.body.votes.map((v) => v.id);
    expect(ids).toContain(openVote.id);
    expect(ids).not.toContain(draftVote.id);
  });

  it('dono vê votos do próprio rascunho', async () => {
    const res = await request(app).get('/api/reports/voting').set('Cookie', cookieFor(owner));
    expect(res.status).toBe(200);
    const ids = res.body.votes.map((v) => v.id);
    expect(ids).toContain(openVote.id);
    expect(ids).toContain(draftVote.id);
  });
});
