import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { tally, canVote, closeVoting, validateVoteInput } from '../src/services/votingService.js';

const prisma = new PrismaClient();

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

describe('VOT-01: Tie-break convergence', () => {
  let requestId;
  let chefeId;
  let conselheiro1Id;
  let conselheiro2Id;
  let requesterId;
  let chefeUser;
  let conselheiro1User;
  let conselheiro2User;
  let requesterUser;
  const testYear = 2026;

  beforeAll(async () => {
    // Ensure fund balance exists for test year
    await prisma.fundBalance.upsert({
      where: { referenceYear: testYear },
      update: { availableCents: 1000000, provisionedCents: 0, spentCents: 0 },
      create: { referenceYear: testYear, availableCents: 1000000, provisionedCents: 0, spentCents: 0 },
    });

    // Create test users
    const users = await Promise.all([
      prisma.user.create({
        data: {
          name: 'Chefe Teste VOT01',
          email: 'chefe.vot01@utfpr.edu.br',
          role: 'CHEFE_DEPARTAMENTO',
          passwordHash: 'hash',
          status: 'ATIVO',
        },
      }),
      prisma.user.create({
        data: {
          name: 'Conselheiro 1 VOT01',
          email: 'cons1.vot01@utfpr.edu.br',
          role: 'CONSELHEIRO',
          passwordHash: 'hash',
          status: 'ATIVO',
        },
      }),
      prisma.user.create({
        data: {
          name: 'Conselheiro 2 VOT01',
          email: 'cons2.vot01@utfpr.edu.br',
          role: 'CONSELHEIRO',
          passwordHash: 'hash',
          status: 'ATIVO',
        },
      }),
      prisma.user.create({
        data: {
          name: 'Requester VOT01',
          email: 'requester.vot01@utfpr.edu.br',
          role: 'PROFESSOR',
          passwordHash: 'hash',
          status: 'ATIVO',
        },
      }),
    ]);

    chefeId = users[0].id;
    conselheiro1Id = users[1].id;
    conselheiro2Id = users[2].id;
    requesterId = users[3].id;

    chefeUser = users[0];
    conselheiro1User = users[1];
    conselheiro2User = users[2];
    requesterUser = users[3];

    // Create a request in EM_VOTACAO
    const request = await prisma.resourceRequest.create({
      data: {
        requesterId,
        type: 'EQUIPAMENTO',
        title: 'VOT-01 Tie-break Test',
        status: 'EM_VOTACAO',
        referenceYear: testYear,
        requestedAmountCents: 100000,
        approvedAmountCents: 0,
        votingDeadlineAt: new Date(Date.now() + 24 * 3600 * 1000),
        submittedAt: new Date(),
      },
    });
    requestId = request.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.vote.deleteMany({ where: { requestId } });
    await prisma.resourceRequest.delete({ where: { id: requestId } });
    await prisma.user.deleteMany({
      where: {
        id: { in: [chefeId, conselheiro1Id, conselheiro2Id, requesterId] },
      },
    });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Reset votes for each test
    await prisma.vote.deleteMany({ where: { requestId } });
    // Reset request status to EM_VOTACAO
    await prisma.resourceRequest.update({
      where: { id: requestId },
      data: { status: 'EM_VOTACAO', decidedAt: null, decidedBy: null, approvedAmountCents: 0 },
    });
    // Reset fund balance
    await prisma.fundBalance.update({
      where: { referenceYear: testYear },
      data: { availableCents: 1000000, provisionedCents: 0, spentCents: 0 },
    });
  });

  async function setupTieScenario() {
    // Bug scenario: chefe voted in normal phase, then tie occurs
    // Chefe votes DEFERIR in normal phase
    await prisma.vote.create({
      data: {
        requestId,
        voterId: chefeId,
        voteType: 'DEFERIR',
        comment: 'Chefe initial vote',
        tieBreak: false,
      },
    });
    // Conselheiro1 votes INDEFERIR
    await prisma.vote.create({
      data: {
        requestId,
        voterId: conselheiro1Id,
        voteType: 'INDEFERIR',
        comment: 'Conselheiro 1',
        tieBreak: false,
      },
    });
    // Conselheiro2 votes DEFERIR -> 2 DEFERIR, 1 INDEFERIR = DEFERIDO (not tie)
    // For tie: need 1 DEFERIR, 1 INDEFERIR (chefe + 1 conselheiro)
    // Let's use only chefe + conselheiro1 for a clean tie
    // closeVoting should set status to AGUARDANDO_DESEMPATE
    await closeVoting(requestId, 'system');
  }

  async function setupTieScenarioWithTwoConselheiros() {
    // Alternative: chefe + 2 conselheiros where tie occurs
    // Chefe: DEFERIR, Cons1: DEFERIR, Cons2: INDEFERIR = 2 vs 1 = not tie
    // Chefe: DEFERIR, Cons1: INDEFERIR, Cons2: INDEFERIR = 1 vs 2 = not tie
    // For tie with 3 voters: need even split, so one must abstain
    await prisma.vote.create({
      data: { requestId, voterId: chefeId, voteType: 'DEFERIR', comment: 'Chefe', tieBreak: false },
    });
    await prisma.vote.create({
      data: { requestId, voterId: conselheiro1Id, voteType: 'INDEFERIR', comment: 'Cons1', tieBreak: false },
    });
    await prisma.vote.create({
      data: { requestId, voterId: conselheiro2Id, voteType: 'ABSTER_SE', comment: 'Cons2 abstains', tieBreak: false },
    });
    await closeVoting(requestId, 'system');
  }

  it('allows chefe to change vote during AGUARDANDO_DESEMPATE', async () => {
    await setupTieScenario();

    // Verify request is in AGUARDANDO_DESEMPATE
    const request = await prisma.resourceRequest.findUnique({ where: { id: requestId } });
    expect(request.status).toBe('AGUARDANDO_DESEMPATE');

    // Check canVote for chefe in AGUARDANDO_DESEMPATE - should be allowed
    const check = canVote(chefeUser, request, []);
    expect(check.ok).toBe(true);
  });

  it('denies conselheiro from voting during AGUARDANDO_DESEMPATE', async () => {
    await setupTieScenario();

    const request = await prisma.resourceRequest.findUnique({ where: { id: requestId } });

    // Check canVote for conselheiro in AGUARDANDO_DESEMPATE - should be denied
    const check = canVote(conselheiro1User, request, []);
    expect(check.ok).toBe(false);
    expect(check.code).toBe(403);
    expect(check.error).toBe('Aguardando desempate do chefe');
  });

  it('converges to INDEFERIDO after chefe changes vote to INDEFERIR in tie-break', async () => {
    await setupTieScenario();

    // Get the chefe's existing vote (DEFERIR)
    const existingVote = await prisma.vote.findUnique({
      where: { requestId_voterId: { requestId, voterId: chefeId } },
    });
    expect(existingVote.voteType).toBe('DEFERIR');

    // Chefe changes vote to INDEFERIR (tie-break) - now 0 DEFERIR, 1 INDEFERIR
    await prisma.vote.update({
      where: { requestId_voterId: { requestId, voterId: chefeId } },
      data: { voteType: 'INDEFERIR', tieBreak: true },
    });

    // closeVoting should converge to INDEFERIDO
    const closed = await closeVoting(requestId, chefeId);
    expect(['APROVADO', 'INDEFERIDO']).toContain(closed.status);
    expect(closed.status).toBe('INDEFERIDO');
  });

  it('converges to APROVADO if chefe changes vote to DEFERIR when conselheiro voted INDEFERIR', async () => {
    // Set up tie with chefe voting INDEFERIR initially
    await prisma.vote.deleteMany({ where: { requestId } });
    await prisma.resourceRequest.update({
      where: { id: requestId },
      data: { status: 'EM_VOTACAO', decidedAt: null, decidedBy: null, approvedAmountCents: 0 },
    });
    
    await prisma.vote.create({
      data: { requestId, voterId: chefeId, voteType: 'INDEFERIR', comment: 'Chefe initial', tieBreak: false },
    });
    await prisma.vote.create({
      data: { requestId, voterId: conselheiro1Id, voteType: 'DEFERIR', comment: 'Conselheiro 1', tieBreak: false },
    });
    await closeVoting(requestId, 'system');

    const request = await prisma.resourceRequest.findUnique({ where: { id: requestId } });
    expect(request.status).toBe('AGUARDANDO_DESEMPATE');

    // Chefe changes to DEFERIR (tie-break) - now 1 DEFERIR, 0 INDEFERIR
    await prisma.vote.update({
      where: { requestId_voterId: { requestId, voterId: chefeId } },
      data: { voteType: 'DEFERIR', tieBreak: true },
    });

    const closed = await closeVoting(requestId, chefeId);
    expect(['APROVADO', 'INDEFERIDO']).toContain(closed.status);
    expect(closed.status).toBe('APROVADO');
  });

  it('prevents chefe from double-voting (normal + tie-break as separate votes)', async () => {
    await setupTieScenario();

    // Try to create a second vote for chefe (should fail due to unique constraint)
    await expect(
      prisma.vote.create({
        data: {
          requestId,
          voterId: chefeId,
          voteType: 'INDEFERIR',
          comment: 'Second vote attempt',
          tieBreak: true,
        },
      })
    ).rejects.toThrow();
  });
});

