// Seed DEV/Teste manual — NUNCA rodar no deploy.
// Deploy usa apenas prisma/seed.js (só admin via env).
// Uso: SEED_DEV_CONFIRM=1 npm run seed:dev
const { PrismaClient } = require('@prisma/client');
const { hashPassword } = require('../src/utils/password');

const prisma = new PrismaClient();
const DEV_PASSWORD = 'Trocar123!';

const USERS = [
  { name: 'Admin Teste', email: 'admin.teste@utfpr.edu.br', role: 'ADMINISTRADOR' },
  { name: 'Chefe Teste', email: 'chefe.teste@utfpr.edu.br', role: 'CHEFE_DEPARTAMENTO' },
  { name: 'Cons Teste', email: 'cons.teste@utfpr.edu.br', role: 'CONSELHEIRO' },
  { name: 'Prof Teste', email: 'prof.teste@utfpr.edu.br', role: 'PROFESSOR' },
  { name: 'Maria Silva', email: 'maria.silva@utfpr.edu.br', role: 'PROFESSOR' },
  { name: 'Joao Santos', email: 'joao.santos@utfpr.edu.br', role: 'PROFESSOR' },
  { name: 'Aluno Teste', email: 'aluno.teste@utfpr.edu.br', role: 'ALUNO' },
];

const C = (reais) => Math.round(reais * 100);

