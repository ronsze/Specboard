import { describe, expect, it } from "vitest";
import { diffVersions } from "@/server/services/spec-diff";
import type { ItemView, QuestionView, VersionDetail } from "@/server/services/spec-view";

const item = (key: string, text: string): ItemView => ({
  key, kind: "REQUIREMENT", number: 1, label: "R-1", text, firstVersion: 1, lastChangedVersion: 1, change: "NONE", sources: [],
});
const question = (key: string, text: string, status: "OPEN" | "RESOLVED" = "OPEN"): QuestionView => ({
  key, number: 1, label: "Q-1", text, status, resolvedInVersion: null, sources: [], resolvedBy: null,
});
const version = (number: number, items: ItemView[], questions: QuestionView[] = []): VersionDetail => ({
  number, kind: "AI_UPDATE", revertedFromNumber: null, createdByName: null,
  createdAt: new Date().toISOString(), inputIds: [], inputs: [], isCurrent: false, items, questions,
  counts: { decisions: 0, requirements: items.length, openQuestions: 0, resolvedQuestions: 0 },
});

describe("diffVersions", () => {
  it("추가·삭제·변경을 key 기준으로 구분한다", () => {
    const from = version(1, [item("a", "A"), item("b", "B"), item("c", "C")]);
    const to = version(2, [item("a", "A"), item("b", "B2"), item("d", "D")]);
    const d = diffVersions(from, to);
    expect(d.items).toEqual([
      { change: "CHANGED", key: "b", before: "B", after: "B2" },
      { change: "ADDED", key: "d", before: null, after: "D" },
      { change: "REMOVED", key: "c", before: "C", after: null },
    ]);
  });

  it("변화가 없으면 빈 목록", () => {
    const v = version(1, [item("a", "A")]);
    expect(diffVersions(v, version(2, [item("a", "A")])).items).toEqual([]);
  });

  it("항목 순서만 바뀐 것은 변경이 아니다", () => {
    const d = diffVersions(version(1, [item("a", "A"), item("b", "B")]), version(2, [item("b", "B"), item("a", "A")]));
    expect(d.items).toEqual([]);
  });

  it("질문의 상태 변화는 CHANGED로 표시한다", () => {
    const d = diffVersions(
      version(1, [], [question("q", "언제?")]),
      version(2, [], [question("q", "언제?", "RESOLVED")]),
    );
    expect(d.questions).toEqual([{ change: "CHANGED", key: "q", before: "언제? (열림)", after: "언제? (해소)" }]);
  });

  it("질문 추가·삭제", () => {
    const d = diffVersions(version(1, [], [question("q1", "A?")]), version(2, [], [question("q2", "B?")]));
    expect(d.questions.map((c) => c.change).sort()).toEqual(["ADDED", "REMOVED"]);
  });
});
