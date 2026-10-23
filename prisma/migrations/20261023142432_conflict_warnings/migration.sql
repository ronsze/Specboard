-- CreateEnum
CREATE TYPE "ConflictStatus" AS ENUM ('QUEUED', 'RUNNING', 'DONE', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "ConflictCheck" (
    "id" TEXT NOT NULL,
    "inputId" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "status" "ConflictStatus" NOT NULL DEFAULT 'QUEUED',
    "skipReason" TEXT,
    "lastError" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "baseVersionNumber" INTEGER,
    "model" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ConflictCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConflictWarning" (
    "id" TEXT NOT NULL,
    "checkId" TEXT NOT NULL,
    "inputId" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "itemKind" "SpecItemKind" NOT NULL,
    "itemNumber" INTEGER NOT NULL,
    "itemText" TEXT NOT NULL,
    "onFinalizedSpec" BOOLEAN NOT NULL,
    "reason" TEXT NOT NULL,
    "quoteStart" INTEGER,
    "quoteEnd" INTEGER,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedBy" TEXT,
    "acknowledgedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConflictWarning_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConflictCheck_boardId_status_idx" ON "ConflictCheck"("boardId", "status");

-- CreateIndex
CREATE INDEX "ConflictCheck_inputId_createdAt_idx" ON "ConflictCheck"("inputId", "createdAt");

-- CreateIndex
CREATE INDEX "ConflictWarning_inputId_idx" ON "ConflictWarning"("inputId");

-- CreateIndex
CREATE UNIQUE INDEX "ConflictWarning_checkId_itemKey_key" ON "ConflictWarning"("checkId", "itemKey");

-- AddForeignKey
ALTER TABLE "ConflictCheck" ADD CONSTRAINT "ConflictCheck_inputId_fkey" FOREIGN KEY ("inputId") REFERENCES "Input"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConflictWarning" ADD CONSTRAINT "ConflictWarning_checkId_fkey" FOREIGN KEY ("checkId") REFERENCES "ConflictCheck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConflictWarning" ADD CONSTRAINT "ConflictWarning_inputId_fkey" FOREIGN KEY ("inputId") REFERENCES "Input"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- 입력당 QUEUED 또는 RUNNING 검사는 최대 1개
CREATE UNIQUE INDEX "ConflictCheck_active_input_key" ON "ConflictCheck"("inputId") WHERE "status" IN ('QUEUED', 'RUNNING');
