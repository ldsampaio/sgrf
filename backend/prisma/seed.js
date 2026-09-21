const { PrismaClient } = require('@prisma/client');
const { hashPassword } = require('../src/utils/password');
const { normalizeEmail } = require('../src/utils/helpers');

const prisma = new PrismaClient();

async function main() {
  const email = normalizeEmail(process.env.INITIAL_ADMIN_EMAIL || 'ldsampaio@utfpr.edu.br');
  const temp = process.env.INITIAL_ADMIN_TEMPORARY_PASSWORD;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log('Admin já existe, nada a fazer.');
    return;
  }
  if (!temp) {
    console.log('INITIAL_ADMIN_TEMPORARY_PASSWORD não definido — defina no deploy.');
    return;
  }
  await prisma.user.create({
    data: {
      name: 'Admin Inicial', email, role: 'ADMINISTRADOR',
      passwordHash: await hashPassword(temp),
      mustChangePassword: true,
      temporaryPasswordExpiresAt: new Date(Date.now() + 24 * 3600 * 1000),
    },
  });
  await prisma.departmentSettings.upsert({ where: { id: 'default' }, update: {}, create: { id: 'default' } });
  console.log('Admin inicial criado (senha temporária, troca obrigatória).');
}

main().finally(() => prisma.$disconnect());
