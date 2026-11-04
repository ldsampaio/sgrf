// Contrato de sessão (docs/session-contract.md) exercitado no sgrf.
//
// O que estes testes provam, na ordem do contrato:
//   1. heartbeat ausente → 503, MESMO com JWT válido e JWKS cacheado;
//   2. cookie ausente → 401 NO_SESSION com login_url;
//   3. assinatura/exp/kid inválidos → 401 BAD_TOKEN;
//   4. meta vazio → 401 SESSION_DEAD; gen divergente → 401 SESSION_STALE;
//   5. req.user vem do Redis, não do banco;
//   6. papel vem de `sgrf.user_roles`, nunca do claim `role` do JWT.
// E T10: nenhuma rota aceita credencial, nenhuma coluna de senha existe, o token
// nunca é escrito em log, o erro não revela se o login existe, e 503 não redireciona.

import { describe, it, expect, beforeEach } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import jwt from 'jsonwebtoken';
import { createRequire } from 'node:module';

const _require = createRequire(import.meta.url);

// Redis fake com a forma mínima que o middleware usa (get + hgetall).
// Sem cache de sessão em processo: cada request consulta o Redis.
class RedisFake {
  constructor() {
    this.chaves = new Map();
  }

  async get(chave) {
    return this.chaves.get(chave) ?? null;
  }

  async hgetall(chave) {
    const valor = this.chaves.get(chave);
    return valor && typeof valor === 'object' ? { ...valor } : {};
  }

  set(chave, valor) {
    this.chaves.set(chave, valor);
  }

  del(chave) {
    this.chaves.delete(chave);
  }
}

// O require de `src/config/redis.js` abriria uma conexão real. O teste injeta o
// fake por deps, mas o módulo ainda é carregado — então o cache do Node entra
// com o fake antes de `src/middlewares/auth.js` ser requerido.
_require.cache[_require.resolve('../src/config/redis.js')] = {
  id: _require.resolve('../src/config/redis.js'),
  filename: _require.resolve('../src/config/redis.js'),
  loaded: true,
  exports: { get: async () => null, hgetall: async () => ({}) },
};

const { createAuthMiddleware, buildLoginUrl } = _require('../src/middlewares/auth.js');
const { rejectCredentialFields } = _require('../src/middlewares/noCredentialFields.js');
const { ensureRole } = _require('../src/services/identityRepository.js');

const CHAVES = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const OUTRA_CHAVE = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });

// Resolver "cacheado" por kid. Serve para provar que cache de chave nunca
// concede acesso sozinho: sem heartbeat a resposta continua 503.
function resolverCacheado(publicKey, kidConhecido = 'saga-1') {
  const cache = new Map();
  return async function resolver(kid) {
    if (kid !== kidConhecido) throw new Error('kid desconhecido');
    if (!cache.has(kid)) cache.set(kid, publicKey);
    return cache.get(kid);
  };
}

function token(payload, chave = CHAVES.privateKey, kid = 'saga-1') {
  return jwt.sign(payload, chave, { algorithm: 'ES256', keyid: kid });
}

function requisicao(cookie, headers = {}) {
  return {
    cookies: cookie ? { saga_session: cookie } : {},
    headers: { host: 'localhost:5174', ...headers },
    originalUrl: '/api/auth/me',
  };
}

function respostaCapturada() {
  const captura = { status: 0, body: null, headers: {} };
  return {
    status: (codigo) => {
      captura.status = codigo;
      return {
        json: (corpo) => {
          captura.body = corpo;
        },
      };
    },
    set: (chave, valor) => {
      captura.headers[chave] = valor;
    },
    captura,
  };
}

// Env de teste para o caminho de login_url. A allowlist é por host sem porta; o teste
// 'redirect só aparece quando o host de origem está na allowlist' exercita os dois lados.
const ENV_TESTE = {
  sagaLoginUrl: 'http://localhost:8000/login',
  portalAllowedRedirectHosts: ['localhost'],
};

