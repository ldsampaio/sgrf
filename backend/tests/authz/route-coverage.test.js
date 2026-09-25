// Cobertura de rotas: toda rota dos 5 arquivos tocados pela Fase 4 declara
// uma ação de permissão (contrato: frame carrega fn._permissionAction,
// tagueado pela fábrica requirePermission). Rota sem tag falha a suíte —
// é a forma executável do "undeclared fails closed".
//
// Escopo: apenas os roteadores da fase (requests/messages/settings/reports/
// users). /api/auth fica fora de propósito (login é público).

import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'node:module';
import { mockDb } from './mockDbState.js';

// Ver matrix.test.js: roteadores usam `require` CJS nativo; o mock só os
// alcança via require.cache, semeado antes dos imports dinâmicos abaixo.
const _require = createRequire(import.meta.url);
const _dbPath = _require.resolve('../../src/config/db.js');
if (!_require.cache[_dbPath]) {
  _require.cache[_dbPath] = { id: _dbPath, filename: _dbPath, loaded: true, exports: mockDb };
}

const { default: requestsRouter } = await import('../../src/routes/requests.routes.js');
const { default: messagesRouter } = await import('../../src/routes/messages.routes.js');
const { default: settingsRouter } = await import('../../src/routes/settings.routes.js');
const { default: reportsRouter } = await import('../../src/routes/reports.routes.js');
const { default: usersRouter } = await import('../../src/routes/users.routes.js');

const ROUTERS = {
  'requests.routes.js': requestsRouter,
  'messages.routes.js': messagesRouter,
  'settings.routes.js': settingsRouter,
  'reports.routes.js': reportsRouter,
  'users.routes.js': usersRouter,
};

function untaggedRoutes(router) {
  const missing = [];
  for (const layer of router.stack || []) {
    if (!layer.route) continue; // router.use(authJwt) etc. — não é rota
    const methods = Object.keys(layer.route.methods || {})
      .filter((m) => layer.route.methods[m] && !m.startsWith('_'))
      .join(',')
      .toUpperCase();
    const frames = layer.route.stack || [];
    const ok = frames.some((l) => l.handle && l.handle._permissionAction);
    if (!ok) missing.push(`${methods} ${layer.route.path}`);
  }
  return missing;
}

describe('cobertura de permissão por rota (deny-by-default)', () => {
  it('toda rota dos 5 arquivos declara requirePermission', () => {
    const missing = {};
    for (const [name, router] of Object.entries(ROUTERS)) {
      const m = untaggedRoutes(router);
      if (m.length > 0) missing[name] = m;
    }
    expect(missing).toEqual({});
  });

  it('cada roteador declara ao menos uma rota (guarda contra passe vazio)', () => {
    for (const [name, router] of Object.entries(ROUTERS)) {
      const count = (router.stack || []).filter((l) => l.route).length;
      expect(count, name).toBeGreaterThan(0);
    }
  });

  it('controle negativo: rota sem tag é detectada (undeclared fails closed)', () => {
    const sneaky = {
      stack: [
        {
          route: {
            path: '/sneaky',
            methods: { get: true },
            stack: [{ handle: (req, res, next) => next() }],
          },
        },
      ],
    };
    expect(untaggedRoutes(sneaky)).toEqual(['GET /sneaky']);
  });

  it('controle positivo: frame tagueado passa na asserção', () => {
    const tagged = {
      stack: [
        {
          route: {
            path: '/ok',
            methods: { post: true },
            stack: [{ handle: Object.assign((req, res, next) => next(), { _permissionAction: 'reports:dashboard' }) }],
          },
        },
      ],
    };
    expect(untaggedRoutes(tagged)).toEqual([]);
  });
});
