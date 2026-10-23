import { describe, expect, it } from "vitest";
import { validateSpecOutput } from "@/server/ai/validate-output";
import { SpecWriterError, type CurrentItem, type CurrentQuestion, type WriterOutput } from "@/server/ai/spec-writer";

const current = {
  items: [
    { key: "k1", kind: "DECISION", text: "기존 결정", sourceInputIds: ["old1"] },
  ] as CurrentItem[],
  questions: [
    { key: "q1", text: "열린 질문", status: "OPEN", sourceInputIds: ["old1"], resolvedByInputId: null },
    { key: "q2", text: "해소된 질문", status: "RESOLVED", sourceInputIds: ["old1"], resolvedByInputId: "old1" },
  ] as CurrentQuestion[],
};
const batch = new Set(["new1"]);
const approved = new Set(["old1", "new1"]);

const base = (): WriterOutput => ({
  items: [{ key: "k1", kind: "DECISION", text: "기존 결정", sourceInputIds: ["old1"] }],
  questions: [
    { key: "q1", text: "열린 질문", status: "OPEN", sourceInputIds: ["old1"], resolvedByInputId: null },
    { key: "q2", text: "해소된 질문", status: "RESOLVED", sourceInputIds: ["old1"], resolvedByInputId: "old1" },
  ],
});

const run = (o: WriterOutput) => validateSpecOutput(current, batch, approved, o);
const rejects = (o: WriterOutput) =>
  expect(() => run(o)).toThrowError(expect.objectContaining({ code: "INVALID_OUTPUT" }));

describe("validateSpecOutput", () => {
  it("변화 없는 출력은 허용한다 (기존 출처만으로)", () => {
    expect(run(base()).items[0].key).toBe("k1");
  });

  it("출처 없는 항목을 거부한다", () => {
    const o = base();
    o.items.push({ key: null, kind: "REQUIREMENT", text: "출처 없음", sourceInputIds: [] });
    rejects(o);
  });

  it("이 feature의 승인된 입력이 아닌 출처 id를 거부한다", () => {
    const o = base();
    o.items.push({ key: null, kind: "REQUIREMENT", text: "x", sourceInputIds: ["pending-or-foreign"] });
    rejects(o);
  });

  it("새 항목이 이번 반영 입력을 인용하지 않으면 거부한다", () => {
    const o = base();
    o.items.push({ key: null, kind: "REQUIREMENT", text: "새 항목", sourceInputIds: ["old1"] });
    rejects(o);
  });

  it("새 항목이 이번 반영 입력을 인용하면 허용하고 key를 부여한다", () => {
    const o = base();
    o.items.push({ key: null, kind: "REQUIREMENT", text: "새 항목", sourceInputIds: ["new1"] });
    const out = run(o);
    expect(out.items[1].key).toMatch(/.+/);
    expect(out.items[1].key).not.toBe("k1");
  });

  it("문구가 바뀐 기존 항목이 이번 입력을 인용하지 않으면 거부하고, 인용하면 허용한다", () => {
    const bad = base();
    bad.items[0] = { ...bad.items[0], text: "바뀐 결정" };
    rejects(bad);
    const ok = base();
    ok.items[0] = { key: "k1", kind: "DECISION", text: "바뀐 결정", sourceInputIds: ["old1", "new1"] };
    expect(run(ok).items[0].text).toBe("바뀐 결정");
  });

  it("알 수 없는 key와 중복 key를 거부한다", () => {
    const unknown = base();
    unknown.items.push({ key: "ghost", kind: "DECISION", text: "x", sourceInputIds: ["new1"] });
    rejects(unknown);
    const dup = base();
    dup.items.push({ key: "k1", kind: "DECISION", text: "기존 결정", sourceInputIds: ["old1"] });
    rejects(dup);
  });

  it("질문 해소는 이번 반영 입력이 resolvedByInputId일 때만 허용한다", () => {
    const missing = base();
    missing.questions[0] = { key: "q1", text: "열린 질문", status: "RESOLVED", sourceInputIds: ["old1", "new1"], resolvedByInputId: null };
    rejects(missing);
    const notBatch = base();
    notBatch.questions[0] = { key: "q1", text: "열린 질문", status: "RESOLVED", sourceInputIds: ["old1"], resolvedByInputId: "old1" };
    rejects(notBatch);
    const ok = base();
    ok.questions[0] = { key: "q1", text: "열린 질문", status: "RESOLVED", sourceInputIds: ["old1", "new1"], resolvedByInputId: "new1" };
    expect(run(ok).questions[0].status).toBe("RESOLVED");
  });

  it("이미 해소된 질문을 다시 열 수 없다", () => {
    const o = base();
    o.questions[1] = { key: "q2", text: "해소된 질문", status: "OPEN", sourceInputIds: ["old1"], resolvedByInputId: null };
    rejects(o);
  });

  it("새 질문은 이번 반영 입력을 인용해야 한다", () => {
    const bad = base();
    bad.questions.push({ key: null, text: "새 질문", status: "OPEN", sourceInputIds: ["old1"], resolvedByInputId: null });
    rejects(bad);
    const ok = base();
    ok.questions.push({ key: null, text: "새 질문", status: "OPEN", sourceInputIds: ["new1"], resolvedByInputId: null });
    expect(run(ok).questions).toHaveLength(3);
  });

  it("항목 2,000자·질문 1,000자 초과를 거부한다", () => {
    const item = base();
    item.items.push({ key: null, kind: "DECISION", text: "a".repeat(2001), sourceInputIds: ["new1"] });
    rejects(item);
    const q = base();
    q.questions.push({ key: null, text: "a".repeat(1001), status: "OPEN", sourceInputIds: ["new1"], resolvedByInputId: null });
    rejects(q);
  });

  it("SpecWriterError를 던진다", () => {
    const o = base();
    o.items[0].sourceInputIds = [];
    expect(() => run(o)).toThrow(SpecWriterError);
  });
});
