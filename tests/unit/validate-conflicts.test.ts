import { describe, expect, it } from "vitest";
import { validateConflicts } from "@/server/ai/validate-conflicts";

const items = [
  { key: "k1", kind: "DECISION" as const, number: 1, text: "쿠폰은 주문 한 건에 한 장만 적용한다." },
  { key: "k2", kind: "REQUIREMENT" as const, number: 2, text: "환불은 7일 이내" },
];
const content = "쿠폰은 두 장까지 중복 적용을 허용하자. 그리고 환불은 14일로 늘리자.";

describe("validateConflicts", () => {
  it("저장 시점의 최신 버전에 없는 key의 경고는 폐기한다 (SC-003)", () => {
    const out = validateConflicts([{ itemKey: "ghost", reason: "x" }, { itemKey: "k1", reason: "r" }], items, content);
    expect(out.map((w) => w.itemKey)).toEqual(["k1"]);
  });

  it("항목의 번호·종류·문구 스냅샷을 채운다", () => {
    const [w] = validateConflicts([{ itemKey: "k2", reason: "환불 기간이 다르다" }], items, content);
    expect(w).toMatchObject({ itemKey: "k2", itemKind: "REQUIREMENT", itemNumber: 2, itemText: "환불은 7일 이내" });
  });

  it("같은 항목의 경고는 먼저 나온 것만 유지한다", () => {
    const out = validateConflicts(
      [{ itemKey: "k1", reason: "첫째" }, { itemKey: "k1", reason: "둘째" }],
      items,
      content,
    );
    expect(out).toHaveLength(1);
    expect(out[0].reason).toBe("첫째");
  });

  it("입력당 최대 5개까지만 남긴다", () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ key: `k${i}`, kind: "REQUIREMENT" as const, number: i + 1, text: `항목 ${i}` }));
    const out = validateConflicts(many.map((m) => ({ itemKey: m.key, reason: "r" })), many, content);
    expect(out).toHaveLength(5);
    expect(out.map((w) => w.itemKey)).toEqual(["k0", "k1", "k2", "k3", "k4"]);
  });

  it("이유는 첫 줄만 쓰고 200자로 자르며, 비어 있으면 그 경고를 버린다", () => {
    const out = validateConflicts(
      [
        { itemKey: "k1", reason: "첫 줄 이유\n둘째 줄 설명" },
        { itemKey: "k2", reason: "   \n  " },
      ],
      items,
      content,
    );
    expect(out.map((w) => w.itemKey)).toEqual(["k1"]);
    expect(out[0].reason).toBe("첫 줄 이유");
    const long = validateConflicts([{ itemKey: "k1", reason: "가".repeat(300) }], items, content);
    expect(long[0].reason).toHaveLength(200);
  });

  it("발췌가 원문에 있으면 구간으로, 없으면 null로 저장하고 경고는 유지한다 (SC-004)", () => {
    const [ok] = validateConflicts([{ itemKey: "k1", reason: "r", quote: "쿠폰은 두 장까지 중복 적용을 허용하자." }], items, content);
    expect(content.slice(ok.quoteStart!, ok.quoteEnd!)).toBe("쿠폰은 두 장까지 중복 적용을 허용하자.");
    const [bad] = validateConflicts([{ itemKey: "k1", reason: "r", quote: "원문에 없는 문장" }], items, content);
    expect(bad).toMatchObject({ itemKey: "k1", quoteStart: null, quoteEnd: null });
    const [none] = validateConflicts([{ itemKey: "k1", reason: "r" }], items, content);
    expect(none.quoteStart).toBeNull();
  });

  it("공백·줄바꿈만 다른 발췌는 일치로 본다", () => {
    const text = "쿠폰은  두 장까지\n허용하자.";
    const [w] = validateConflicts([{ itemKey: "k1", reason: "r", quote: "쿠폰은 두 장까지 허용하자." }], items, text);
    expect(text.slice(w.quoteStart!, w.quoteEnd!)).toBe(text);
  });

  it("후보가 없으면 빈 배열", () => {
    expect(validateConflicts([], items, content)).toEqual([]);
  });
});
