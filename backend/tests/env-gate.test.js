import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

describe('SEC-02 Production gate on insecure secrets - Throw/No-throw matrix', () => {
  // Save original env before each test to restore after
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    // Completely clear NODE env so test controls it
    delete process.env.NODE_ENV;
  });

  afterEach(() => {
    // Restore original env
    Object.assign(process.env, originalEnv);
  });

  function loadEnvWithEnvVars(envVars) {
    // Clear NODE_ENV first to ensure clean state
    delete process.env.NODE_ENV;
    // Set all env vars for this test
    Object.assign(process.env, envVars);
    // Force reload of dotenv and env.js by resetting modules first
    vi.resetModules();
    delete require.cache[require.resolve('../src/config/env.js')];
    require('../src/config/env.js'); // Re-run dotenv.config() with new env
    return require('../src/config/env.js');
  }

  describe('Throw cases - production refused to boot with insecure values', () => {
    it('throws when NODE_ENV=production and JWT_ACCESS_SECRET contains change-me placeholder', () => {
      const envVars = {
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: 'dev-access-secret-change-me-0123456789',
        JWT_REFRESH_SECRET: 'secret-refresh-valid-value-1234567890123456789012',
        INITIAL_ADMIN_EMAIL: 'admin@utfpr.edu.br',
        INITIAL_ADMIN_TEMPORARY_PASSWORD: 'secure-password-1234567890123456789'
      };

      expect(() => loadEnvWithEnvVars(envVars)).toThrow('insecure');
    });

    it('throws when NODE_ENV=production and JWT_REFRESH_SECRET starts with dev- prefix', () => {
      const envVars = {
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: 'random-access-secret-random-1234567890123456789012',
        JWT_REFRESH_SECRET: 'dev-refresh-secret-change-me-0123456789',
        INITIAL_ADMIN_EMAIL: 'admin@utfpr.edu.br',
        INITIAL_ADMIN_TEMPORARY_PASSWORD: 'secure-password-1234567890123456789'
      };

      expect(() => loadEnvWithEnvVars(envVars)).toThrow('insecure');
    });

    it('throws when NODE_ENV=production and INITIAL_ADMIN_TEMPORARY_PASSWORD is empty', () => {
      const envVars = {
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: 'random-access-secret-random-1234567890123456789012',
        JWT_REFRESH_SECRET: 'random-refresh-secret-random-1234567890123456789012',
        INITIAL_ADMIN_EMAIL: 'admin@utfpr.edu.br',
        INITIAL_ADMIN_TEMPORARY_PASSWORD: ''
      };

      expect(() => loadEnvWithEnvVars(envVars)).toThrow('insecure');
    });

    it('throws when NODE_ENV=production and INITIAL_ADMIN_EMAIL missing institutional suffix', () => {
      const envVars = {
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: 'random-access-secret-random-1234567890123456789012',
        JWT_REFRESH_SECRET: 'random-refresh-secret-random-1234567890123456789012',
        INITIAL_ADMIN_EMAIL: 'admin@gmail.com',
        INITIAL_ADMIN_TEMPORARY_PASSWORD: 'secure-password-1234567890123456789'
      };

      expect(() => loadEnvWithEnvVars(envVars)).toThrow('institutional suffix');
    });

    it('throws when NODE_ENV=production and INITIAL_ADMIN_EMAIL is empty', () => {
      const envVars = {
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: 'random-access-secret-random-1234567890123456789012',
        JWT_REFRESH_SECRET: 'random-refresh-secret-random-1234567890123456789012',
        INITIAL_ADMIN_EMAIL: '',
        INITIAL_ADMIN_TEMPORARY_PASSWORD: 'secure-password-1234567890123456789'
      };

      expect(() => loadEnvWithEnvVars(envVars)).toThrow('INITIAL_ADMIN_EMAIL');
    });

    it('throws when multiple variables are insecure simultaneously', () => {
      const envVars = {
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: 'dev-access-secret-change-me-0123456789',
        JWT_REFRESH_SECRET: 'dev-refresh-secret-change-me-0123456789',
        INITIAL_ADMIN_EMAIL: 'admin@gmail.com',
        INITIAL_ADMIN_TEMPORARY_PASSWORD: ''
      };

      expect(() => loadEnvWithEnvVars(envVars)).toThrow('insecure');
    });
  });

  describe('No-throw cases - dev fallbacks intact', () => {
    it('loads without throw when NODE_ENV=development', () => {
      const envVars = {
        NODE_ENV: 'development',
        JWT_ACCESS_SECRET: 'dev-access-secret-change-me-0123456789',
        JWT_REFRESH_SECRET: 'dev-refresh-secret-change-me-0123456789',
        INITIAL_ADMIN_EMAIL: 'ldsampaio@utfpr.edu.br',
        INITIAL_ADMIN_TEMPORARY_PASSWORD: ''
      };

      const config = loadEnvWithEnvVars(envVars);
      expect(config.jwtAccessSecret).toContain('dev-access-secret');
      expect(config.initialAdminEmail).toBe('ldsampaio@utfpr.edu.br');
    });

    it('loads without throw when NODE_ENV=test with secure values', () => {
      const envVars = {
        NODE_ENV: 'test',
        JWT_ACCESS_SECRET: 'secure-test-access-secret-1234567890123456789012',
        JWT_REFRESH_SECRET: 'secure-test-refresh-secret-1234567890123456789012',
        INITIAL_ADMIN_EMAIL: 'admin@test.utfpr.edu.br',
        INITIAL_ADMIN_TEMPORARY_PASSWORD: 'test-password-12345678901234567890'
      };

      const config = loadEnvWithEnvVars(envVars);
      expect(config.jwtAccessSecret).toBeDefined();
      expect(config.cookieSecure).toBe(false);
    });
  });

  describe('COOKIE_SECURE parsing - explicit true/false wins', () => {
    it('explicit COOKIE_SECURE=true yields true in production', () => {
      const envVars = {
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: 'random-access-secret-random-1234567890123456789012',
        JWT_REFRESH_SECRET: 'random-refresh-secret-random-1234567890123456789012',
        INITIAL_ADMIN_EMAIL: 'admin@utfpr.edu.br',
        INITIAL_ADMIN_TEMPORARY_PASSWORD: 'secure-password-1234567890123456789',
        COOKIE_SECURE: 'true'
      };

      const config = loadEnvWithEnvVars(envVars);
      expect(config.cookieSecure).toBe(true);
    });

    it('explicit COOKIE_SECURE=false yields false in production', () => {
      const envVars = {
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: 'random-access-secret-random-1234567890123456789012',
        JWT_REFRESH_SECRET: 'random-refresh-secret-random-1234567890123456789012',
        INITIAL_ADMIN_EMAIL: 'admin@utfpr.edu.br',
        INITIAL_ADMIN_TEMPORARY_PASSWORD: 'secure-password-1234567890123456789',
        COOKIE_SECURE: 'false'
      };

      const config = loadEnvWithEnvVars(envVars);
      expect(config.cookieSecure).toBe(false);
    });

    it('absent COOKIE_SECURE yields false when NODE_ENV=production (SKIP_GW_ENV=true)', () => {
      // When SKIP_GW_ENV=true, production gate is bypassed but cookieSecure still tracks
      const envVars = {
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: 'random-access-secret-random-1234567890123456789012',
        JWT_REFRESH_SECRET: 'random-refresh-secret-random-1234567890123456789012',
        INITIAL_ADMIN_EMAIL: 'admin@utfpr.edu.br',
        INITIAL_ADMIN_TEMPORARY_PASSWORD: 'secure-password-1234567890123456789',
        SKIP_GW_ENV: 'true'
      };

      const config = loadEnvWithEnvVars(envVars);
      expect(config.cookieSecure).toBe(false);
    });

    it('absent COOKIE_SECURE yields false when NODE_ENV=development', () => {
      const envVars = {
        NODE_ENV: 'development',
        JWT_ACCESS_SECRET: 'dev-access-secret-change-me-0123456789',
        JWT_REFRESH_SECRET: 'dev-refresh-secret-change-me-0123456789',
        INITIAL_ADMIN_EMAIL: 'admin@utfpr.edu.br',
        INITIAL_ADMIN_TEMPORARY_PASSWORD: ''
      };

      const config = loadEnvWithEnvVars(envVars);
      expect(config.cookieSecure).toBe(false);
    });

    it('absent COOKIE_SECURE yields false when NODE_ENV=test', () => {
      const envVars = {
        NODE_ENV: 'test',
        JWT_ACCESS_SECRET: 'random-access-secret-random-1234567890123456789012',
        JWT_REFRESH_SECRET: 'random-refresh-secret-random-1234567890123456789012',
        INITIAL_ADMIN_EMAIL: 'admin@utfpr.edu.br',
        INITIAL_ADMIN_TEMPORARY_PASSWORD: 'secure-password-1234567890123456789'
      };

      const config = loadEnvWithEnvVars(envVars);
      expect(config.cookieSecure).toBe(false);
    });
  });
});
