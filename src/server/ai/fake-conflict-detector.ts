import {
  ConflictDetectorError,
  type ConflictCandidate,
  type ConflictDetector,
  type ConflictErrorCode,
  type ConflictRequest,
} from "@/server/ai/conflict-detector";

export type FakeConflictOptions = {
  failWith?: ConflictErrorCode;
  /** 남은 횟수만큼만 실패한다 (undefined면 계속 실패) */
  failTimes?: number;
  /** 존재하지 않는 항목 key의 경고를 섞는다 */
  ghostKey?: boolean;
  /** 원문에 없는 발췌를 제시한다 */
  badQuote?: boolean;
  /** 같은 항목 중복과 6개 이상의 경고를 만든다 */
  flood?: boolean;
  /** 모델 호출 도중에 실행할 훅 (되돌리기·확정 중간 개입 시나리오) */
  duringCall?: () => Promise<void>;
};

const NEGATIVE = /안 된다|불가|금지|하지 않|허용하지|제한|두 장|여러 장|하면 안/;

const firstSentence = (content: string) => {
  const m = content.trim().match(/^[^.?!\n]*[.?!]?/);
  return (m?.[0] ?? content).trim().slice(0, 200);
};

/** 두 문자열이 공유하는 2글자 이상 한글/영문 어절이 있는가 */
const shareWord = (a: string, b: string) => {
  const words = (s: string) => new Set(s.split(/[^0-9A-Za-z가-힣]+/).filter((w) => w.length >= 2).map((w) => w.slice(0, 2)));
  const wa = words(a);
  return [...words(b)].some((w) => wa.has(w));
};

/**
 * 결정적인 가짜 검사기: 입력에 부정·제한 표식이 있고 항목 문구와 어절이 겹치면 그 항목을 경고 후보로 낸다.
 * 열려 있는 미결 질문에 답하는 입력("답:"으로 시작)은 충돌로 보지 않는다.
 */
export class FakeConflictDetector implements ConflictDetector {
  readonly modelName = "fake";
  calls: ConflictRequest[] = [];
  private remainingFailures: number | undefined;

  constructor(private readonly options: FakeConflictOptions = {}) {
    this.remainingFailures = options.failTimes;
  }

  async detect(request: ConflictRequest): Promise<ConflictCandidate[]> {
    this.calls.push(request);
    await this.options.duringCall?.();

    if (this.options.failWith && (this.remainingFailures === undefined || this.remainingFailures > 0)) {
      if (this.remainingFailures !== undefined) this.remainingFailures -= 1;
      throw new ConflictDetectorError(this.options.failWith, "fake failure");
    }

    const content = request.input.content;
    const quote = this.options.badQuote ? "원문에 전혀 없는 지어낸 문장입니다." : firstSentence(content);
    const out: ConflictCandidate[] = [];

    const answersQuestion = content.trim().startsWith("답:") && request.openQuestions.length > 0;
    if (!answersQuestion && NEGATIVE.test(content)) {
      for (const item of request.items) {
        if (shareWord(content, item.text)) out.push({ itemKey: item.key, reason: `${item.label}과(와) 어긋날 수 있습니다.`, quote });
      }
    }

    if (this.options.ghostKey) out.push({ itemKey: "ghost-key", reason: "존재하지 않는 항목", quote });
    if (this.options.flood && request.items.length > 0) {
      for (let i = 0; i < 8; i++) {
        const item = request.items[i % request.items.length];
        out.push({ itemKey: item.key, reason: `중복 ${i}`, quote });
      }
    }
    return out;
  }
}