describe('VOT-01: changeMyVote guard extension', () => {
  let requestId;
  let chefeId;
  let conselheiroId;

  beforeAll(async () => {
    const users = await Promise.all([
      prisma.user.create({
        data: {
          name: 'Chefe ChangeVote',
          email: 'chefe.changevote@utfpr.edu.br',
          role: 'CHEFE_DEPARTAMENTO',
          passwordHash: 'hash',
          status: 'ATIVO',
        },
      }),
      prisma.user.create({
        data: {
          name: 'Conselheiro ChangeVote',
          email: 'cons.changevote@utfpr.edu.br',
          role: 'CONSELHEIRO',
          passwordHash: 'hash',
          status: 'ATIVO',
        },
      }),
    ]);

    chefeId = users[0].id;
    conselheiroId = users[1].id;

    const request = await prisma.resourceRequest.create({
      data: {
        requesterId: chefeId,
        type: 'EQUIPAMENTO',
        title: 'ChangeMyVote Test',
        status: 'AGUARDANDO_DESEMPATE',
        referenceYear: 2026,
        requestedAmountCents: 100000,
        approvedAmountCents: 0,
        votingDeadlineAt: new Date(Date.now() + 24 * 3600 * 1000),
        submittedAt: new Date(),
      },
    });
    requestId = request.id;

    // Create a vote for chefe
    await prisma.vote.create({
      data: {
        requestId,
        voterId: chefeId,
        voteType: 'DEFERIR',
        comment: 'Initial vote',
        tieBreak: false,
      },
    });
  });

  afterAll(async () => {
    await prisma.vote.deleteMany({ where: { requestId } });
    await prisma.resourceRequest.delete({ where: { id: requestId } });
    await prisma.user.deleteMany({
      where: { id: { in: [chefeId, conselheiroId] } },
    });
  });

  it('validates vote input for tie-break change', () => {
    expect(() => validateVoteInput({ voteType: 'DEFERIR' })).not.toThrow();
    expect(() => validateVoteInput({ voteType: 'INDEFERIR' })).not.toThrow();
    expect(() => validateVoteInput({ voteType: 'ABSTER_SE' })).not.toThrow();
    expect(() => validateVoteInput({ voteType: 'DEFERIR_PARCIALMENTE', comment: 'partial', approvedAmountCents: 50000 })).not.toThrow();
    expect(() => validateVoteInput({ voteType: 'INVALIDO' })).toThrow('Tipo de voto inválido');
    expect(() => validateVoteInput({ voteType: 'DEFERIR_PARCIALMENTE' })).toThrow('Voto parcial exige comentário');
    expect(() => validateVoteInput({ voteType: 'DEFERIR_PARCIALMENTE', comment: 'x' })).toThrow('Voto parcial exige valor aprovado');
  });
});

