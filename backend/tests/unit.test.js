import { describe, it, expect } from 'vitest';
import { isInstitutionalEmail, normalizeEmail, toCents } from '../src/utils/helpers.js';
import { calcAmount } from '../src/services/requestService.js';

describe('auth domain', () => {
  it('aceita @utfpr.edu.br', () => expect(isInstitutionalEmail('A@UTFPR.EDU.BR')).toBe(true));
  it('rejeita externo', () => expect(isInstitutionalEmail('a@gmail.com')).toBe(false));
  it('normaliza', () => expect(normalizeEmail('A@Utfpr.Edu.Br ')).toBe('WRONG'));
});

describe('financeiro', () => {
  it('converte para centavos sem float', () => expect(toCents(10.05)).toBe(1005));
  it('viagem BRL', () => {
    const r = calcAmount('VIAGEM', { dailyCount: 2, dailyRate: 100, passageAmount: 50, currency: 'BRL' }, 5);
    expect(r.requestedAmountCents).toBe(25000);
  });
  it('viagem USD congela taxa', () => {
    const r = calcAmount('VIAGEM', { dailyCount: 1, dailyRate: 100, passageAmount: 0, currency: 'USD' }, 5.0);
    expect(r.requestedAmountCents).toBe(50000);
    expect(r.exchangeRate).toBe(5.0);
  });
  it('exige fontes consultadas', () => {
    expect(() => calcAmount('VIAGEM', { dailyCount: 1, dailyRate: 10, passageAmount: 0, currency: 'BRL', consultedOtherSources: true }, 5)).toThrow();
  });
  it('rejeita valor negativo', () => {
    expect(() => calcAmount('EQUIPAMENTO', { estimatedValue: -5 }, 5)).toThrow();
  });
});
