import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// O sgrf não autentica credencial: não há segredos de JWT próprios, não há cookie
// próprio e não há senha de admin. O que precisa ser seguro em produção é o acesso
// ao Redis (ACL read-only) e as URLs do saga. Este arquivo exercita esse gate.
const CHAVES_GATE = ['REDIS_URL', 'SAGA_JWKS_URL', 'SAGA_LOGIN_URL', 'PORTAL_ALLOWED_REDIRECT_HOSTS'];

describe('SEC-02 Production gate on the session contract - Throw/No-throw matrix', () => {
  const originalEnv = { ...process.env };

  function limpaGate() {
    for (const chave of CHAVES_GATE) delete process.env[chave];
  }

  beforeEach(() => {
    vi.resetModules();
    delete process.env.NODE_ENV;
    limpaGate();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  function carregarEnv(envVars) {
    limpaGate();
    Object.assign(process.env, envVars);
    vi.resetModules();
    delete require.cache[require.resolve('../src/config/env.js')];
    return require('../src/config/env.js');
  }

  describe('Throw cases - production refused to boot with insecure values', () => {
    it('throws when REDIS_URL is empty in production', () => {
      expect(() =>
        carregarEnv({ NODE_ENV: 'production', REDIS_URL: '', SAGA_JWKS_URL: 'https://saga.utfpr.edu.br/.well-known/jwks.json', SAGA_LOGIN_URL: 'https://saga.utfpr.edu.br/login', PORTAL_ALLOWED_REDIRECT_HOSTS: 'saga.utfpr.edu.br' })
      ).toThrow('insecure');
    });

    it('throws when REDIS_URL uses the default (full-access) user instead of saga_readonly', () => {
      expect(() =>
        carregarEnv({ NODE_ENV: 'production', REDIS_URL: 'redis://dev-redis@redis:6379/0', SAGA_JWKS_URL: 'https://saga.utfpr.edu.br/.well-known/jwks.json', SAGA_LOGIN_URL: 'https://saga.utfpr.edu.br/login', PORTAL_ALLOWED_REDIRECT_HOSTS: 'saga.utfpr.edu.br' })
      ).toThrow('saga_readonly');
    });

    it('throws when SAGA_JWKS_URL contains the change-me placeholder', () => {
      expect(() =>
        carregarEnv({ NODE_ENV: 'production', REDIS_URL: 'redis://saga_readonly:seguro@redis:6379/0', SAGA_JWKS_URL: 'https://change-me/.well-known/jwks.json', SAGA_LOGIN_URL: 'https://saga.utfpr.edu.br/login', PORTAL_ALLOWED_REDIRECT_HOSTS: 'saga.utfpr.edu.br' })
      ).toThrow('insecure');
    });

    it('throws when SAGA_LOGIN_URL starts with the dev- prefix', () => {
      expect(() =>
        carregarEnv({ NODE_ENV: 'production', REDIS_URL: 'redis://saga_readonly:seguro@redis:6379/0', SAGA_JWKS_URL: 'https://saga.utfpr.edu.br/.well-known/jwks.json', SAGA_LOGIN_URL: 'dev-login', PORTAL_ALLOWED_REDIRECT_HOSTS: 'saga.utfpr.edu.br' })
      ).toThrow('insecure');
    });

    it('throws when the redirect allowlist is empty (open redirect)', () => {
      expect(() =>
        carregarEnv({ NODE_ENV: 'production', REDIS_URL: 'redis://saga_readonly:seguro@redis:6379/0', SAGA_JWKS_URL: 'https://saga.utfpr.edu.br/.well-known/jwks.json', SAGA_LOGIN_URL: 'https://saga.utfpr.edu.br/login', PORTAL_ALLOWED_REDIRECT_HOSTS: '' })
      ).toThrow('PORTAL_ALLOWED_REDIRECT_HOSTS');
    });

    it('throws when multiple variables are insecure simultaneously', () => {
      expect(() =>
        carregarEnv({ NODE_ENV: 'production', REDIS_URL: '', SAGA_JWKS_URL: 'https://change-me/jwks', SAGA_LOGIN_URL: 'dev-login', PORTAL_ALLOWED_REDIRECT_HOSTS: '' })
      ).toThrow('insecure');
    });

    it('does not throw when SKIP_GW_ENV=true (test escape hatch)', () => {
      expect(() =>
        carregarEnv({ NODE_ENV: 'production', SKIP_GW_ENV: 'true', REDIS_URL: '', SAGA_JWKS_URL: '', SAGA_LOGIN_URL: '', PORTAL_ALLOWED_REDIRECT_HOSTS: '' })
      ).not.toThrow();
    });
  });

  describe('No-throw cases - dev fallbacks intact', () => {
    it('loads without throw when NODE_ENV=development', () => {
      const config = carregarEnv({ NODE_ENV: 'development' });
      expect(config.redisUrl).toContain('saga_readonly');
      expect(config.sagaJwksUrl).toContain('.well-known/jwks.json');
    });

    it('loads without throw when NODE_ENV=test with secure values', () => {
      const config = carregarEnv({
        NODE_ENV: 'test',
        REDIS_URL: 'redis://saga_readonly:seguro@redis:6379/0',
        SAGA_JWKS_URL: 'https://saga.utfpr.edu.br/.well-known/jwks.json',
        SAGA_LOGIN_URL: 'https://saga.utfpr.edu.br/login',
        PORTAL_ALLOWED_REDIRECT_HOSTS: 'saga.utfpr.edu.br',
      });
      expect(config.sagaLoginUrl).toBe('https://saga.utfpr.edu.br/login');
    });
  });

  describe('Allowlist de redirect (anti open-redirect)', () => {
    it('parseja lista separada por vírgula, minúscula e sem wildcard', () => {
      const config = carregarEnv({
        NODE_ENV: 'test',
        SKIP_GW_ENV: 'true',
        PORTAL_ALLOWED_REDIRECT_HOSTS: 'saga.utfpr.edu.br, localhost , outro.utfpr.edu.br',
      });
      expect(config.portalAllowedRedirectHosts).toEqual(['saga.utfpr.edu.br', 'localhost', 'outro.utfpr.edu.br']);
    });

    it('allowlist vazia produz lista vazia — o middleware não monta redirect', () => {
      const config = carregarEnv({ NODE_ENV: 'test', SKIP_GW_ENV: 'true', PORTAL_ALLOWED_REDIRECT_HOSTS: '' });
      expect(config.portalAllowedRedirectHosts).toEqual([]);
    });
  });

  describe('Cookie compartilhado e chave de heartbeat', () => {
    it('o sgrf usa o cookie do saga e nunca define cookie próprio', () => {
      const config = carregarEnv({ NODE_ENV: 'test', SKIP_GW_ENV: 'true' });
      expect(config.sessionCookieName).toBe('saga_session');
      expect(config.heartbeatKey).toBe('saga:heartbeat');
      // Não há cookieSecure: quem define o cookie é o saga.
      expect(config.cookieSecure).toBeUndefined();
    });
  });

  describe('Seed: só papel, nunca credencial', () => {
    it('initialAdminLogin é normalizado para minúsculas', () => {
      const config = carregarEnv({ NODE_ENV: 'test', SKIP_GW_ENV: 'true', INITIAL_ADMIN_LOGIN: 'Ldsampaio' });
      expect(config.initialAdminLogin).toBe('ldsampaio');
    });

    it('não existe variável de senha de admin', () => {
      const config = carregarEnv({ NODE_ENV: 'test', SKIP_GW_ENV: 'true' });
      expect(config.initialAdminPassword).toBeUndefined();
      expect(config.initialAdminEmail).toBeUndefined();
    });
  });
});

// T10 no sgrf: o módulo de token não assina nada. Se alguém reintroduzir
// signAccess/signRefresh/cookieOpts, este teste falha.
describe('T10 — o sgrf não assina token nem define cookie', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('tokens.js exporta só verificação, nenhuma função de assinatura', () => {
    const tokens = require('../src/utils/tokens.js');
    expect(tokens.verifyAccessToken).toBeInstanceOf(Function);
    expect(tokens.getSigningKey).toBeInstanceOf(Function);
    expect(tokens.decodeHeader).toBeInstanceOf(Function);
    expect(tokens.signAccess).toBeUndefined();
    expect(tokens.signRefresh).toBeUndefined();
    expect(tokens.cookieOpts).toBeUndefined();
  });

  it('o utilitário de senha não existe mais', () => {
    expect(() => require('../src/utils/password.js')).toThrow();
  });
});
