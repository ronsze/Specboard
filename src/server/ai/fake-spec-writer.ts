import {
  SpecWriterError,
  type SpecWriter,
  type SpecWriterErrorCode,
  type WriterOutput,
  type WriterRequest,
} from "@/server/ai/spec-writer";

export type FakeOptions = {
  /** 호출 시 이 오류를 던진다 */
  failWith?: SpecWriterErrorCode;
  /** 남은 횟수만큼만 실패한다 (undefined면 계속 실패) */
  failTimes?: number;
  /** 출처 없는 항목을 섞어 검증 실패를 유도한다 */
  invalidOutput?: boolean;
  /** 원문에 없는 발췌를 제시한다 (서버가 버리는지 확인용) */
  badQuotes?: boolean;
  /** 모델 호출 도중에 실행할 훅 (되돌리기·확정 중간 개입 시나리오) */
  duringCall?: () => Promise<void>;
};

/**
 * 결정적인 가짜 AI.
 * - 입력 본문이 "?"로 끝나면 미결 질문만 만든다 (항목을 지어내지 않음).
 * - "답:"으로 시작하면 열린 질문을 모두 해소하고 그 내용을 항목으로 추가한다.
 * - 그 외에는 본문을 그대로 요구사항 항목 하나로 추가한다.
 * - 출처마다 본문의 첫 문장을 발췌로 제시한다(badQuotes면 원문에 없는 문장).
 */
const firstSentence = (content: string) => {
  const m = content.trim().match(/^[^.?!\n]*[.?!]?/);
  return (m?.[0] ?? content).trim().slice(0, 200);
};
export class FakeSpecWriter implements SpecWriter {
  readonly modelName = "fake";
  calls: WriterRequest[] = [];
  private remainingFailures: number | undefined;

  constructor(private readonly options: FakeOptions = {}) {
    this.remainingFailures = options.failTimes;
  }

  async write(request: WriterRequest): Promise<WriterOutput> {
    this.calls.push(request);
    await this.options.duringCall?.();

    if (this.options.failWith && (this.remainingFailures === undefined || this.remainingFailures > 0)) {
      if (this.remainingFailures !== undefined) this.remainingFailures -= 1;
      throw new SpecWriterError(this.options.failWith, "fake failure");
    }

    const out: WriterOutput = {
      items: request.items.map((i) => ({ key: i.key, kind: i.kind, text: i.text, sourceInputIds: [...i.sourceInputIds] })),
      questions: request.questions.map((q) => ({
        key: q.key,
        text: q.text,
        status: q.status,
        sourceInputIds: [...q.sourceInputIds],
        resolvedByInputId: q.resolvedByInputId,
      })),
    };

    const quoteOf = (input: { id: string; content: string }) => ({
      inputId: input.id,
      quote: this.options.badQuotes ? "원문에 전혀 없는 지어낸 문장입니다." : firstSentence(input.content),
    });
    for (const input of request.inputs) {
      const text = input.content.trim().slice(0, 2000);
      if (text.endsWith("?")) {
        out.questions.push({ key: null, text, status: "OPEN", sourceInputIds: [input.id], resolvedByInputId: null, quotes: [quoteOf(input)] });
      } else if (text.startsWith("답:")) {
        for (const q of out.questions) {
          if (q.status === "OPEN") {
            q.status = "RESOLVED";
            q.resolvedByInputId = input.id;
            q.sourceInputIds = [...q.sourceInputIds, input.id];
          }
        }
        out.items.push({ key: null, kind: "DECISION", text, sourceInputIds: [input.id], quotes: [quoteOf(input)] });
      } else {
        out.items.push({ key: null, kind: "REQUIREMENT", text, sourceInputIds: [input.id], quotes: [quoteOf(input)] });
      }
    }

    if (this.options.invalidOutput) {
      out.items.push({ key: null, kind: "REQUIREMENT", text: "출처 없는 지어낸 항목", sourceInputIds: [] });
    }
    return out;
  }
}