// `ensureRole` exige o formato UUID de `auth.users`, então os ids destes testes
// precisam bater — `u1` não passa em `isUuid`.
const USR_ALUNO = '11111111-1111-4111-8111-111111111111';
const USR_INDEF = '22222222-2222-4222-8222-222222222222';
const USR_PAPEL = '33333333-3333-4333-8333-333333333333';
const USR_ADMIN = '44444444-4444-4444-8444-444444444444';

function ambiente({ redis, papel = null, resolver, resolveRole } = {}) {
  return {
    redis: redis || new RedisFake(),
    verifyAccessToken: async (tokenString) => {
      const header = jwt.decode(tokenString, { complete: true })?.header;
      if (!header || header.alg !== 'ES256' || !header.kid) throw new Error('BAD_TOKEN');
      const chave = await (resolver || resolverCacheado(CHAVES.publicKey))(header.kid);
      return jwt.verify(tokenString, chave, { algorithms: ['ES256'] });
    },
    resolveRole: resolveRole || (async () => papel),
    buildLoginUrl: (req) => buildLoginUrl(req, ENV_TESTE),
  };
}

// Repositório em memória com a forma mínima que `ensureRole` usa. Sem banco: o que
// se prova aqui é a decisão de derivação, não o Postgres.
function repoFake(linhas = new Map()) {
  return {
    linhas,
    userRole: {
      findUnique: async ({ where }) => linhas.get(String(where.userId)) || null,
      create: async ({ data }) => {
        const linha = { userId: String(data.userId), role: data.role, status: data.status };
        linhas.set(linha.userId, linha);
        return linha;
      },
      update: async ({ where, data }) => {
        const linha = linhas.get(String(where.userId));
        Object.assign(linha, data);
        return linha;
      },
    },
  };
}

describe('1. Falha fechada — sem heartbeat não há acesso', () => {
  let redis;

  beforeEach(() => {
    redis = new RedisFake();
    redis.set('saga:sess:sidtest0001:meta', { user_id: 'u1', login: 'a234561', role_base: 'ALUNO', gen: '1' });
  });

  it('503 mesmo com JWT válido e JWKS cacheado', async () => {
    const middleware = createAuthMiddleware(ambiente({ redis }));
    const res = respostaCapturada();
    const req = requisicao(token({ iss: 'saga', sub: 'u1', sid: 'sidtest0001', gen: 1, role: 'ALUNO' }));

    await middleware(req, res, () => {
      throw new Error('não deveria chegar ao handler');
    });

    expect(res.captura.status).toBe(503);
    expect(res.captura.body.code).toBe('IDENTITY_UNAVAILABLE');
    expect(res.captura.headers['Retry-After']).toBe('30');
  });

  it('Redis inacessível → 503, sem fallback de cache', async () => {
    const redisFalho = {
      get: async () => {
        throw new Error('connection refused');
      },
      hgetall: async () => {
        throw new Error('connection refused');
      },
    };
    const middleware = createAuthMiddleware(ambiente({ redis: redisFalho }));
    const res = respostaCapturada();
    await middleware(requisicao(token({ iss: 'saga', sub: 'u1', sid: 'sidtest0001', gen: 1 })), res, () => {});
    expect(res.captura.status).toBe(503);
  });
});

