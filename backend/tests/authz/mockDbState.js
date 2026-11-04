// Estado singleton do Prisma mockado (Fase 4 — suíte authz).
//
// Por que singleton: a fábrica `vi.mock` pode ser avaliada mais de uma vez
// (pipeline ESM do teste vs. `require` CJS dos controllers). Se cada avaliação
// criasse seus próprios `vi.fn()`, o teste configuraria uma instância e o código
// sob teste usaria outra (sem implementação → `findUnique` resolve undefined →
// 401 "Usuário inválido"). Importar este singleton dentro da fábrica garante
// identidade única.
//
// Modelos de identidade: `authUser` (view read-only do schema `auth`, dono: saga)
// e `userRole` (papel POR SISTEMA, `sgrf.user_roles`). O claim `role` do JWT não
// é usado — o papel vem daqui (contrato de sessão, passo 6).
import { vi } from 'vitest';

// Papel por usuário, preenchido por `makeUser` em tests/authz/helpers.js.
// A implementação padrão sobrevive a `vi.clearAllMocks()` (clear não remove
// implementação; reset remove), então os testes não precisam re-semeá-la.
export const papeisPorUsuario = new Map();

export const mockDb = {
  authUser: { findUnique: vi.fn(), findMany: vi.fn() },
  userRole: {
    findUnique: vi.fn(async ({ where }) => papeisPorUsuario.get(String(where.userId)) || null),
    findMany: vi.fn(() => [...papeisPorUsuario.values()]),
  },
  resourceRequest: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn(), create: vi.fn() },
  vote: { findMany: vi.fn(), create: vi.fn() },
  viewRequest: { findMany: vi.fn() },
  deliberationMessage: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn(), create: vi.fn() },
  financialTransaction: { findMany: vi.fn(), create: vi.fn() },
  fundBalance: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
  departmentSettings: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  emailQueue: { findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  auditEvent: { create: vi.fn() },
  $transaction: vi.fn(async (cb) => cb({})),
};

export function mockDbModule() {
  return { ...mockDb, default: mockDb };
}
