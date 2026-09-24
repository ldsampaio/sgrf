// Visibilidade de solicitações em um só lugar (Fase 4 — SEC-01, D-03/D-04/D-05).
//
// - canViewRequest(user, request): RASCUNHO visível só ao dono +
//   ADMINISTRADOR/CHEFE_DEPARTAMENTO; todo não-rascunho visível a qualquer
//   papel autenticado (D-03: PROFESSOR/ALUNO veem tudo exceto rascunhos).
// - scopeWhere(user, query): generaliza o scopeFilter de reports.routes.js —
//   PROFESSOR/ALUNO/CONSELHEIRO passam a own-requests OR non-draft.
//
// D-05: campos financeiros seguem o escopo de visão; nenhuma camada de
// redação de valores em nenhum lugar. D-08: fora de escopo lê 404 (não 403).

const LEADER_ROLES = ['ADMINISTRADOR', 'CHEFE_DEPARTAMENTO'];

function canViewRequest(user, r) {
  if (!r || !user) return false;
  if (r.status === 'RASCUNHO') {
    return String(r.requesterId) === String(user.id) || LEADER_ROLES.includes(user.role);
  }
  return true;
}

function scopeWhere(user, q = {}) {
  const where = {};
  // PROFESSOR/ALUNO/CONSELHEIRO: próprios rascunhos + tudo que não é rascunho (D-03/D-04).
  if (['PROFESSOR', 'ALUNO', 'CONSELHEIRO'].includes(user.role)) {
    where.OR = [{ requesterId: user.id }, { status: { not: 'RASCUNHO' } }];
  } else if (q.mine === '1') {
    where.requesterId = user.id;
  }
  if (q.status) where.status = q.status;
  if (q.type) where.type = q.type;
  return where;
}

module.exports = { canViewRequest, scopeWhere };
