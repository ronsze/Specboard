import { describe, expect, it } from "vitest";
import { wordDiff } from "@/lib/word-diff";

const changed = (segs: { text: string; changed: boolean }[]) => segs.filter((s) => s.changed).map((s) => s.text.trim());
const join = (segs: { text: string }[]) => segs.map((s) => s.text).join("");

describe("wordDiff (어절 단위)", () => {
  it("바뀐 어절만 이전·이후에서 각각 표시한다", () => {
    const d = wordDiff(
      "최소 주문 금액에 못 미치면 적용 버튼을 비활성화한다.",
      "최소 주문 금액에 못 미치면 적용 버튼을 숨기지 않고, 부족한 금액을 안내한다.",
    );
    expect(changed(d.before)).toEqual(["비활성화한다."]);
    expect(changed(d.after)).toEqual(["숨기지 않고, 부족한 금액을 안내한다."]);
  });

  it("원문을 그대로 복원할 수 있다 (공백 포함)", () => {
    const before = "쿠폰은  한 장만\n적용한다.";
    const after = "쿠폰은 두 장까지 적용한다.";
    const d = wordDiff(before, after);
    expect(join(d.before)).toBe(before);
    expect(join(d.after)).toBe(after);
  });

  it("변화가 없으면 changed가 없다", () => {
    const d = wordDiff("같은 문장 입니다.", "같은 문장 입니다.");
    expect(d.before.some((s) => s.changed)).toBe(false);
    expect(d.after.some((s) => s.changed)).toBe(false);
  });

  it("전부 다르면 전체가 changed", () => {
    const d = wordDiff("가 나", "다 라");
    expect(changed(d.before)).toEqual(["가 나"]);
    expect(changed(d.after)).toEqual(["다 라"]);
  });

  it("빈 문자열을 처리한다", () => {
    expect(wordDiff("", "새 문장").before).toEqual([]);
    expect(changed(wordDiff("", "새 문장").after)).toEqual(["새 문장"]);
    expect(changed(wordDiff("옛 문장", "").before)).toEqual(["옛 문장"]);
    expect(wordDiff("옛 문장", "").after).toEqual([]);
  });

  it("떨어진 변경은 별도 구간으로 나눈다", () => {
    const d = wordDiff("a b c d e", "a X c d Y");
    expect(changed(d.before)).toEqual(["b", "e"]);
    expect(changed(d.after)).toEqual(["X", "Y"]);
  });
});
