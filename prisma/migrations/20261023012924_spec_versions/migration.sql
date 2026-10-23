-- CreateEnum
CREATE TYPE "SpecVersionKind" AS ENUM ('AI_UPDATE', 'REVERT');

-- CreateEnum
CREATE TYPE "SpecItemKind" AS ENUM ('DECISION', 'REQUIREMENT');

-- CreateEnum
CREATE TYPE "QuestionStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'RUNNING', 'FAILED', 'DONE');

-- AlterTable
ALTER TABLE "Input" ADD COLUMN     "consumedAt" TIMESTAMP(3),
ADD COLUMN     "consumedVersionId" TEXT;

-- CreateTable
CREATE TABLE "Spec" (
    "id" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "currentVersionId" TEXT,
    "finalizedAt" TIMESTAMP(3),
    "finalizedBy" TEXT,
    "finalizedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Spec_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpecVersion" (
    "id" TEXT NOT NULL,
    "specId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "kind" "SpecVersionKind" NOT NULL,
    "revertedFromNumber" INTEGER,
    "createdBy" TEXT,
    "createdByName" TEXT,
    "model" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpecVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpecVersionInput" (
    "versionId" TEXT NOT NULL,
    "inputId" TEXT NOT NULL,

    CONSTRAINT "SpecVersionInput_pkey" PRIMARY KEY ("versionId","inputId")
);

-- CreateTable
CREATE TABLE "SpecItem" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "kind" "SpecItemKind" NOT NULL,
    "text" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "SpecItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpecItemSource" (
    "itemId" TEXT NOT NULL,
    "inputId" TEXT NOT NULL,

    CONSTRAINT "SpecItemSource_pkey" PRIMARY KEY ("itemId","inputId")
);

-- CreateTable
CREATE TABLE "OpenQuestion" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "status" "QuestionStatus" NOT NULL,
    "resolvedByInputId" TEXT,
    "position" INTEGER NOT NULL,

    CONSTRAINT "OpenQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpenQuestionSource" (
    "questionId" TEXT NOT NULL,
    "inputId" TEXT NOT NULL,

    CONSTRAINT "OpenQuestionSource_pkey" PRIMARY KEY ("questionId","inputId")
);

-- CreateTable
CREATE TABLE "SpecJob" (
    "id" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpecJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Spec_featureId_key" ON "Spec"("featureId");

-- CreateIndex
CREATE UNIQUE INDEX "SpecVersion_specId_number_key" ON "SpecVersion"("specId", "number");

-- CreateIndex
CREATE INDEX "SpecItem_versionId_idx" ON "SpecItem"("versionId");

-- CreateIndex
CREATE INDEX "OpenQuestion_versionId_idx" ON "OpenQuestion"("versionId");

-- CreateIndex
CREATE INDEX "SpecJob_featureId_status_idx" ON "SpecJob"("featureId", "status");

-- AddForeignKey
ALTER TABLE "Spec" ADD CONSTRAINT "Spec_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "Feature"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecVersion" ADD CONSTRAINT "SpecVersion_specId_fkey" FOREIGN KEY ("specId") REFERENCES "Spec"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecVersionInput" ADD CONSTRAINT "SpecVersionInput_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "SpecVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecVersionInput" ADD CONSTRAINT "SpecVersionInput_inputId_fkey" FOREIGN KEY ("inputId") REFERENCES "Input"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecItem" ADD CONSTRAINT "SpecItem_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "SpecVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecItemSource" ADD CONSTRAINT "SpecItemSource_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "SpecItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecItemSource" ADD CONSTRAINT "SpecItemSource_inputId_fkey" FOREIGN KEY ("inputId") REFERENCES "Input"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpenQuestion" ADD CONSTRAINT "OpenQuestion_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "SpecVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpenQuestion" ADD CONSTRAINT "OpenQuestion_resolvedByInputId_fkey" FOREIGN KEY ("resolvedByInputId") REFERENCES "Input"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpenQuestionSource" ADD CONSTRAINT "OpenQuestionSource_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "OpenQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpenQuestionSource" ADD CONSTRAINT "OpenQuestionSource_inputId_fkey" FOREIGN KEY ("inputId") REFERENCES "Input"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecJob" ADD CONSTRAINT "SpecJob_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "Feature"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- feature당 QUEUED 또는 RUNNING 작업은 최대 1개
CREATE UNIQUE INDEX "SpecJob_active_feature_key" ON "SpecJob"("featureId") WHERE "status" IN ('QUEUED', 'RUNNING');
