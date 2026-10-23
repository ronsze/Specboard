import { approveInput, submitInput } from "@/server/services/inputs";
import { drainSpecJobs } from "@/server/services/spec-jobs";
import { finalizeSpec } from "@/server/services/spec";
import { FakeSpecWriter } from "@/server/ai/fake-spec-writer";
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

/**
 * 관리자 자동 승인 입력으로 항목을 만들어 spec 버전을 쌓는다(각 텍스트가 요구사항 항목 하나).
 * finalize=true면 확정까지 한다.
 */
export async function seedSpecItems(w: World, texts: string[], finalize = false) {
  for (const content of texts) {
    await submitInput(w.admin, w.board.id, w.feature.id, { kind: "IDEA", content });
    await drainSpecJobs(w.feature.id, new FakeSpecWriter());
  }
  if (finalize) await finalizeSpec(w.admin, w.board.id, w.feature.id);
}

export const seedFinalizedSpec = (w: World, texts: string[]) => seedSpecItems(w, texts, true);
