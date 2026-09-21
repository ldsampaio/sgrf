import { describe, it, expect } from 'vitest';
import { parseBatch, validateBatch } from '../src/utils/batchUsers.js';

describe('batch users', () => {
  it('rejeita JSON inválido', () => {
    expect(() => parseBatch(Buffer.from('nao json'))).toThrow();
  });
  it('rejeita não-array', () => {
    expect(() => parseBatch(Buffer.from('{}'))).toThrow();
  });
  it('valida lote com 1 válido e 2 inválidos', () => {
    const arr = [
      { name: 'Ok', email: 'ok@utfpr.edu.br', role: 'PROFESSOR' },
      { name: 'X', email: 'x@gmail.com', role: 'PROFESSOR' },
      { name: 'Ok2', email: 'ok@utfpr.edu.br', role: 'ALUNO' },
    ];
    const r = validateBatch(arr, new Set());
    expect(r.summary.valid).toBe(1);
    expect(r.summary.invalid).toBe(2);
  });
  it('detecta duplicado do banco', () => {
    const r = validateBatch([{ name: 'A', email: 'a@utfpr.edu.br', role: 'ALUNO' }], new Set(['a@utfpr.edu.br']));
    expect(r.summary.invalid).toBe(1);
  });
});