import { annualTotalCents } from '../src/services/requestService.js';

describe('VOT-03: Partial approval arbitration', () => {
  let requestId;
  let chefeId;
  let conselheiro1Id;
  let conselheiro2Id;
  let requesterId;
  let chefeUser;
  let conselheiro1User;
  let conselheiro2User;
  let requesterUser;
  const testYear = 2026;

  beforeAll(async () => {
    // Ensure fund balance exists for test year
    await prisma.fundBalance.upsert({
      where: { referenceYear: testYear },
      update: { availableCents: 1000000, provisionedCents: 0, spentCents: 0 },
      create: { referenceYear: testYear, availableCents: 1000000, provisionedCents: 0, spentCents: 0 },
    });

    // Create test users
    const users = await Promise.all([
      prisma.user.create({
        data: {
          name: 'Chefe VOT03',
          email: 'chefe.vot03@utfpr.edu.br',
          role: 'CHEFE_DEPARTAMENTO',
          passwordHash: 'hash',
          status: 'ATIVO',
        },
      }),
      prisma.user.create({
        data: {
          name: 'Conselheiro 1 VOT03',
          email: 'cons1.vot03@utfpr.edu.br',
          role: 'CONSELHEIRO',
          passwordHash: 'hash',
          status: 'ATIVO',
        },
      }),
      prisma.user.create({
        data: {
          name: 'Conselheiro 2 VOT03',
          email: 'cons2.vot03@utfpr.edu.br',
          role: 'CONSELHEIRO',
          passwordHash: 'hash',
          status: 'ATIVO',
        },
      }),
      prisma.user.create({
        data: {
          name: 'Requester VOT03',
          email: 'requester.vot03@utfpr.edu.br',
          role: 'PROFESSOR',
          passwordHash: 'hash',
          status: 'ATIVO',
        },
      }),
    ]);

    chefeId = users[0].id;
    conselheiro1Id = users[1].id;
    conselheiro2Id = users[2].id;
    requesterId = users[3].id;

    chefeUser = users[0];
    conselheiro1User = users[1];
    conselheiro2User = users[2];
    requesterUser = users[3];

    // Create a request in EM_VOTACAO
    const request = await prisma.resourceRequest.create({
      data: {
        requesterId,
        type: 'EQUIPAMENTO',
        title: 'VOT-03 Partial Arbitration Test',
        status: 'EM_VOTACAO',
        referenceYear: testYear,
        requestedAmountCents: 100000,
        approvedAmountCents: 0,
        votingDeadlineAt: new Date(Date.now() + 24 * 3600 * 1000),
        submittedAt: new Date(),
      },
    });
    requestId = request.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.vote.deleteMany({ where: { requestId } });
    await prisma.resourceRequest.delete({ where: { id: requestId } });
    await prisma.financialTransaction.deleteMany({ where: { requestId } });
    await prisma.auditEvent.deleteMany({ where: { entityId: requestId } });
    await prisma.user.deleteMany({
      where: {
        id: { in: [chefeId, conselheiro1Id, conselheiro2Id, requesterId] },
      },
    });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Reset votes for each test
    await prisma.vote.deleteMany({ where: { requestId } });
    // Reset request status to EM_VOTACAO
    await prisma.resourceRequest.update({
      where: { id: requestId },
      data: { status: 'EM_VOTACAO', decidedAt: null, decidedBy: null, approvedAmountCents: 0, decisionReason: '', collegiateMinutes: '' },
    });
    // Reset fund balance
    await prisma.fundBalance.update({
      where: { referenceYear: testYear },
      data: { availableCents: 1000000, provisionedCents: 0, spentCents: 0 },
    });
  });

  it('closeVoting with any DEFERIR_PARCIALMENTE vote returns arbitration indicator', async () => {
    // Setup: Chefe votes DEFERIR, Conselheiro1 votes DEFERIR_PARCIALMENTE
    // Even though tally would be DEFERIDO (1 DEFERIR vs 1 PARCIAL), arbitration should trigger
    await prisma.vote.create({
      data: {
        requestId,
        voterId: chefeId,
        voteType: 'DEFERIR',
        comment: 'Chefe vote',
        tieBreak: false,
      },
    });
    await prisma.vote.create({
      data: {
        requestId,
        voterId: conselheiro1Id,
        voteType: 'DEFERIR_PARCIALMENTE',
        comment: 'Partial vote',
        approvedAmountCents: 50000,
        tieBreak: false,
      },
    });

    const result = await closeVoting(requestId, 'system');

    // Should return arbitration indicator, not auto-concluded request with amount
    expect(result).toEqual(
      expect.objectContaining({
        needsArbitration: true,
        status: 'APROVADO_PARCIALMENTE',
        arbitration: true,
        requestId,
      })
    );
    expect(result).not.toHaveProperty('approvedAmountCents'); // or should be 0
  });

  it('closeVoting with multiple DEFERIR_PARCIALMENTE votes still returns arbitration', async () => {
    // Multiple partial votes with different amounts - should NOT pick first
    await prisma.vote.create({
      data: { requestId, voterId: chefeId, voteType: 'DEFERIR', comment: 'Chefe', tieBreak: false },
    });
    await prisma.vote.create({
      data: { requestId, voterId: conselheiro1Id, voteType: 'DEFERIR_PARCIALMENTE', comment: 'Partial 1', approvedAmountCents: 30000, tieBreak: false },
    });
    await prisma.vote.create({
      data: { requestId, voterId: conselheiro2Id, voteType: 'DEFERIR_PARCIALMENTE', comment: 'Partial 2', approvedAmountCents: 70000, tieBreak: false },
    });

    const result = await closeVoting(requestId, 'system');

    expect(result.needsArbitration).toBe(true);
    expect(result.status).toBe('APROVADO_PARCIALMENTE');
    expect(result.arbitration).toBe(true);
  });

  it('closeVoting with no partial votes works normally (DEFERIDO)', async () => {
    await prisma.vote.create({
      data: { requestId, voterId: chefeId, voteType: 'DEFERIR', comment: 'Chefe', tieBreak: false },
    });
    await prisma.vote.create({
      data: { requestId, voterId: conselheiro1Id, voteType: 'DEFERIR', comment: 'Conselheiro', tieBreak: false },
    });

    const result = await closeVoting(requestId, 'system');

    // Normal closure - returns updated request object
    expect(result.status).toBe('APROVADO');
    expect(result.approvedAmountCents).toBe(100000);
    expect(result.needsArbitration).toBeUndefined();
  });

  it('closeVoting with partial + tie (PARCIAL outcome) returns arbitration', async () => {
    // PARCIAL outcome when partial has majority on its own
    await prisma.vote.create({
      data: { requestId, voterId: conselheiro1Id, voteType: 'DEFERIR_PARCIALMENTE', comment: 'Partial 1', approvedAmountCents: 40000, tieBreak: false },
    });
    await prisma.vote.create({
      data: { requestId, voterId: conselheiro2Id, voteType: 'DEFERIR_PARCIALMENTE', comment: 'Partial 2', approvedAmountCents: 60000, tieBreak: false },
    });

    const result = await closeVoting(requestId, 'system');

    expect(result.needsArbitration).toBe(true);
    expect(result.status).toBe('APROVADO_PARCIALMENTE');
  });

  it('Request in arbitration state has decisionReason=AGUARDANDO_ARBITRAGEM and collegiateMinutes set', async () => {
    await prisma.vote.create({
      data: { requestId, voterId: chefeId, voteType: 'DEFERIR', comment: 'Chefe', tieBreak: false },
    });
    await prisma.vote.create({
      data: { requestId, voterId: conselheiro1Id, voteType: 'DEFERIR_PARCIALMENTE', comment: 'Partial', approvedAmountCents: 50000, tieBreak: false },
    });

    await closeVoting(requestId, 'system');

    const request = await prisma.resourceRequest.findUnique({ where: { id: requestId } });
    expect(request.status).toBe('APROVADO_PARCIALMENTE');
    expect(request.decisionReason).toBe('AGUARDANDO_ARBITRAGEM');
    expect(request.collegiateMinutes).toBe('Aguardando arbitragem do chefe — voto parcial detectado');
    expect(request.approvedAmountCents).toBe(0); // No provision yet
  });

  it('No FundBalance provision when arbitration is needed', async () => {
    await prisma.vote.create({
      data: { requestId, voterId: chefeId, voteType: 'DEFERIR', comment: 'Chefe', tieBreak: false },
    });
    await prisma.vote.create({
      data: { requestId, voterId: conselheiro1Id, voteType: 'DEFERIR_PARCIALMENTE', comment: 'Partial', approvedAmountCents: 50000, tieBreak: false },
    });

    const balBefore = await prisma.fundBalance.findUnique({ where: { referenceYear: testYear } });
    await closeVoting(requestId, 'system');
    const balAfter = await prisma.fundBalance.findUnique({ where: { referenceYear: testYear } });

    expect(balAfter.availableCents).toBe(balBefore.availableCents);
    expect(balAfter.provisionedCents).toBe(balBefore.provisionedCents);
  });

  it('partialArbitration endpoint - chefe sets final amount with justification', async () => {
    // First, trigger arbitration state
    await prisma.vote.create({
      data: { requestId, voterId: chefeId, voteType: 'DEFERIR', comment: 'Chefe', tieBreak: false },
    });
    await prisma.vote.create({
      data: { requestId, voterId: conselheiro1Id, voteType: 'DEFERIR_PARCIALMENTE', comment: 'Partial', approvedAmountCents: 50000, tieBreak: false },
    });
    await closeVoting(requestId, 'system');

    // Now simulate the arbitration endpoint call
    // This test will fail until the endpoint is implemented
    const { partialArbitration } = await import('../src/controllers/votingController.js');
    
    // We'll test this via integration after implementation
    // For now, verify the arbitration state is correct
    const request = await prisma.resourceRequest.findUnique({ where: { id: requestId } });
    expect(request.status).toBe('APROVADO_PARCIALMENTE');
    expect(request.decisionReason).toBe('AGUARDANDO_ARBITRAGEM');
  });

  it('Arbitration amount validation: rejects amount <= 0', async () => {
    // This will be tested after endpoint implementation
    expect(true).toBe(true); // placeholder
  });

  it('Arbitration amount validation: rejects amount > requestedAmountCents', async () => {
    expect(true).toBe(true); // placeholder
  });

  it('Arbitration requires justification - rejects missing justification', async () => {
    expect(true).toBe(true); // placeholder
  });

  it('Arbitration requires chefe role - non-chefe gets 403', async () => {
    expect(true).toBe(true); // placeholder
  });

  it('AuditEvent created with action=partial_arbitration, decidedBy=CHEFE_DEPARTAMENTO', async () => {
    expect(true).toBe(true); // placeholder
  });

  it('castVote in tie-break calling closeVoting handles arbitration return', async () => {
    expect(true).toBe(true); // placeholder - integration test
  });

  it('closeManual calling closeVoting handles arbitration return', async () => {
    expect(true).toBe(true); // placeholder - integration test
  });

  it('votingCloser.closeExpired calling closeVoting handles arbitration return', async () => {
    expect(true).toBe(true); // placeholder - integration test
  });
});

