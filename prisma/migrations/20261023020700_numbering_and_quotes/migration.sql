-- 입력 번호(IN-n), 항목·질문 안정 번호(D-n/R-n/Q-n), 인용 발췌 위치 컬럼을 추가한다.
-- 기존 데이터의 내용은 바꾸지 않고 번호만 채운다.

-- 1. 컬럼 추가 (번호 컬럼은 backfill 전까지 nullable)
ALTER TABLE "Board" ADD COLUMN "inputSeq" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Input" ADD COLUMN "boardId" TEXT, ADD COLUMN "number" INTEGER;
ALTER TABLE "Spec"
  ADD COLUMN "decisionSeq" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "questionSeq" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "requirementSeq" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SpecItem" ADD COLUMN "number" INTEGER;
ALTER TABLE "OpenQuestion" ADD COLUMN "number" INTEGER;
ALTER TABLE "SpecItemSource" ADD COLUMN "quoteEnd" INTEGER, ADD COLUMN "quoteStart" INTEGER;
ALTER TABLE "OpenQuestionSource" ADD COLUMN "quoteEnd" INTEGER, ADD COLUMN "quoteStart" INTEGER;

-- 2. 입력: 보드 id와 보드별 번호 (제출 시각, id 순)
UPDATE "Input" i
SET "boardId" = p."boardId"
FROM "Feature" f
JOIN "Project" p ON p."id" = f."projectId"
WHERE f."id" = i."featureId";

WITH numbered AS (
  SELECT "id", row_number() OVER (PARTITION BY "boardId" ORDER BY "submittedAt", "id") AS n
  FROM "Input"
)
UPDATE "Input" i SET "number" = numbered.n FROM numbered WHERE numbered."id" = i."id";

UPDATE "Board" b
SET "inputSeq" = COALESCE((SELECT max("number") FROM "Input" WHERE "boardId" = b."id"), 0);

-- 3. 항목: (key, kind) 쌍의 최초 등장(최소 버전 번호, 그 안의 position) 순서로 종류별 번호.
--    같은 (key, kind)의 모든 버전 행에 같은 번호를 쓴다.
WITH firsts AS (
  SELECT v."specId" AS spec_id, i."key" AS k, i."kind" AS kd,
         min(v."number"::bigint * 1000000 + i."position") AS ord
  FROM "SpecItem" i
  JOIN "SpecVersion" v ON v."id" = i."versionId"
  GROUP BY v."specId", i."key", i."kind"
), ranked AS (
  SELECT spec_id, k, kd, row_number() OVER (PARTITION BY spec_id, kd ORDER BY ord) AS n
  FROM firsts
)
UPDATE "SpecItem" i
SET "number" = r.n
FROM ranked r, "SpecVersion" v
WHERE v."id" = i."versionId" AND r.spec_id = v."specId" AND r.k = i."key" AND r.kd = i."kind";

-- 4. 질문: key의 최초 등장 순서로 번호
WITH firsts AS (
  SELECT v."specId" AS spec_id, q."key" AS k,
         min(v."number"::bigint * 1000000 + q."position") AS ord
  FROM "OpenQuestion" q
  JOIN "SpecVersion" v ON v."id" = q."versionId"
  GROUP BY v."specId", q."key"
), ranked AS (
  SELECT spec_id, k, row_number() OVER (PARTITION BY spec_id ORDER BY ord) AS n FROM firsts
)
UPDATE "OpenQuestion" q
SET "number" = r.n
FROM ranked r, "SpecVersion" v
WHERE v."id" = q."versionId" AND r.spec_id = v."specId" AND r.k = q."key";

-- 5. 카운터를 현재 최댓값으로 설정
UPDATE "Spec" s SET
  "decisionSeq" = COALESCE((SELECT max(i."number") FROM "SpecItem" i JOIN "SpecVersion" v ON v."id" = i."versionId"
                            WHERE v."specId" = s."id" AND i."kind" = 'DECISION'), 0),
  "requirementSeq" = COALESCE((SELECT max(i."number") FROM "SpecItem" i JOIN "SpecVersion" v ON v."id" = i."versionId"
                               WHERE v."specId" = s."id" AND i."kind" = 'REQUIREMENT'), 0),
  "questionSeq" = COALESCE((SELECT max(q."number") FROM "OpenQuestion" q JOIN "SpecVersion" v ON v."id" = q."versionId"
                            WHERE v."specId" = s."id"), 0);

-- 6. 제약 적용
ALTER TABLE "Input" ALTER COLUMN "boardId" SET NOT NULL, ALTER COLUMN "number" SET NOT NULL;
ALTER TABLE "SpecItem" ALTER COLUMN "number" SET NOT NULL;
ALTER TABLE "OpenQuestion" ALTER COLUMN "number" SET NOT NULL;

CREATE INDEX "Input_boardId_status_submittedAt_idx" ON "Input"("boardId", "status", "submittedAt");
CREATE UNIQUE INDEX "Input_boardId_number_key" ON "Input"("boardId", "number");
CREATE UNIQUE INDEX "OpenQuestion_versionId_number_key" ON "OpenQuestion"("versionId", "number");
CREATE UNIQUE INDEX "SpecItem_versionId_kind_number_key" ON "SpecItem"("versionId", "kind", "number");

ALTER TABLE "Input" ADD CONSTRAINT "Input_boardId_fkey"
  FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;