describe('2–4. Caminhos de sessão', () => {
  let redis;
  let middleware;

  beforeEach(() => {
    redis = new RedisFake();
    redis.set('saga:heartbeat', '1');
    middleware = createAuthMiddleware(ambiente({ redis }));
  });

  async function chamar(cookie) {
    const res = respostaCapturada();
    let passou = false;
    await middleware(requisicao(cookie), res, () => {
      passou = true;
    });
    return { res, passou };
  }

  it('sem cookie → 401 NO_SESSION com login_url', async () => {
    const { res, passou } = await chamar(null);
    expect(passou).toBe(false);
    expect(res.captura.status).toBe(401);
    expect(res.captura.body.code).toBe('NO_SESSION');
    // Allowlist por host sem porta: o header vem `localhost:5174` e a allowlist declara
    // `localhost`, então o redirect entra. Sem allowlist viria só a base.
    expect(res.captura.body.login_url).toBe('http://localhost:8000/login?redirect=%2Fapi%2Fauth%2Fme');
  });

  it('assinatura de outra chave → 401 BAD_TOKEN', async () => {
    redis.set('saga:sess:sidtest0002:meta', { user_id: 'u1', gen: '1' });
    const { res } = await chamar(token({ iss: 'saga', sub: 'u1', sid: 'sidtest0002', gen: 1 }, OUTRA_CHAVE.privateKey));
    expect(res.captura.status).toBe(401);
    expect(res.captura.body.code).toBe('BAD_TOKEN');
  });

  it('token expirado → 401 BAD_TOKEN', async () => {
    const expirado = jwt.sign({ iss: 'saga', sub: 'u1', sid: 'sidtest0003', gen: 1 }, CHAVES.privateKey, {
      algorithm: 'ES256',
      keyid: 'saga-1',
      expiresIn: '-1s',
    });
    const { res } = await chamar(expirado);
    expect(res.captura.status).toBe(401);
    expect(res.captura.body.code).toBe('BAD_TOKEN');
  });

  it('kid desconhecido → 401 BAD_TOKEN', async () => {
    const { res } = await chamar(token({ iss: 'saga', sub: 'u1', sid: 'sidtest0004', gen: 1 }, CHAVES.privateKey, 'kid-estranho'));
    expect(res.captura.status).toBe(401);
    expect(res.captura.body.code).toBe('BAD_TOKEN');
  });

  it('sessão revogada no Redis → 401 SESSION_DEAD', async () => {
    const sid = 'sidtest0005';
    redis.set(`saga:sess:${sid}:meta`, { user_id: 'u1', login: 'a1', gen: '1' });
    const t = token({ iss: 'saga', sub: 'u1', sid, gen: 1 });

    const antes = await chamar(t);
    expect(antes.passou).toBe(true);

    redis.del(`saga:sess:${sid}:meta`);
    const depois = await chamar(t);
    expect(depois.passou).toBe(false);
    expect(depois.res.captura.status).toBe(401);
    expect(depois.res.captura.body.code).toBe('SESSION_DEAD');
  });

  it('gen divergente → 401 SESSION_STALE', async () => {
    redis.set('saga:sess:sidtest0006:meta', { user_id: 'u1', gen: '2' });
    const { res } = await chamar(token({ iss: 'saga', sub: 'u1', sid: 'sidtest0006', gen: 1 }));
    expect(res.captura.status).toBe(401);
    expect(res.captura.body.code).toBe('SESSION_STALE');
  });

  it('sid com charset inesperado não monta chave Redis (BAD_TOKEN)', async () => {
    const { res } = await chamar(token({ iss: 'saga', sub: 'u1', sid: 'saga:heartbeat', gen: 1 }));
    expect(res.captura.status).toBe(401);
    expect(res.captura.body.code).toBe('BAD_TOKEN');
  });
});

