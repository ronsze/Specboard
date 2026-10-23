export type ConflictItem = {
  key: string;
  label: string;
  kind: "DECISION" | "REQUIREMENT";
  text: string;
  /** 비교 시점의 spec이 확정 상태인가 */
  finalized: boolean;
};

export type ConflictRequest = {
  input: { kind: "MEETING_NOTE" | "IDEA" | "OPINION"; content: string };
  /** 비교 대상: spec 최신 버전의 항목 전체 */
  items: ConflictItem[];
  /** 열려 있는 미결 질문. 이 질문에 답하는 입력은 충돌이 아니다 */
  openQuestions: { key: string; label: string; text: string }[];
};

/** 모델이 제시하는 경고 후보. 서버가 검증해 통과한 것만 저장한다 */
export type ConflictCandidate = {
  itemKey: string;
  reason: string;
  /** 입력 원문에서 글자 그대로 복사한 근거 문장 (선택) */
  quote?: string | null;
};

export type ConflictErrorCode = "REFUSED" | "INVALID_OUTPUT" | "API_ERROR" | "TIMEOUT" | "TOO_LARGE";

export class ConflictDetectorError extends Error {
  constructor(
    readonly code: ConflictErrorCode,
    message: string,
  ) {
    super(message);
  }
}

/** 입력과 기존 spec 항목의 충돌 가능성을 찾는 AI. 구현은 Claude, 테스트는 결정적인 가짜. */
export interface ConflictDetector {
  readonly modelName: string;
  detect(request: ConflictRequest): Promise<ConflictCandidate[]>;
}

/** 비교 대상 상한 (초과하면 AI 호출 없이 TOO_LARGE로 실패 처리) */
export const MAX_COMPARE_ITEMS = 300;
export const MAX_COMPARE_CHARS = 150_000;
export const MAX_WARNINGS_PER_CHECK = 5;
export const MAX_REASON_LENGTH = 200;
