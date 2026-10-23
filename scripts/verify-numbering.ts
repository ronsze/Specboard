/**
 * 번호 backfill 점검 (개발 DB). 문제가 있으면 비정상 종료한다.
 * 실행: npm run db:verify-numbering
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const problems: string[] = [];
const num = (v: unknown) => Number(v);

async function main() {
  // 입력: 보드별 1..N 연속, 카운터 일치
  const boards = await db.$queryRaw<{ id: string; inputSeq: number; cnt: bigint; mx: number | null; dups: bigint }[]>`
    SELECT b."id", b."inputSeq",
           count(i."id") AS cnt, max(i."number") AS mx,
           count(i."id") - count(DISTINCT i."number") AS dups
    FROM "Board" b LEFT JOIN "Input" i ON i."boardId" = b."id"
    GROUP BY b."id"`;
  for (const b of boards) {
    if (num(b.dups) !== 0) problems.push(`보드 ${b.id}: 입력 번호 중복 ${b.dups}건`);
    if (num(b.cnt) !== num(b.mx ?? 0)) problems.push(`보드 ${b.id}: 입력 번호가 1..N으로 연속이 아님 (개수 ${b.cnt}, 최댓값 ${b.mx})`);
    if (num(b.inputSeq) !== num(b.mx ?? 0)) problems.push(`보드 ${b.id}: inputSeq(${b.inputSeq})가 최댓값(${b.mx})과 다름`);
  }

  // 항목: 같은 (spec, key, kind)는 모든 버전에서 같은 번호, 종류별 번호 중복 없음
  const inconsistentItems = await db.$queryRaw<{ n: bigint }[]>`
    SELECT count(*) AS n FROM (
      SELECT v."specId", i."key", i."kind"
      FROM "SpecItem" i JOIN "SpecVersion" v ON v."id" = i."versionId"
      GROUP BY v."specId", i."key", i."kind" HAVING count(DISTINCT i."number") > 1) t`;
  if (num(inconsistentItems[0].n) !== 0) problems.push(`같은 항목 key가 버전마다 다른 번호를 가짐: ${inconsistentItems[0].n}건`);

  const dupItemNumbers = await db.$queryRaw<{ n: bigint }[]>`
    SELECT count(*) AS n FROM (
      SELECT v."specId", i."kind", i."number", count(DISTINCT i."key") AS keys
      FROM "SpecItem" i JOIN "SpecVersion" v ON v."id" = i."versionId"
      GROUP BY v."specId", i."kind", i."number" HAVING count(DISTINCT i."key") > 1) t`;
  if (num(dupItemNumbers[0].n) !== 0) problems.push(`서로 다른 항목이 같은 번호를 공유함: ${dupItemNumbers[0].n}건`);

  // 질문: 같은 key는 같은 번호, 서로 다른 key는 다른 번호
  const inconsistentQuestions = await db.$queryRaw<{ n: bigint }[]>`
    SELECT count(*) AS n FROM (
      SELECT v."specId", q."key" FROM "OpenQuestion" q JOIN "SpecVersion" v ON v."id" = q."versionId"
      GROUP BY v."specId", q."key" HAVING count(DISTINCT q."number") > 1) t`;
  if (num(inconsistentQuestions[0].n) !== 0) problems.push(`같은 질문 key가 버전마다 다른 번호를 가짐: ${inconsistentQuestions[0].n}건`);
  const dupQuestionNumbers = await db.$queryRaw<{ n: bigint }[]>`
    SELECT count(*) AS n FROM (
      SELECT v."specId", q."number", count(DISTINCT q."key") AS keys
      FROM "OpenQuestion" q JOIN "SpecVersion" v ON v."id" = q."versionId"
      GROUP BY v."specId", q."number" HAVING count(DISTINCT q."key") > 1) t`;
  if (num(dupQuestionNumbers[0].n) !== 0) problems.push(`서로 다른 질문이 같은 번호를 공유함: ${dupQuestionNumbers[0].n}건`);

  // 카운터 일치
  const seqMismatch = await db.$queryRaw<{ n: bigint }[]>`
    SELECT count(*) AS n FROM "Spec" s WHERE
      s."decisionSeq" <> COALESCE((SELECT max(i."number") FROM "SpecItem" i JOIN "SpecVersion" v ON v."id" = i."versionId" WHERE v."specId" = s."id" AND i."kind" = 'DECISION'), 0)
   OR s."requirementSeq" <> COALESCE((SELECT max(i."number") FROM "SpecItem" i JOIN "SpecVersion" v ON v."id" = i."versionId" WHERE v."specId" = s."id" AND i."kind" = 'REQUIREMENT'), 0)
   OR s."questionSeq" <> COALESCE((SELECT max(q."number") FROM "OpenQuestion" q JOIN "SpecVersion" v ON v."id" = q."versionId" WHERE v."specId" = s."id"), 0)`;
  if (num(seqMismatch[0].n) !== 0) problems.push(`Spec 번호 카운터가 최댓값과 다름: ${seqMismatch[0].n}건`);

  // 종류가 바뀐 key (002에는 금지 규칙이 없었음: 있으면 종류별로 번호를 받았다)
  const kindChanged = await db.$queryRaw<{ n: bigint }[]>`
    SELECT count(*) AS n FROM (
      SELECT v."specId", i."key" FROM "SpecItem" i JOIN "SpecVersion" v ON v."id" = i."versionId"
      GROUP BY v."specId", i."key" HAVING count(DISTINCT i."kind") > 1) t`;

  const totals = await db.$queryRaw<{ inputs: bigint; items: bigint; questions: bigint }[]>`
    SELECT (SELECT count(*) FROM "Input") AS inputs, (SELECT count(*) FROM "SpecItem") AS items, (SELECT count(*) FROM "OpenQuestion") AS questions`;
  console.log(`입력 ${totals[0].inputs}개, 항목 행 ${totals[0].items}개, 질문 행 ${totals[0].questions}개 점검`);
  console.log(`종류가 바뀐 항목 key: ${kindChanged[0].n}개`);

  if (problems.length > 0) {
    console.error("번호 점검 실패:\n- " + problems.join("\n- "));
    process.exitCode = 1;
  } else {
    console.log("번호 점검 통과");
  }
}

main().finally(() => db.$disconnect());
