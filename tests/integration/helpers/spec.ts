import { approveInput, submitInput } from "@/server/services/inputs";
import { testDb, type World } from "./db";

/** 멤버가 제출하고 관리자가 승인한 입력 (승인 시 갱신 작업이 등록된다). */
export async function approvedInput(w: World, content: string) {
  const input = await submitInput(w.member, w.board.id, w.feature.id, { kind: "IDEA", content });
  await approveInput(w.admin, w.board.id, input.id);
  return input;
}

export const versionsOf = (featureId: string) =>
  testDb.specVersion.findMany({
    where: { spec: { featureId } },
    orderBy: { number: "asc" },
    include: { items: { include: { sources: true } }, questions: { include: { sources: true } }, inputs: true },
  });