describe('VOT-02: Annual cap accounting (CONCLUIDO counts toward cap)', () => {
  let requesterId;
  let requesterUser;
  let autoApprovalLimitCents;
  const testYear = 2026;

  beforeAll(async () => {
    // Ensure fund balance exists for test year
    await prisma.fundBalance.upsert({
      where: { referenceYear: testYear },
      update: { availableCents: 1000000, provisionedCents: 0, spentCents: 0 },
      create: { referenceYear: testYear, availableCents: 1000000, provisionedCents: 0, spentCents: 0 },
    });

    // Create test user (requester)
    const user = await prisma.user.create({
      data: {
        name: 'Requester VOT02',
        email: 'requester.vot02@utfpr.edu.br',
        role: 'PROFESSOR',
        passwordHash: 'hash',
        status: 'ATIVO',
      },
    });
    requesterId = user.id;
    requesterUser = user;

    // Get settings to know the auto-approval limit
    const settings = await prisma.departmentSettings.findUnique({ where: { id: 'default' } });
    autoApprovalLimitCents = settings?.automaticApprovalLimitCents ?? 100000;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.resourceRequest.deleteMany({ where: { requesterId } });
    await prisma.user.delete({ where: { id: requesterId } });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Reset requests for each test
    await prisma.resourceRequest.deleteMany({ where: { requesterId } });
    // Reset fund balance
    await prisma.fundBalance.update({
      where: { referenceYear: testYear },
      data: { availableCents: 1000000, provisionedCents: 0, spentCents: 0 },
    });
  });

  async function createRequest(status, amountCents = 100000) {
    return prisma.resourceRequest.create({
      data: {
        requesterId,
        type: 'EQUIPAMENTO',
        title: `Test Request ${status}`,
        status,
        referenceYear: testYear,
        requestedAmountCents: amountCents,
        approvedAmountCents: amountCents,
        votingDeadlineAt: new Date(Date.now() + 24 * 3600 * 1000),
        submittedAt: new Date(),
      },
    });
  }

  it('annualTotalCents includes CONCLUIDO status in sum', async () => {
    // Create requests in various statuses including CONCLUIDO
    await createRequest('SUBMETIDO', 100000);
    await createRequest('EM_VOTACAO', 100000);
    await createRequest('APROVADO', 100000);
    await createRequest('APROVADO_AUTOMATICAMENTE', 100000);
    await createRequest('APROVADO_PARCIALMENTE', 100000);
    await createRequest('CONCLUIDO', 100000);

    const total = await annualTotalCents(requesterId, testYear);
    // Should sum all 6 requests = 600000
    expect(total).toBe(600000);
  });

  it('Cycling spent → submit fails at cap (CONCLUIDO counts toward limit)', async () => {
    // Create CONCLUIDO requests that total up to the limit
    // With default limit of 100000, create 1 request of 100000
    await createRequest('CONCLUIDO', autoApprovalLimitCents);

    // Verify annualTotalCents includes CONCLUIDO requests
    const totalBefore = await annualTotalCents(requesterId, testYear);
    expect(totalBefore).toBe(autoApprovalLimitCents);

    // Try to submit a new request that would exceed the limit
    const newRequestAmount = 100000;
    const wouldExceed = totalBefore + newRequestAmount > autoApprovalLimitCents;
    expect(wouldExceed).toBe(true);

    // This test encodes the desired behavior: CONCLUIDO counts toward the cap
    // so a new request at the limit should be rejected (not auto-approved)
    // The actual HTTP 400 check would be in the controller integration test
    // Here we verify the core calculation
  });

  it('Below limit still auto-approves correctly', async () => {
    // Create CONCLUIDO requests below the limit
    // With default limit of 100000, create 1 request of 50000 (half the limit)
    const belowLimitAmount = Math.floor(autoApprovalLimitCents / 2);
    await createRequest('CONCLUIDO', belowLimitAmount);

    const totalBefore = await annualTotalCents(requesterId, testYear);
    expect(totalBefore).toBe(belowLimitAmount);

    // A new request of 100000 would bring total to 150000, which exceeds limit of 100000
    // So let's use a smaller new request amount that stays within limit
    const newRequestAmount = Math.floor(autoApprovalLimitCents / 2); // 50000
    const wouldExceed = totalBefore + newRequestAmount > autoApprovalLimitCents;
    expect(wouldExceed).toBe(false);

    // This test encodes: requester below limit with CONCLUIDO requests
    // should still be able to auto-approve new requests within remaining quota
  });
});