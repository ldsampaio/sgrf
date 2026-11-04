// Seed de deploy: só o PAPEL do admin. O sgrf não cria usuário nem credencial —
// a identidade (`auth.users`) é criada pelo saga no primeiro login. Este seed
// lê `auth.users` (nunca escreve) e grava o papel em `sgrf.user_roles`.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const login = String(process.env.INITIAL_ADMIN_LOGIN || 'ldsampaio').toLowerCase().trim();
  if (!login) {
    console.log('INITIAL_ADMIN_LOGIN não definido — defina no deploy.');
    return;
  }

  // `login` é unique no schema canônico, mas o modelo AuthUser é view read-only
  // sem @unique declarado — leitura por findMany.
  const users = await prisma.authUser.findMany({ where: { login } });
  if (!users.length) {
    console.log(`Identidade "${login}" ainda não existe em auth.users. O saga cria no primeiro login; o sgrf não cria identidade.`);
    return;
  }

  await prisma.userRole.upsert({
    where: { userId: users[0].id },
    update: { role: 'ADMINISTRADOR', status: 'ATIVO' },
    create: { userId: users[0].id, role: 'ADMINISTRADOR', status: 'ATIVO' },
  });
  await prisma.departmentSettings.upsert({ where: { id: 'default' }, update: {}, create: { id: 'default' } });
  console.log(`Papel ADMINISTRADOR garantido para "${login}" (sgrf.user_roles).`);
}

main().finally(() => prisma.$disconnect());
