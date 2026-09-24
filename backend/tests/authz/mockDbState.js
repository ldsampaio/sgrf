// Estado singleton do Prisma mockado (Fase 4 — suíte authz).
//
// Por que singleton: a fábrica `vi.mock` pode ser avaliada mais de uma vez
// (pipeline ESM do teste vs. `require` CJS dos controllers). Se cada
// avaliação criasse seus próprios `vi.fn()`, o teste configuraria uma
// instância e o código sob teste usaria outra (sem implementação →
// `findUnique` resolve undefined → 401 "Usuário inválido").
// Importar este singleton dentro da fábrica garante identidade única.

import { vi } from 'vitest';

export const mockDb = {
  user: { findUnique: vi.fn(), findMany: vi.fn() },
  resourceRequest: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn(), create: vi.fn() },
  vote: { findMany: vi.fn() },
  deliberationMessage: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  financialTransaction: { findMany: vi.fn() },
  auditEvent: { create: vi.fn() },
  $transaction: vi.fn(async (cb) => cb({})),
};

export function mockDbModule() {
  return { ...mockDb, default: mockDb };
}
