import { describe, expect, it } from "vitest";
import { locateQuote } from "@/server/services/quotes";

const slice = (content: string, r: { start: number; end: number } | null) => (r ? content.slice(r.start, r.end) : null);

describe("locateQuote", () => {
  const content = "참석: 김지현.\n쿠폰 중복 적용은 정산 이슈가 커서 주문당 1장으로 제한하기로 함.\n다음 안건은 QA.";

  it("정확히 일치하는 문장의 구간을 돌려준다", () => {
    const r = locateQuote(content, "쿠폰 중복 적용은 정산 이슈가 커서 주문당 1장으로 제한하기로 함.");
    expect(slice(content, r)).toBe("쿠폰 중복 적용은 정산 이슈가 커서 주문당 1장으로 제한하기로 함.");
  });

  it("공백·줄바꿈만 다르면 일치로 보고 원문의 실제 표기를 돌려준다", () => {
    const text = "쿠폰은  한 장만\n적용한다.";
    const r = locateQuote(`머리말 ${text} 꼬리말`, "쿠폰은 한 장만 적용한다.");
    expect(slice(`머리말 ${text} 꼬리말`, r)).toBe(text);
  });

  it("원문에 없으면 null", () => {
    expect(locateQuote(content, "원문에 없는 문장입니다.")).toBeNull();
    expect(locateQuote(content, "쿠폰 중복 적용은 정산 이슈가 커서 주문당 2장으로 제한하기로 함.")).toBeNull();
  });

  it("빈 문자열·공백뿐인 문자열이면 null", () => {
    expect(locateQuote(content, "")).toBeNull();
    expect(locateQuote(content, "   \n ")).toBeNull();
  });

  it("500자를 넘으면 null", () => {
    const long = "가".repeat(501);
    expect(locateQuote(long, long)).toBeNull();
    const ok = "가".repeat(500);
    expect(locateQuote(ok, ok)).toEqual({ start: 0, end: 500 });
  });

  it("여러 번 나오면 첫 번째 위치", () => {
    const text = "같은 문장. 다른 말. 같은 문장.";
    const r = locateQuote(text, "같은 문장.");
    expect(r).toEqual({ start: 0, end: 6 });
  });

  it("정규식 특수문자가 들어 있어도 안전하게 찾는다", () => {
    const text = "가격은 (1+1)*2 = 4 [원] 이다? 맞다.";
    const r = locateQuote(text, "(1+1)*2 = 4 [원]");
    expect(slice(text, r)).toBe("(1+1)*2 = 4 [원]");
  });

  it("범위는 항상 0 ≤ start < end ≤ 길이", () => {
    const r = locateQuote(content, "다음 안건은 QA.")!;
    expect(r.start).toBeGreaterThanOrEqual(0);
    expect(r.end).toBeGreaterThan(r.start);
    expect(r.end).toBeLessThanOrEqual(content.length);
  });
});
