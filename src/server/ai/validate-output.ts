import { randomUUID } from "node:crypto";
import { writerOutputSchema } from "@/lib/schemas/spec";
import {
  SpecWriterError,
  type CurrentItem,
  type CurrentQuestion,
  type WriterOutput,
} from "@/server/ai/spec-writer";

const invalid = (message: string) => new SpecWriterError("INVALID_OUTPUT", message);

/**
 * 모델 출력의 서버 측 검증 (constitution 원칙 I, II의 강제 지점).
 * - 모든 항목·질문에 출처가 있고, 출처는 이 feature의 승인된 입력이어야 한다.
 * - 새로 만들거나 문구가 바뀐 항목·질문은 이번에 반영하는 입력을 1개 이상 인용해야 한다.
 * - 질문 해소는 이번 반영 입력이 답일 때만 가능하고, 해소된 질문은 다시 열 수 없다.
 * 통과하면 새 항목·질문에 key를 부여한 정규화 결과를 돌려준다.
 */
export function validateSpecOutput(
  current: { items: CurrentItem[]; questions: CurrentQuestion[] },
  batchInputIds: ReadonlySet<string>,
  approvedInputIds: ReadonlySet<string>,
  raw: unknown,
): WriterOutput {
  const parsed = writerOutputSchema.safeParse(raw);
  if (!parsed.success) throw invalid(parsed.error.issues[0]?.message ?? "출력 형식이 올바르지 않습니다.");
  const output = parsed.data;

  const citesBatch = (ids: string[]) => ids.some((id) => batchInputIds.has(id));
  const assertSources = (ids: string[]) => {
    for (const id of ids) {
      if (!approvedInputIds.has(id)) throw invalid(`승인된 입력이 아닌 출처입니다: ${id}`);
    }
  };

  const itemsByKey = new Map(current.items.map((i) => [i.key, i]));
  const seenItemKeys = new Set<string>();
  const items = output.items.map((item) => {
    assertSources(item.sourceInputIds);
    let key = item.key;
    if (key === null) {
      if (!citesBatch(item.sourceInputIds)) throw invalid("새 항목은 이번에 반영하는 입력을 인용해야 합니다.");
      key = randomUUID();
    } else {
      const existing = itemsByKey.get(key);
      if (!existing) throw invalid(`알 수 없는 항목 key입니다: ${key}`);
      if (existing.kind !== item.kind) throw invalid("기존 항목의 종류(결정/요구사항)는 바꿀 수 없습니다.");
      if (existing.text.trim() !== item.text.trim() && !citesBatch(item.sourceInputIds)) {
        throw invalid("문구가 바뀐 항목은 이번에 반영하는 입력을 인용해야 합니다.");
      }
    }
    if (seenItemKeys.has(key)) throw invalid(`중복된 항목 key입니다: ${key}`);
    seenItemKeys.add(key);
    return { ...item, key };
  });

  const questionsByKey = new Map(current.questions.map((q) => [q.key, q]));
  const seenQuestionKeys = new Set<string>();
  const questions = output.questions.map((q) => {
    assertSources(q.sourceInputIds);
    let key = q.key;
    const existing = key === null ? undefined : questionsByKey.get(key);
    if (key === null) {
      if (!citesBatch(q.sourceInputIds)) throw invalid("새 질문은 이번에 반영하는 입력을 인용해야 합니다.");
      key = randomUUID();
    } else if (!existing) {
      throw invalid(`알 수 없는 질문 key입니다: ${key}`);
    } else if (existing.text.trim() !== q.text.trim() && !citesBatch(q.sourceInputIds)) {
      throw invalid("문구가 바뀐 질문은 이번에 반영하는 입력을 인용해야 합니다.");
    }

    if (existing?.status === "RESOLVED") {
      if (q.status !== "RESOLVED" || q.resolvedByInputId !== existing.resolvedByInputId) {
        throw invalid("해소된 질문은 다시 열거나 해소 근거를 바꿀 수 없습니다.");
      }
    } else if (q.status === "RESOLVED") {
      if (!q.resolvedByInputId || !batchInputIds.has(q.resolvedByInputId)) {
        throw invalid("질문 해소는 이번에 반영하는 입력이 답일 때만 가능합니다.");
      }
    } else if (q.resolvedByInputId !== null) {
      throw invalid("열린 질문에 해소 입력이 지정되어 있습니다.");
    }

    if (seenQuestionKeys.has(key)) throw invalid(`중복된 질문 key입니다: ${key}`);
    seenQuestionKeys.add(key);
    return { ...q, key };
  });

  return { items, questions };
}
