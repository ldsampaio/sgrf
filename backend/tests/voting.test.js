import { describe, it, expect } from 'vitest';
import { tally } from '../src/services/votingService.js';

describe('votação tally (sem quórum, maioria simples)', () => {
  it('deferido vence', () => {
    expect(tally([{ voteType: 'DEFERIR' }, { voteType: 'DEFERIR' }, { voteType: 'INDEFERIR' }]).outcome).toBe('DEFERIDO');
  });
  it('abstenção ignora', () => {
    expect(tally([{ voteType: 'ABSTER_SE' }, { voteType: 'DEFERIR' }]).outcome).toBe('DEFERIDO');
  });
  it('empate detectado', () => {
    expect(tally([{ voteType: 'DEFERIR' }, { voteType: 'INDEFERIR' }]).outcome).toBe('EMPATE');
  });
  it('sem votos', () => {
    expect(tally([]).outcome).toBe('SEM_VOTOS');
  });
  it('parcial com maioria própria', () => {
    const r = tally([{ voteType: 'DEFERIR_PARCIALMENTE' }, { voteType: 'DEFERIR_PARCIALMENTE' }, { voteType: 'DEFERIR' }]);
    expect(r.outcome).toBe('PARCIAL');
  });
});
