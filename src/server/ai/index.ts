import type { SpecWriter } from "@/server/ai/spec-writer";
import { ClaudeSpecWriter } from "@/server/ai/claude-spec-writer";
import { FakeSpecWriter } from "@/server/ai/fake-spec-writer";

let override: SpecWriter | null = null;

/** 테스트에서 AI 구현을 교체한다. */
export function setSpecWriterForTests(writer: SpecWriter | null) {
  override = writer;
}

/** SPEC_WRITER=fake 이면 결정적인 가짜(키 없이 로컬·E2E 확인용), 아니면 Claude. */
export function getSpecWriter(): SpecWriter {
  if (override) return override;
  if (process.env.SPEC_WRITER === "fake") return new FakeSpecWriter();
  return new ClaudeSpecWriter();
}
