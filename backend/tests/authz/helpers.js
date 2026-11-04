// Helpers da suíte authz (Fase 4 — SEC-01, Wave 0).
//
// Estratégia: mock apenas dos singletons (`src/config/db.js`, `src/config/redis.js`,
// `src/utils/tokens.js`) — os controllers usam `require` CJS nativo, então o mock
// entra pelo require.cache antes de o app ser importado.
//
// O que NÃO é stubado: o middleware de sessão em si. Os testes assinam JWTs
// `ES256` reais com uma chave de teste e registram a sessão no Redis fake, de
// modo que o caminho exercitado é o do contrato (docs/session-contract.md):
// heartbeat → cookie → assinatura → meta/gen → req.user → papel em `sgrf.user_roles`.
// Apenas APIs compatíveis com Node 22.

import { createRequire } from 'node:module';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { mockDb, papeisPorUsuario } from './mockDbState.js';

const _require = createRequire(import.meta.url);

const CHAVES = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });

// Redis fake com a forma mínima que o middleware usa (get + hgetall).
// Nenhum cache de sessão em processo: cada request consulta o Redis.
export const fakeRedis = {
  chaves: new Map(),
  async get(chave) {
    return this.chaves.get(chave) ?? null;
  },
  async hgetall(chave) {
    const valor = this.chaves.get(chave);
    return valor && typeof valor === 'object' ? { ...valor } : {};
  },
};

function semeia(modulo, exports) {
  const caminho = _require.resolve(modulo);
  _require.cache[caminho] = { id: caminho, filename: caminho, loaded: true, exports };
}

semeia('../../src/config/redis.js', fakeRedis);
semeia('../../src/utils/tokens.js', {
  verifyAccessToken: async (token) => {
    const header = jwt.decode(token, { complete: true })?.header;
    if (!header || header.alg !== 'ES256' || !header.kid) throw new Error('BAD_TOKEN');
    return jwt.verify(token, CHAVES.publicKey, { algorithms: ['ES256'] });
  },
  getSigningKey: async () => CHAVES.publicKey,
  decodeHeader: (token) => jwt.decode(token, { complete: true })?.header || null,
});

export const ROLES = ['ADMINISTRADOR', 'CHEFE_DEPARTAMENTO', 'CONSELHEIRO', 'PROFESSOR', 'ALUNO'];

let seq = 0;

export function makeUser(role, overrides = {}) {
  seq += 1;
  const user = {
    id: randomUUID(), // `auth.users(id)` é uuid; `findRoleRow` rejeita id que não é uuid
    login: `authz${seq}`,
    name: `Teste ${role} ${seq}`,
    email: `authz${seq}@utfpr.edu.br`,
    roleBase: role === 'ALUNO' ? 'ALUNO' : 'UNDEFINIDO',
    role,
    status: 'ATIVO',
    ...overrides,
  };
  papeisPorUsuario.set(user.id, { userId: user.id, role: user.role, status: user.status });
  return user;
}

export function semPapelNoSgrf(userId) {
  papeisPorUsuario.delete(userId);
}

// Sessão no Redis fake: heartbeat + meta. Sem heartbeat o middleware responde 503
// mesmo com token válido — é o caminho de falha fechada do contrato.
export function comHeartbeat() {
  fakeRedis.chaves.set('saga:heartbeat', '1');
}

export function semHeartbeat() {
  fakeRedis.chaves.delete('saga:heartbeat');
}

export function sidDe(userId) {
  return `sidtest${seq}${userId.slice(0, 8)}`;
}

export function signToken(user, { gen = 1, sid = sidDe(user.id) } = {}) {
  comHeartbeat();
  fakeRedis.chaves.set(`saga:sess:${sid}:meta`, {
    user_id: user.id,
    login: user.login,
    name: user.name,
    email: user.email,
    role_base: user.roleBase,
    gen: String(gen),
  });
  return jwt.sign(
    { iss: 'saga', sub: user.id, sid, gen, role: user.role },
    CHAVES.privateKey,
    { algorithm: 'ES256', keyid: 'saga-1' },
  );
}

export function cookieFor(user, opts = {}) {
  return `saga_session=${signToken(user, opts)}`;
}

export function revogaSessão(user, sid = sidDe(user.id)) {
  fakeRedis.chaves.delete(`saga:sess:${sid}:meta`);
}

export function makeRequest(overrides = {}) {
  seq += 1;
  return {
    id: `req-${seq}`,
    title: `Pedido teste ${seq}`,
    type: 'EQUIPAMENTO',
    status: 'EM_VOTACAO',
    requesterId: 'owner-desconhecido',
    requestedAmountCents: 150000,
    approvedAmountCents: 0,
    referenceYear: 2026,
    createdAt: new Date(),
    ...overrides,
  };
}

export function makeVote(requestId, voterId, overrides = {}) {
  seq += 1;
  return {
    id: `vote-${seq}`,
    requestId,
    voterId,
    voteType: 'APROVAR',
    comment: 'De acordo',
    approvedAmountCents: 150000,
    tieBreak: false,
    createdAt: new Date(),
    ...overrides,
  };
}

export function makeMessage(requestId, authorId, overrides = {}) {
  seq += 1;
  return {
    id: `msg-${seq}`,
    requestId,
    authorId,
    parentMessageId: null,
    content: `Mensagem teste ${seq}`,
    history: '[]',
    deletedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}
