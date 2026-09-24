// Matriz authz Wave 0 (Fase 4 — SEC-01, tracer slice em GET /api/requests/:id).
//
// Ordem de checagem exercitada: authenticate → map gate (403) → fetch →
// visibility 404 → ownership 403. Prisma singleton mockado; JWTs reais por
// papel. Esqueleto a ser expandido pelo plano 04-03 (matriz completa).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';
import { mockDb as prisma } from './mockDbState.js';
import { makeUser, makeRequest, cookieFor } from './helpers.js';

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