describe('5–6. req.user do Redis e papel do sistema', () => {
  it('req.user vem do Redis; o papel vem de sgrf.user_roles, não do claim role', async () => {
    const redis = new RedisFake();
    redis.set('saga:heartbeat', '1');
    redis.set('saga:sess:sidtest0007:meta', {
      user_id: 'u1',
      login: 'a234561',
      name: 'Ana',
      email: 'ana@utfpr.edu.br',
      role_base: 'ALUNO',
      gen: '1',
    });

    let usuario = null;
    const middleware = createAuthMiddleware(ambiente({ redis, papel: { role: 'CONSELHEIRO', status: 'ATIVO' } }));
    const res = respostaCapturada();
    const req = requisicao(token({ iss: 'saga', sub: 'u1', sid: 'sidtest0007', gen: 1, role: 'PROFESSOR' }));
    await middleware(req, res, () => {
      usuario = req.user;
    });

    expect(res.captura.status).toBe(0);
    expect(usuario.id).toBe('u1');
    expect(usuario.login).toBe('a234561');
    expect(usuario.roleBase).toBe('ALUNO');
    expect(usuario.role).toBe('CONSELHEIRO'); // claim `role` dizia outra coisa
  });

  it('sem linha em sgrf.user_roles, o papel deriva do role_base (find-or-create)', async () => {
    const redis = new RedisFake();
    redis.set('saga:heartbeat', '1');
    redis.set('saga:sess:sidtest0008:meta', { user_id: USR_ALUNO, login: 'a1', role_base: 'ALUNO', gen: '1' });

    const repo = repoFake();
    let usuario = null;
    const middleware = createAuthMiddleware(ambiente({ redis, resolveRole: (id, roleBase, login) => ensureRole(id, roleBase, login, repo) }));
    const req = requisicao(token({ iss: 'saga', sub: USR_ALUNO, sid: 'sidtest0008', gen: 1 }));
    await middleware(req, respostaCapturada(), () => {
      usuario = req.user;
    });

    // Antes o middleware só lia, e sem linha o papel chegava null — toda rota
    // deny-by-default respondia 403 para um usuário recém-chegado do saga.
    expect(usuario.role).toBe('ALUNO');
    expect(usuario.status).toBe('ATIVO');
    expect(repo.linhas.get(USR_ALUNO)).toEqual({ userId: USR_ALUNO, role: 'ALUNO', status: 'ATIVO' });
  });

  it('UNDEFINIDO não inventa papel — o mapa de permissão barra', async () => {
    const redis = new RedisFake();
    redis.set('saga:heartbeat', '1');
    redis.set('saga:sess:sidtest0010:meta', { user_id: USR_INDEF, login: 'prof.x', role_base: 'UNDEFINIDO', gen: '1' });

    const repo = repoFake();
    let usuario = null;
    const middleware = createAuthMiddleware(ambiente({ redis, resolveRole: (id, roleBase, login) => ensureRole(id, roleBase, login, repo) }));
    const req = requisicao(token({ iss: 'saga', sub: USR_INDEF, sid: 'sidtest0010', gen: 1 }));
    await middleware(req, respostaCapturada(), () => {
      usuario = req.user;
    });

    // Só ALUNO e PROFESSOR são deriváveis. Chefe/Conselheiro/Administrador continuam
    // sendo atribuídos pela gestão — aqui não se inventa papel.
    expect(usuario.role).toBe(null);
    expect(repo.linhas.size).toBe(0);
  });

  it('linha existente nunca é sobrescrita pela derivação', async () => {
    const repo = repoFake();
    repo.linhas.set(USR_PAPEL, { userId: USR_PAPEL, role: 'CONSELHEIRO', status: 'INATIVO' });

    const papel = await ensureRole(USR_PAPEL, 'PROFESSOR', 'cons.vot04', repo);
    expect(papel.role).toBe('CONSELHEIRO');
    expect(papel.status).toBe('INATIVO');
  });

  it('o admin do sistema é ADMINISTRADOR, e a linha existente é corrigida', async () => {
    const repo = repoFake();
    // O admin chegou antes pela derivação e ficou PROFESSOR.
    repo.linhas.set(USR_ADMIN, { userId: USR_ADMIN, role: 'PROFESSOR', status: 'ATIVO' });

    const papel = await ensureRole(USR_ADMIN, 'PROFESSOR', 'Ldsampaio', repo);
    expect(papel.role).toBe('ADMINISTRADOR');

    const novo = repoFake();
    const criado = await ensureRole(USR_ADMIN, 'PROFESSOR', 'ldsampaio', novo);
    expect(criado.role).toBe('ADMINISTRADOR');
    expect(novo.linhas.get(USR_ADMIN)).toEqual({ userId: USR_ADMIN, role: 'ADMINISTRADOR', status: 'ATIVO' });
  });

  it('corrida de criação (unique) relê, nunca sobrescreve', async () => {
    const repo = repoFake();
    repo.userRole.create = async ({ data }) => {
      // O outro request venceu a corrida e escreveu primeiro.
      repo.linhas.set(String(data.userId), { userId: String(data.userId), role: 'PROFESSOR', status: 'ATIVO' });
      const erro = new Error('Unique constraint failed');
      erro.code = 'P2002';
      throw erro;
    };

    const papel = await ensureRole(USR_ALUNO, 'ALUNO', 'a1', repo);
    expect(papel.role).toBe('PROFESSOR');
  });
});

