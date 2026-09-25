// Permissões deny-by-default (Fase 4 — SEC-01).
//
// Transcrição do mapa de ações a partir de docs/06-permissoes.md com os
// overrides de decisão D-01..D-11 (ver 04-CONTEXT.md):
// - requests:list/get, votes:list, messages:remove, settings:transactions:view,
//   reports:voting abertos aos 5 papéis com row-guard no controller;
// - votes:cast restrito a CHEFE_DEPARTAMENTO + CONSELHEIRO (elegibilidade
//   permanece no serviço canVote);
// - settings:financial:edit e users:force-reset restritos a
//   ADMINISTRADOR + CHEFE_DEPARTAMENTO.
//
// Ordem de checagem: authenticate (authJwt) → map gate (403) → fetch →
// visibility 404 → ownership 403.

const ALL_ROLES = ['ADMINISTRADOR', 'CHEFE_DEPARTAMENTO', 'CONSELHEIRO', 'PROFESSOR', 'ALUNO'];
const LEADERS = ['ADMINISTRADOR', 'CHEFE_DEPARTAMENTO'];

const PERMISSIONS = Object.freeze({
  // Solicitações
  'requests:list': { roles: ALL_ROLES },
  'requests:create': { roles: ALL_ROLES },
  'requests:get': { roles: ALL_ROLES },
  'requests:submit': { roles: ALL_ROLES }, // + owner/admin/chefe no controller
  'requests:cancel': { roles: ALL_ROLES }, // + matriz RN-010 no controller (04-02)
  // Votação
  'votes:list': { roles: ALL_ROLES }, // + view-scope no controller (D-02)
  'votes:cast': { roles: ['CHEFE_DEPARTAMENTO', 'CONSELHEIRO'] }, // + canVote no serviço
  'votes:vista': { roles: ['ADMINISTRADOR', 'CHEFE_DEPARTAMENTO', 'CONSELHEIRO', 'PROFESSOR'] },
  'votes:close': { roles: LEADERS },
  'votes:suspend': { roles: ['CHEFE_DEPARTAMENTO'] },
  // Discussão (rotas aninhadas em requests + messages)
  'messages:list': { roles: ALL_ROLES }, // + parent canViewRequest (04-02)
  'messages:post': { roles: ['ADMINISTRADOR', 'CHEFE_DEPARTAMENTO', 'CONSELHEIRO', 'PROFESSOR'] },
  'messages:edit': { roles: ALL_ROLES }, // + author-only no controller
  'messages:remove': { roles: ALL_ROLES }, // + author/admin/chefe no controller (D-07, 04-02)
  // Financeiro (rotas aninhadas em requests)
  'finance:mark-spent': { roles: LEADERS },
  'finance:reverse': { roles: LEADERS },
  // Configurações
  'settings:view': { roles: ALL_ROLES },
  'settings:financial:edit': { roles: LEADERS }, // D-10: mutação fica com líderes
  'settings:transactions:view': { roles: ALL_ROLES }, // D-10: visão aberta
  'settings:email:edit': { roles: ['ADMINISTRADOR'] },
  // Relatórios
  'reports:requests': { roles: ALL_ROLES },
  'reports:financial': { roles: LEADERS },
  'reports:voting': { roles: ALL_ROLES }, // + filtro por canViewRequest (D-02)
  'reports:accountability': { roles: ALL_ROLES },
  'reports:integration': { roles: ALL_ROLES },
  'reports:dashboard': { roles: ALL_ROLES },
  // Usuários
  'users:list': { roles: LEADERS },
  'users:batch': { roles: ['ADMINISTRADOR'] },
  'users:create': { roles: LEADERS },
  'users:patch': { roles: ALL_ROLES }, // + canManageUsers no handler (alvo-dependente)
  'users:patch-role': { roles: ALL_ROLES }, // + canManageUsers no handler (alvo-dependente)
  'users:invite': { roles: LEADERS },
  'users:force-reset': { roles: LEADERS }, // + canManageUsers no handler (D-11, 04-02)
});

// Espelha o formato closure de requireRole em middlewares/auth.js:18-24.
// Ação não declarada falha fechada (403). Requer req.user (401 quando ausente).
function requirePermission(action) {
  const fn = (req, res, next) => {
    const entry = PERMISSIONS[action];
    if (!entry) return res.status(403).json({ error: 'Ação não autorizada' });
    if (!req.user) return res.status(401).json({ error: 'Não autenticado' });
    if (!entry.roles.includes(req.user.role)) return res.status(403).json({ error: 'Sem permissão' });
    next();
  };
  // Contrato de detecção para o teste de cobertura de rotas.
  fn._permissionAction = action;
  return fn;
}

module.exports = { PERMISSIONS, requirePermission };
