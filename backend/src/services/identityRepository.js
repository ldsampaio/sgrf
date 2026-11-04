// Repositório de identidade.
//
// `auth.users` é do SAGA: o sgrf LÊ, nunca escreve (regra de propriedade em
// AGENTS.md). O papel do sgrf mora em `sgrf.user_roles` — nunca no claim
// `role` do JWT (contrato de sessão, passo 6).
const prisma = require('../config/db');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return UUID_RE.test(String(value || ''));
}

// Papel por sistema. `null` quando o usuário ainda não tem papel no sgrf.
async function findRoleRow(userId, repo = prisma) {
  if (!isUuid(userId)) return null;
  return repo.userRole.findUnique({ where: { userId: String(userId) } });
}

// Só ALUNO e PROFESSOR são deriváveis do `role_base` do saga — é a inferência que
// o saga faz (`^a\d+$` → ALUNO) e nada mais. ADMINISTRADOR, CHEFE_DEPARTAMENTO e
// CONSELHEIRO continuam sendo atribuídos pela gestão: aqui não se inventa papel.
const PAPEL_DERIVADO = { ALUNO: 'ALUNO', PROFESSOR: 'PROFESSOR' };

// Find-or-create do papel do sgrf. Sem isto o usuário logado entra e não tem papel
// nenhum: `req.user.role` fica null e toda rota deny-by-default responde 403.
// A linha existente manda — o serviço só cria quando não há papel, nunca sobrescreve.
async function ensureRole(userId, roleBase, repo = prisma) {
  const existente = await findRoleRow(userId, repo);
  if (existente) return existente;

  const role = PAPEL_DERIVADO[String(roleBase || '').toUpperCase()];
  if (!role || !isUuid(userId)) return null;

  try {
    return await repo.userRole.create({ data: { userId: String(userId), role, status: 'ATIVO' } });
  } catch (e) {
    // Corrida entre dois requests: `userId` é chave primária. Quem perde relê,
    // não sobrescreve o papel do outro.
    if (e?.code === 'P2002') return await findRoleRow(userId, repo);
    throw e;
  }
}

async function findIdentity(id) {
  if (!isUuid(id)) return null;
  const user = await prisma.authUser.findUnique({ where: { id: String(id) } });
  if (!user) return null;
  const roleRow = await findRoleRow(user.id);
  return {
    id: user.id,
    login: user.login,
    name: user.name,
    email: user.email,
    roleBase: user.roleBase,
    role: roleRow ? roleRow.role : null,
    status: roleRow ? roleRow.status : null,
  };
}

async function findIdentitiesByIds(ids) {
  const clean = [...new Set((ids || []).filter(isUuid).map(String))];
  if (!clean.length) return [];
  const users = await prisma.authUser.findMany({
    where: { id: { in: clean } },
    select: { id: true, login: true, name: true, email: true, roleBase: true },
  });
  const roles = await prisma.userRole.findMany({ where: { userId: { in: clean } } });
  const roleByUser = new Map(roles.map((r) => [String(r.userId), r]));
  return users.map((u) => ({
    ...u,
    role: roleByUser.get(String(u.id))?.role || null,
    status: roleByUser.get(String(u.id))?.status || null,
  }));
}

// `email` não é unique no schema canônico (o unique é `login`), então a leitura
// é sempre por findMany — nunca findUnique por e-mail.
async function findIdentitiesByEmails(emails) {
  const clean = [...new Set((emails || []).map(String).filter(Boolean))];
  if (!clean.length) return [];
  const users = await prisma.authUser.findMany({
    where: { email: { in: clean } },
    select: { id: true, login: true, name: true, email: true, roleBase: true },
  });
  const roles = await prisma.userRole.findMany({ where: { userId: { in: users.map((u) => u.id) } } });
  const roleByUser = new Map(roles.map((r) => [String(r.userId), r]));
  return users.map((u) => ({
    ...u,
    role: roleByUser.get(String(u.id))?.role || null,
    status: roleByUser.get(String(u.id))?.status || null,
  }));
}

// Lista de usuários: identidade (auth) + papel (sgrf).
async function listUsers() {
  const users = await prisma.authUser.findMany({
    orderBy: { id: 'asc' },
    select: { id: true, login: true, name: true, email: true, roleBase: true },
  });
  const roles = await prisma.userRole.findMany();
  const roleByUser = new Map(roles.map((r) => [String(r.userId), r]));
  return users.map((u) => {
    const row = roleByUser.get(String(u.id));
    return {
      id: u.id,
      login: u.login,
      name: u.name,
      email: u.email,
      roleBase: u.roleBase,
      role: row ? row.role : null,
      status: row ? row.status : null,
    };
  });
}

module.exports = { findIdentity, findIdentitiesByIds, findIdentitiesByEmails, findRoleRow, ensureRole, listUsers, isUuid };
