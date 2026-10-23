import { describe, expect, it } from "vitest";
import { computeProvenance } from "@/server/services/spec-provenance";

type ItemRow = { key: string; text: string; versionNumber: number };
type QuestionRow = { key: string; status: "OPEN" | "RESOLVED"; versionNumber: number };
const run = (items: ItemRow[], latest: number, questions: QuestionRow[] = []) =>
  computeProvenance(items, questions, latest);

describe("computeProvenance - 항목", () => {
  it("처음 등장한 버전과 문구가 달라진 가장 최근 버전을 구한다", () => {
    const p = run(
      [
        { key: "a", text: "A", versionNumber: 1 },
        { key: "a", text: "A", versionNumber: 2 },
        { key: "a", text: "A2", versionNumber: 3 },
        { key: "a", text: "A2", versionNumber: 4 },
      ],
      4,
    );
    expect(p.items.get("a")).toEqual({ firstVersion: 1, lastChangedVersion: 3, change: "NONE" });
  });

  it("바뀌지 않았으면 마지막 변경 버전은 처음 버전", () => {
    const p = run([{ key: "a", text: "A", versionNumber: 2 }, { key: "a", text: "A", versionNumber: 3 }], 3);
    expect(p.items.get("a")).toEqual({ firstVersion: 2, lastChangedVersion: 2, change: "NONE" });
  });

  it("최신 버전에서 새로 생긴 항목은 ADDED, 최신에서 바뀐 항목은 CHANGED", () => {
    const p = run(
      [
        { key: "a", text: "A", versionNumber: 1 },
        { key: "a", text: "A 변경", versionNumber: 2 },
        { key: "b", text: "B", versionNumber: 2 },
      ],
      2,
    );
    expect(p.items.get("a")).toMatchObject({ change: "CHANGED", lastChangedVersion: 2 });
    expect(p.items.get("b")).toMatchObject({ change: "ADDED", firstVersion: 2, lastChangedVersion: 2 });
  });

  it("사라졌다가 되돌리기로 복원된 항목은 복원된 버전이 마지막 변경이다", () => {
    const p = run(
      [
        { key: "a", text: "A", versionNumber: 1 },
        { key: "a", text: "A", versionNumber: 2 },
        // v3에서 삭제
        { key: "a", text: "A", versionNumber: 4 }, // v4(되돌림)에서 복원
      ],
      4,
    );
    expect(p.items.get("a")).toEqual({ firstVersion: 1, lastChangedVersion: 4, change: "CHANGED" });
  });

  it("되돌리기로 이전 문구가 복원되면 그 되돌림 버전이 마지막 변경이다", () => {
    const p = run(
      [
        { key: "a", text: "A", versionNumber: 1 },
        { key: "a", text: "A2", versionNumber: 2 },
        { key: "a", text: "A", versionNumber: 3 },
      ],
      3,
    );
    expect(p.items.get("a")).toMatchObject({ firstVersion: 1, lastChangedVersion: 3 });
  });
});

describe("computeProvenance - 질문 해소 버전", () => {
  it("처음 RESOLVED가 된 버전을 구하고 열린 질문은 null", () => {
    const p = run([], 4, [
      { key: "q1", status: "OPEN", versionNumber: 1 },
      { key: "q1", status: "OPEN", versionNumber: 2 },
      { key: "q1", status: "RESOLVED", versionNumber: 3 },
      { key: "q1", status: "RESOLVED", versionNumber: 4 },
      { key: "q2", status: "OPEN", versionNumber: 4 },
    ]);
    expect(p.questions.get("q1")).toEqual({ resolvedInVersion: 3 });
    expect(p.questions.get("q2")).toEqual({ resolvedInVersion: null });
  });

  it("되돌리기로 다시 열린 질문은 null, 이후 다시 해소되면 그 버전", () => {
    const reopened = run([], 3, [
      { key: "q", status: "OPEN", versionNumber: 1 },
      { key: "q", status: "RESOLVED", versionNumber: 2 },
      { key: "q", status: "OPEN", versionNumber: 3 },
    ]);
    expect(reopened.questions.get("q")).toEqual({ resolvedInVersion: null });

    const again = run([], 4, [
      { key: "q", status: "OPEN", versionNumber: 1 },
      { key: "q", status: "RESOLVED", versionNumber: 2 },
      { key: "q", status: "OPEN", versionNumber: 3 },
      { key: "q", status: "RESOLVED", versionNumber: 4 },
    ]);
    expect(again.questions.get("q")).toEqual({ resolvedInVersion: 4 });
  });
});
