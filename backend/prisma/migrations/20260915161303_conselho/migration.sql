-- CreateTable
CREATE TABLE "DeliberationMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "parentMessageId" TEXT,
    "content" TEXT NOT NULL,
    "history" TEXT NOT NULL DEFAULT '[]',
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ViewRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "justification" TEXT NOT NULL,
    "deadlineBefore" DATETIME,
    "deadlineAfter" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ResourceRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requesterId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "justification" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'RASCUNHO',
    "referenceYear" INTEGER NOT NULL,
    "requestedAmountCents" INTEGER NOT NULL,
    "approvedAmountCents" INTEGER NOT NULL DEFAULT 0,
    "originalCurrency" TEXT NOT NULL DEFAULT 'BRL',
    "exchangeRate" REAL,
    "convertedAmountCents" INTEGER,
    "submittedAt" DATETIME,
    "votingDeadlineAt" DATETIME,
    "decidedAt" DATETIME,
    "payload" TEXT NOT NULL DEFAULT '{}',
    "suspendedAt" DATETIME,
    "suspendedBy" TEXT,
    "suspensionReason" TEXT NOT NULL DEFAULT '',
    "meetingDate" DATETIME,
    "deadlineFrozenAt" DATETIME,
    "decidedBy" TEXT,
    "decisionReason" TEXT NOT NULL DEFAULT '',
    "collegiateMinutes" TEXT NOT NULL DEFAULT '',
    "approvedItems" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ResourceRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ResourceRequest" ("approvedAmountCents", "convertedAmountCents", "createdAt", "decidedAt", "exchangeRate", "id", "justification", "originalCurrency", "payload", "referenceYear", "requestedAmountCents", "requesterId", "status", "submittedAt", "title", "type", "updatedAt", "votingDeadlineAt") SELECT "approvedAmountCents", "convertedAmountCents", "createdAt", "decidedAt", "exchangeRate", "id", "justification", "originalCurrency", "payload", "referenceYear", "requestedAmountCents", "requesterId", "status", "submittedAt", "title", "type", "updatedAt", "votingDeadlineAt" FROM "ResourceRequest";
DROP TABLE "ResourceRequest";
ALTER TABLE "new_ResourceRequest" RENAME TO "ResourceRequest";
CREATE TABLE "new_Vote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,
    "voteType" TEXT NOT NULL,
    "comment" TEXT NOT NULL DEFAULT '',
    "approvedAmountCents" INTEGER NOT NULL DEFAULT 0,
    "tieBreak" BOOLEAN NOT NULL DEFAULT false,
    "finalizedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Vote" ("comment", "createdAt", "id", "requestId", "updatedAt", "voteType", "voterId") SELECT "comment", "createdAt", "id", "requestId", "updatedAt", "voteType", "voterId" FROM "Vote";
DROP TABLE "Vote";
ALTER TABLE "new_Vote" RENAME TO "Vote";
CREATE UNIQUE INDEX "Vote_requestId_voterId_key" ON "Vote"("requestId", "voterId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "ViewRequest_requestId_requestedBy_key" ON "ViewRequest"("requestId", "requestedBy");