describe('401 e 503 são caminhos distintos', () => {
  it('503 não carrega login_url — o frontend não redireciona para o serviço que caiu', async () => {
    const middleware = createAuthMiddleware(ambiente({ redis: new RedisFake() }));
    const res = respostaCapturada();
    await middleware(requisicao(token({ iss: 'saga', sub: 'u1', sid: 'sidtest0009', gen: 1 })), res, () => {});
    expect(res.captura.status).toBe(503);
    expect('login_url' in res.captura.body).toBe(false);
    expect(res.captura.body.message).toBe(
      'Não foi possível confirmar sua identidade. Acesso negado. O serviço de autenticação não está respondendo.',
    );
  });

  it('redirect só aparece quando o host de origem está na allowlist', () => {
    const fora = { headers: { host: 'evil.example.com' }, originalUrl: '/api/x' };
    expect(buildLoginUrl(fora, ENV_TESTE)).toBe('http://localhost:8000/login');

    const permitido = { headers: { host: 'localhost' }, originalUrl: '/api/x' };
    expect(buildLoginUrl(permitido, ENV_TESTE)).toContain('?redirect=');
  });
});

describe('T10 no sgrf', () => {
  const SENHA = 'SenhaQueNuncaDeveAparecer-9!';

  it('nenhuma rota aceita campo senha', async () => {
    const res = respostaCapturada();
    let passou = false;
    await rejectCredentialFields({ body: { login: 'a1', password: SENHA } }, res, () => {
      passou = true;
    });
    expect(passou).toBe(false);
    expect(res.captura.status).toBe(400);
    expect(JSON.stringify(res.captura.body)).not.toContain(SENHA);
  });

  it('nenhuma coluna de senha existe no schema do sgrf', () => {
    const schema = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'prisma', 'schema.prisma'), 'utf-8');
    // Só as declarações de modelo importam — comentários explicam a regra e
    // mencionam a ausência de credencial de propósito.
    const declaracoes = schema
      .split('\n')
      .filter((linha) => !linha.trimStart().startsWith('//'))
      .join('\n')
      .toLowerCase();
    for (const termo of ['passwordhash', 'password', 'senha', 'mustchangepassword', 'lockeduntil', 'failedloginattempts', 'temporarypassword']) {
      expect(declaracoes).not.toContain(termo);
    }
  });

  it('o token de sessão nunca é escrito em log', async () => {
    const logger = _require('../src/config/logger.js');
    const redis = new RedisFake();
    redis.set('saga:heartbeat', '1');
    redis.set('saga:sess:sidtest0010:meta', { user_id: 'u1', login: 'a1', role_base: 'ALUNO', gen: '1' });
    const t = token({ iss: 'saga', sub: 'u1', sid: 'sidtest0010', gen: 1 });

    const saida = [];
    const original = logger.info;
    logger.info = (obj) => saida.push(JSON.stringify(obj));
    try {
      const middleware = createAuthMiddleware(ambiente({ redis }));
      await middleware({ cookies: { saga_session: t }, headers: { host: 'localhost' }, originalUrl: '/api/auth/me' }, respostaCapturada(), () => {});
    } finally {
      logger.info = original;
    }
    const registrado = saida.join('\n');
    expect(registrado).not.toContain(t);
    expect(registrado).not.toContain('sidtest0010');
  });

  it('erro de autenticação não revela se o login existe', async () => {
    const redis = new RedisFake();
    redis.set('saga:heartbeat', '1');
    const middleware = createAuthMiddleware(ambiente({ redis }));

    const semSessao = respostaCapturada();
    await middleware(requisicao(null), semSessao, () => {});

    redis.set('saga:sess:sidtest00011:meta', { user_id: 'u1', login: 'a1', gen: '1' });
    redis.del('saga:sess:sidtest00011:meta');
    const sessaoMorta = respostaCapturada();
    await middleware(requisicao(token({ iss: 'saga', sub: 'u1', sid: 'sidtest0011', gen: 1 })), sessaoMorta, () => {});

    expect(sessaoMorta.captura.body.message).toBe(semSessao.captura.body.message);
    expect(JSON.stringify(sessaoMorta.captura.body)).not.toContain('a1');
  });
});
