import { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

/**
 * 보드 단위 입력 번호를 원자적으로 부여한다. 행 잠금이 걸린 UPDATE ... RETURNING 이므로
 * 동시 제출에도 중복·결번이 없고, 호출한 트랜잭션이 롤백되면 번호도 함께 롤백된다.
 */
export async function allocateInputNumber(tx: Tx, boardId: string): Promise<number> {
  const rows = await tx.$queryRaw<{ inputSeq: number }[]>`
    UPDATE "Board" SET "inputSeq" = "inputSeq" + 1 WHERE "id" = ${boardId} RETURNING "inputSeq"`;
  return rows[0].inputSeq;
}

const ITEM_COUNTER = { DECISION: "decisionSeq", REQUIREMENT: "requirementSeq" } as const;

/** 항목 종류별 안정 번호(D-n/R-n). feature 락 안에서 새 key를 저장할 때만 호출한다. */
export async function allocateItemNumber(
  tx: Tx,
  specId: string,
  kind: keyof typeof ITEM_COUNTER,
): Promise<number> {
  const column = Prisma.raw(`"${ITEM_COUNTER[kind]}"`);
  const rows = await tx.$queryRaw<Record<string, number>[]>`
    UPDATE "Spec" SET ${column} = ${column} + 1 WHERE "id" = ${specId} RETURNING ${column} AS seq`;
  return rows[0].seq;
}

/** 미결 질문 안정 번호(Q-n). */
export async function allocateQuestionNumber(tx: Tx, specId: string): Promise<number> {
  const rows = await tx.$queryRaw<{ questionSeq: number }[]>`
    UPDATE "Spec" SET "questionSeq" = "questionSeq" + 1 WHERE "id" = ${specId} RETURNING "questionSeq"`;
  return rows[0].questionSeq;
}
