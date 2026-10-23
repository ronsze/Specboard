import { itemLabel, questionLabel } from "@/lib/labels";

export type RevertExpected = { latestVersion: number; removedItems: number; reopenedQuestions: number };

export type RevertPreview = {
  toVersion: number;
  latestVersion: number;
  /** 되돌리면 만들어질 버전 번호 */
  newVersion: number;
  removedItems: number;
  reopenedQuestions: number;
  removedLabels: string[];
  reopenedLabels: string[];
  finalized: boolean;
};

type Snapshot = {
  items: { key: string; kind: "DECISION" | "REQUIREMENT"; number: number }[];
  questions: { key: string; status: "OPEN" | "RESOLVED"; number: number }[];
};

/**
 * 최신 버전에서 대상 버전으로 되돌릴 때의 영향.
 * - 빠지는 항목: 최신에 있고 대상에 없는 항목
 * - 다시 열리는 질문: 최신에서 해소되었는데 대상에서는 열림이거나 없는 질문
 * revertSpec이 만드는 새 버전은 대상 버전의 복사본이므로 이 계산이 곧 실제 결과다.
 */
export function computeRevertImpact(latest: Snapshot, target: Snapshot) {
  const targetItems = new Set(target.items.map((i) => i.key));
  const targetQuestions = new Map(target.questions.map((q) => [q.key, q.status]));
  const removed = latest.items.filter((i) => !targetItems.has(i.key));
  const reopened = latest.questions.filter((q) => q.status === "RESOLVED" && targetQuestions.get(q.key) !== "RESOLVED");
  return {
    removedItems: removed.length,
    reopenedQuestions: reopened.length,
    removedLabels: removed.map((i) => itemLabel(i.kind, i.number)),
    reopenedLabels: reopened.map((q) => questionLabel(q.number)),
  };
}
