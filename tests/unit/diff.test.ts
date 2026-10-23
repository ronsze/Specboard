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
  it("추가·삭제·변경을 key 기준으로 구분하고 라벨과 요약을 만든다", () => {
    const from = version(1, [item("a", "A"), item("b", "B"), item("c", "C")]);
    const to = version(2, [item("a", "A"), item("b", "B2"), item("d", "D")]);
    const d = diffVersions(from, to);
    expect(d.items.map((c) => [c.change, c.key, c.before, c.after, c.scope])).toEqual([
      ["CHANGED", "b", "B", "B2", "ITEM"],
      ["ADDED", "d", null, "D", "ITEM"],
      ["REMOVED", "c", "C", null, "ITEM"],
    ]);
    expect(d.items[0]).toMatchObject({ label: "R-1", kind: "REQUIREMENT" });
    expect(d.summary).toEqual({ added: 1, removed: 1, changed: 1, unchanged: 1 });
    expect(d.unchanged.map((u) => u.key)).toEqual(["a"]);
  });

  it("변화가 없으면 변경 목록이 비고 동일 개수만 남는다", () => {
    const v = version(1, [item("a", "A")]);
    const d = diffVersions(v, version(2, [item("a", "A")]));
    expect(d.items).toEqual([]);
    expect(d.summary).toEqual({ added: 0, removed: 0, changed: 0, unchanged: 1 });
  });

  it("항목 순서만 바뀐 것은 변경이 아니다", () => {
    const d = diffVersions(version(1, [item("a", "A"), item("b", "B")]), version(2, [item("b", "B"), item("a", "A")]));
    expect(d.items).toEqual([]);
  });

  it("문구는 같아도 새 출처가 붙으면 변경이고 새 출처가 표시된다", () => {
    const src = (id: string, number: number) => ({
      inputId: id, number, kind: "IDEA" as const, submitterName: "x", submittedAt: "2026-10-01T00:00:00Z", status: "APPROVED" as const, content: "c", quote: null,
    });
    const from = version(1, [{ ...item("a", "A"), sources: [src("i1", 1)] }]);
    const to = version(2, [{ ...item("a", "A"), sources: [src("i1", 1), src("i2", 12)] }]);
    const d = diffVersions(from, to);
    expect(d.items).toHaveLength(1);
    expect(d.items[0]).toMatchObject({ change: "CHANGED", before: "A", after: "A" });
    expect(d.items[0].addedSources).toEqual([{ id: "i2", number: 12, label: "IN-12" }]);
  });

  it("새로 생긴 항목은 모든 출처가 새 출처다", () => {
    const src = { inputId: "i9", number: 9, kind: "IDEA" as const, submitterName: "x", submittedAt: "2026-10-01T00:00:00Z", status: "APPROVED" as const, content: "c", quote: null };
    const d = diffVersions(version(1, []), version(2, [{ ...item("n", "새 항목"), sources: [src] }]));
    expect(d.items[0].addedSources.map((s) => s.label)).toEqual(["IN-9"]);
  });

  it("질문의 상태 변화는 CHANGED로 표시한다", () => {
    const d = diffVersions(
      version(1, [], [question("q", "언제?")]),
      version(2, [], [question("q", "언제?", "RESOLVED")]),
    );
    expect(d.questions).toHaveLength(1);
    expect(d.questions[0]).toMatchObject({ change: "CHANGED", scope: "QUESTION", before: "언제? (열림)", after: "언제? (해소)", label: "Q-1" });
  });

  it("질문 추가·삭제", () => {
    const d = diffVersions(version(1, [], [question("q1", "A?")]), version(2, [], [question("q2", "B?")]));
    expect(d.questions.map((c) => c.change).sort()).toEqual(["ADDED", "REMOVED"]);
    expect(d.summary).toMatchObject({ added: 1, removed: 1 });
  });
});
