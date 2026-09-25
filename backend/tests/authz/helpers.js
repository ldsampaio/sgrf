// Helpers da suíte authz (Fase 4 — SEC-01, Wave 0).
//
// Estratégia: mock apenas do singleton Prisma (src/config/db.js) com funções
// vi.fn() por modelo + passthrough de callback no $transaction. authJwt NUNCA
// é stubado — os testes assinam tokens de acesso reais por papel via
// src/utils/tokens.js (mesmo segredo de dev usado pelo verify em teste).
// Apenas APIs compatíveis com Node 22.

import { signAccess } from '../../src/utils/tokens.js';

export const ROLES = ['ADMINISTRADOR', 'CHEFE_DEPARTAMENTO', 'CONSELHEIRO', 'PROFESSOR', 'ALUNO'];

let seq = 0;

export function makeUser(role, overrides = {}) {
  seq += 1;
  return {
    id: `user-${role.toLowerCase()}-${seq}`,
    name: `Teste ${role} ${seq}`,
    email: `authz${seq}@utfpr.edu.br`,
    role,
    status: 'ATIVO',
    ...overrides,
  };
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

export function signToken(user) {
  return signAccess({ id: user.id, role: user.role });
}

export function cookieFor(user) {
  return `access_token=${signToken(user)}`;
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
