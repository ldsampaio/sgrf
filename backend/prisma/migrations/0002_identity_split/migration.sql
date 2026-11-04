-- Migration do sgrf: SOMENTE mudanças em `sgrf.*`.
--
-- Regra de propriedade (AGENTS.md): o schema `auth` é do SAGA. Nada neste
-- arquivo cria ou altera tabela em `auth` — as FKs apenas apontam para
-- `auth.users(id)`, que é criado por `saga/db/schema.sql`.
-- Se `prisma migrate dev` detectar drift em `auth`, usar baseline; o Prisma
-- nunca cria tabela em `auth`.
--
-- Decisão do plano: nada foi deployado, não há dados — o schema canônico é
-- definido do zero. As tabelas do sgrf deixam `public` e passam a viver em
-- `sgrf`; `User` deixa de existir (identidade mora em `auth.users`).

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "sgrf";

-- MoveTable: tabelas do sgrf passam do schema public para o schema sgrf.
ALTER TABLE "public"."DepartmentSettings" SET SCHEMA "sgrf";
ALTER TABLE "public"."FundBalance" SET SCHEMA "sgrf";
ALTER TABLE "public"."ResourceRequest" SET SCHEMA "sgrf";
ALTER TABLE "public"."RequestFile" SET SCHEMA "sgrf";
ALTER TABLE "public"."FinancialTransaction" SET SCHEMA "sgrf";
ALTER TABLE "public"."AuditEvent" SET SCHEMA "sgrf";
ALTER TABLE "public"."EmailQueue" SET SCHEMA "sgrf";
ALTER TABLE "public"."Vote" SET SCHEMA "sgrf";
ALTER TABLE "public"."DeliberationMessage" SET SCHEMA "sgrf";
ALTER TABLE "public"."ViewRequest" SET SCHEMA "sgrf";

-- DropTable: `User` era usuário + credencial. Credencial não existe mais no
-- sgrf (T10): rate limit, bloqueio e senha são do saga. O sgrf guarda apenas o
-- papel por sistema. CASCADE derruba a FK antiga (requesterId → public."User"),
-- substituída pela FK para auth.users(id) abaixo.
DROP TABLE "public"."User" CASCADE;

-- CreateTable: papel por sistema (contrato de sessão, passo 6).
CREATE TABLE "sgrf"."user_roles" (
    "user_id" UUID NOT NULL,
    "role" TEXT NOT NULL CHECK (role IN ('ADMINISTRADOR', 'CHEFE_DEPARTAMENTO', 'CONSELHEIRO', 'PROFESSOR', 'ALUNO')),
    "status" TEXT NOT NULL DEFAULT 'ATIVO' CHECK (status IN ('ATIVO', 'INATIVO')),

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id")
);

-- AlterTable: colunas que referenciam identidade passam a ser uuid, iguais a
-- auth.users(id).
ALTER TABLE "sgrf"."ResourceRequest" ALTER COLUMN "requesterId" TYPE UUID USING "requesterId"::uuid;
ALTER TABLE "sgrf"."AuditEvent" ALTER COLUMN "actorId" TYPE UUID USING "actorId"::uuid;

-- AddForeignKey — condicionais. `auth` não é do Prisma: ele é criado por
-- `saga/db/schema.sql`. Quando `auth.users` já existe (dev/prod), a FK é
-- criada; quando não existe (banco de teste ainda não provisionado), a migration
-- não tenta criar nada em `auth` — apenas registra a referência.
DO $$
BEGIN
  IF to_regclass('auth.users') IS NOT NULL THEN
    ALTER TABLE "sgrf"."user_roles"
      ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id")
      REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

    ALTER TABLE "sgrf"."ResourceRequest"
      ADD CONSTRAINT "ResourceRequest_requesterId_fkey" FOREIGN KEY ("requesterId")
      REFERENCES "auth"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

    ALTER TABLE "sgrf"."AuditEvent"
      ADD CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId")
      REFERENCES "auth"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