async function main() {
  if (process.env.SEED_DEV_CONFIRM !== '1') {
    console.log('Recusei: defina SEED_DEV_CONFIRM=1 para seed de teste. Deploy usa prisma/seed.js (só admin).');
    process.exit(1);
  }
  const hash = await hashPassword(DEV_PASSWORD);
  for (const u of USERS) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, status: 'ATIVO', passwordHash: hash, mustChangePassword: false, temporaryPasswordExpiresAt: null, failedLoginAttempts: 0, lockedUntil: null },
      create: { name: u.name, email: u.email, role: u.role, status: 'ATIVO', passwordHash: hash, mustChangePassword: false },
    });
  }
  await prisma.departmentSettings.upsert({
    where: { id: 'default' },
    update: { automaticApprovalLimitCents: 100000, currentExchangeRate: 5.0, votingDurationHours: 24, viewExtensionHours: 24 },
    create: { id: 'default', automaticApprovalLimitCents: 100000, currentExchangeRate: 5.0 },
  });
  const year = new Date().getFullYear();
  const now = new Date();
  const byEmail = {};
  for (const u of USERS) {
    byEmail[u.email] = await prisma.user.findUnique({ where: { email: u.email } });
  }
  const prof = byEmail['prof.teste@utfpr.edu.br'];
  const maria = byEmail['maria.silva@utfpr.edu.br'];
  const joao = byEmail['joao.santos@utfpr.edu.br'];
  const cons = byEmail['cons.teste@utfpr.edu.br'];
  const chefe = byEmail['chefe.teste@utfpr.edu.br'];

  // limpa SMOKE anteriores (votos, mensagens, transações, pedidos)
  const old = await prisma.resourceRequest.findMany({ where: { title: { startsWith: 'SMOKE' } }, select: { id: true } });
  const oldIds = old.map((r) => r.id);
  if (oldIds.length) {
    await prisma.vote.deleteMany({ where: { requestId: { in: oldIds } } });
    await prisma.deliberationMessage.deleteMany({ where: { requestId: { in: oldIds } } });
    await prisma.financialTransaction.deleteMany({ where: { requestId: { in: oldIds } } });
    await prisma.resourceRequest.deleteMany({ where: { id: { in: oldIds } } });
  }

  async function mkRequest(data) {
    return prisma.resourceRequest.create({ data: { referenceYear: year, submittedAt: now, ...data } });
  }

  // 1. prof: equipamento aprovado automaticamente (provisionado R$500)
  const r1 = await mkRequest({
    requesterId: prof.id, type: 'EQUIPAMENTO', title: 'SMOKE equip auto-aprovado',
    status: 'APROVADO_AUTOMATICAMENTE', requestedAmountCents: C(500), approvedAmountCents: C(500),
    decidedAt: now, decidedBy: 'system',
    payload: JSON.stringify({ estimatedValue: 500, technicalSpecification: 'notebook i7 16GB' }),
  });
  // 2. prof: publicação concluída (gasto R$800)
  const r2 = await mkRequest({
    requesterId: prof.id, type: 'PUBLICACAO', title: 'SMOKE publicação concluída',
    status: 'CONCLUIDO', requestedAmountCents: C(800), approvedAmountCents: C(800),
    decidedAt: now, decidedBy: chefe.id,
    payload: JSON.stringify({ publicationFee: 800, articleTitle: 'Artigo exemplo' }),
  });
  // 3. maria: viagem aprovada pelo conselho (provisionado R$3000)
  const r3 = await mkRequest({
    requesterId: maria.id, type: 'VIAGEM', title: 'SMOKE viagem congresso',
    status: 'APROVADO', requestedAmountCents: C(3000), approvedAmountCents: C(3000),
    votingDeadlineAt: new Date(now.getTime() - 3600 * 1000), decidedAt: now, decidedBy: chefe.id,
    payload: JSON.stringify({ dailyCount: 5, dailyRate: 400, passageAmount: 1000, currency: 'BRL' }),
  });
  // 4. maria: auxílio indeferido (R$1500)
  const r4 = await mkRequest({
    requesterId: maria.id, type: 'AUXILIO_ESTUDANTIL', title: 'SMOKE auxílio indeferido',
    status: 'INDEFERIDO', requestedAmountCents: C(1500), approvedAmountCents: 0,
    votingDeadlineAt: new Date(now.getTime() - 3600 * 1000), decidedAt: now, decidedBy: chefe.id,
    payload: JSON.stringify({ estimatedAmount: 1500, studentNames: 'Aluno Ex.' }),
  });
  // 5. joao: publicação parcial (solicitado R$2000, aprovado R$1200)
  const r5 = await mkRequest({
    requesterId: joao.id, type: 'PUBLICACAO', title: 'SMOKE publicação parcial',
    status: 'APROVADO_PARCIALMENTE', requestedAmountCents: C(2000), approvedAmountCents: C(1200),
    decisionReason: 'Decisão do conselho: parcial', approvedItems: JSON.stringify(['taxa principal']),
    votingDeadlineAt: new Date(now.getTime() - 3600 * 1000), decidedAt: now, decidedBy: chefe.id,
    payload: JSON.stringify({ publicationFee: 2000, articleTitle: 'Artigo parcial' }),
  });
  // 6. joao: equipamento em votação (R$5000)
  const r6 = await mkRequest({
    requesterId: joao.id, type: 'EQUIPAMENTO', title: 'SMOKE equip em votação',
    status: 'EM_VOTACAO', requestedAmountCents: C(5000), approvedAmountCents: 0,
    votingDeadlineAt: new Date(now.getTime() + 24 * 3600 * 1000),
    payload: JSON.stringify({ estimatedValue: 5000, technicalSpecification: 'servidor rack' }),
  });
  // 7. joao: viagem concluída (gasto R$2500)
  const r7 = await mkRequest({
    requesterId: joao.id, type: 'VIAGEM', title: 'SMOKE viagem concluída',
    status: 'CONCLUIDO', requestedAmountCents: C(2500), approvedAmountCents: C(2500),
    decidedAt: now, decidedBy: chefe.id,
    payload: JSON.stringify({ dailyCount: 4, dailyRate: 500, passageAmount: 500, currency: 'BRL' }),
  });

  // votos coerentes (nunca o solicitante)
  const fin = new Date(now.getTime() - 1800 * 1000);
  await prisma.vote.createMany({
    data: [
      { requestId: r3.id, voterId: cons.id, voteType: 'DEFERIR', comment: 'relevante', finalizedAt: fin },
      { requestId: r3.id, voterId: chefe.id, voteType: 'DEFERIR', comment: 'ok', finalizedAt: fin },
      { requestId: r4.id, voterId: cons.id, voteType: 'INDEFERIR', comment: 'fora do escopo', finalizedAt: fin },
      { requestId: r5.id, voterId: cons.id, voteType: 'DEFERIR_PARCIALMENTE', comment: 'só taxa principal', approvedAmountCents: C(1200), finalizedAt: fin },
      { requestId: r5.id, voterId: chefe.id, voteType: 'DEFERIR_PARCIALMENTE', comment: 'de acordo', approvedAmountCents: C(1200), finalizedAt: fin },
    ],
  });
  // mensagem com autor visível
  await prisma.deliberationMessage.create({
    data: { requestId: r6.id, authorId: cons.id, content: 'Precisamos avaliar a especificação do servidor antes de votar.' },
  });

  // transações + saldos coerentes
  const provisioned = C(500) + C(3000) + C(1200); // r1, r3, r5
  const spent = C(800) + C(2500); // r2, r7
  const available = C(10000) - provisioned - spent;
  await prisma.financialTransaction.createMany({
    data: [
      { requestId: r1.id, type: 'PROVISION', amountCents: C(500), fromState: 'DISPONIVEL', toState: 'PROVISIONADO', performedBy: 'system' },
      { requestId: r2.id, type: 'PROVISION', amountCents: C(800), fromState: 'DISPONIVEL', toState: 'PROVISIONADO', performedBy: 'system' },
      { requestId: r2.id, type: 'SPENT', amountCents: C(800), fromState: 'PROVISIONADO', toState: 'GASTO', performedBy: chefe.id },
      { requestId: r3.id, type: 'PROVISION', amountCents: C(3000), fromState: 'DISPONIVEL', toState: 'PROVISIONADO', performedBy: chefe.id },
      { requestId: r5.id, type: 'PROVISION', amountCents: C(1200), fromState: 'DISPONIVEL', toState: 'PROVISIONADO', performedBy: chefe.id },
      { requestId: r7.id, type: 'PROVISION', amountCents: C(2500), fromState: 'DISPONIVEL', toState: 'PROVISIONADO', performedBy: 'system' },
      { requestId: r7.id, type: 'SPENT', amountCents: C(2500), fromState: 'PROVISIONADO', toState: 'GASTO', performedBy: chefe.id },
    ],
  });
  await prisma.fundBalance.upsert({
    where: { referenceYear: year },
    update: { availableCents: available, provisionedCents: provisioned, spentCents: spent },
    create: { referenceYear: year, availableCents: available, provisionedCents: provisioned, spentCents: spent },
  });

  console.log(`Seed dev ok. Saldos: disp ${available} prov ${provisioned} gasto ${spent}. Logins (senha ${DEV_PASSWORD}):`);
  for (const u of USERS) console.log(`  ${u.role}: ${u.email}`);
}

main().finally(() => prisma.$disconnect());
