import { describe, expect, it } from "vitest";
import { inputLabel, itemLabel, questionLabel } from "@/lib/labels";

describe("labels", () => {
  it("입력·항목·질문 번호를 시안 형식으로 표시한다", () => {
    expect(inputLabel(7)).toBe("IN-7");
    expect(itemLabel("DECISION", 1)).toBe("D-1");
    expect(itemLabel("REQUIREMENT", 12)).toBe("R-12");
    expect(questionLabel(3)).toBe("Q-3");
  });
});
