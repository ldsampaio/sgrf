-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'PROFESSOR',
    "status" TEXT NOT NULL DEFAULT 'ATIVO',
    "passwordHash" TEXT NOT NULL,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "temporaryPasswordExpiresAt" TIMESTAMP(3),
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepartmentSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "automaticApprovalLimitCents" INTEGER NOT NULL DEFAULT 0,
    "limitValidFrom" TIMESTAMP(3),
    "limitValidTo" TIMESTAMP(3),
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "currentExchangeRate" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "dailyAllowanceInfo" TEXT NOT NULL DEFAULT '',
    "votingDurationHours" INTEGER NOT NULL DEFAULT 24,
    "viewExtensionHours" INTEGER NOT NULL DEFAULT 24,
    "maxViewRequests" INTEGER NOT NULL DEFAULT 1,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DepartmentSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FundBalance" (
    "id" TEXT NOT NULL,
    "referenceYear" INTEGER NOT NULL,
    "availableCents" INTEGER NOT NULL DEFAULT 0,
    "provisionedCents" INTEGER NOT NULL DEFAULT 0,
    "spentCents" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FundBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourceRequest" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "justification" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'RASCUNHO',
    "referenceYear" INTEGER NOT NULL,
    "requestedAmountCents" INTEGER NOT NULL,
    "approvedAmountCents" INTEGER NOT NULL DEFAULT 0,
    "originalCurrency" TEXT NOT NULL DEFAULT 'BRL',
    "exchangeRate" DOUBLE PRECISION,
    "convertedAmountCents" INTEGER,
    "submittedAt" TIMESTAMP(3),
    "votingDeadlineAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "payload" TEXT NOT NULL DEFAULT '{}',
    "suspendedAt" TIMESTAMP(3),
    "suspendedBy" TEXT,
    "suspensionReason" TEXT NOT NULL DEFAULT '',
    "meetingDate" TIMESTAMP(3),
    "deadlineFrozenAt" TIMESTAMP(3),
    "decidedBy" TEXT,
    "decisionReason" TEXT NOT NULL DEFAULT '',
    "collegiateMinutes" TEXT NOT NULL DEFAULT '',
    "approvedItems" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResourceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestFile" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequestFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialTransaction" (
    "id" TEXT NOT NULL,
    "requestId" TEXT,
    "type" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "fromState" TEXT NOT NULL,
    "toState" TEXT NOT NULL,
    "performedBy" TEXT,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "beforeData" TEXT NOT NULL DEFAULT '{}',
    "afterData" TEXT NOT NULL DEFAULT '{}',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailQueue" (
    "id" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vote" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,
    "voteType" TEXT NOT NULL,
    "comment" TEXT NOT NULL DEFAULT '',
    "approvedAmountCents" INTEGER NOT NULL DEFAULT 0,
    "tieBreak" BOOLEAN NOT NULL DEFAULT false,
    "finalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliberationMessage" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "parentMessageId" TEXT,
    "content" TEXT NOT NULL,
    "history" TEXT NOT NULL DEFAULT '[]',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliberationMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ViewRequest" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "justification" TEXT NOT NULL,
    "deadlineBefore" TIMESTAMP(3),
    "deadlineAfter" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ViewRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "FundBalance_referenceYear_key" ON "FundBalance"("referenceYear");

-- CreateIndex
CREATE UNIQUE INDEX "Vote_requestId_voterId_key" ON "Vote"("requestId", "voterId");

-- CreateIndex
CREATE UNIQUE INDEX "ViewRequest_requestId_requestedBy_key" ON "ViewRequest"("requestId", "requestedBy");

-- AddForeignKey
ALTER TABLE "ResourceRequest" ADD CONSTRAINT "ResourceRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestFile" ADD CONSTRAINT "RequestFile_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ResourceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialTransaction" ADD CONSTRAINT "FinancialTransaction_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ResourceRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

