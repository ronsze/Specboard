export type WriterInput = {
  id: string;
  kind: "MEETING_NOTE" | "IDEA" | "OPINION";
  submitterName: string;
  submittedAt: string;
  content: string;
};

export type CurrentItem = {
  key: string;
  kind: "DECISION" | "REQUIREMENT";
  text: string;
  sourceInputIds: string[];
};

export type CurrentQuestion = {
  key: string;
  text: string;
  status: "OPEN" | "RESOLVED";
  sourceInputIds: string[];
  resolvedByInputId: string | null;
};

export type WriterRequest = {
  items: CurrentItem[];
  questions: CurrentQuestion[];
  /** 이번에 반영할 승인된 입력 (승인 순서) */
  inputs: WriterInput[];
};

export type WriterItem = {
  /** 기존 항목이면 그 key, 새 항목이면 null */
  key: string | null;
  kind: "DECISION" | "REQUIREMENT";
  text: string;
  sourceInputIds: string[];
};

export type WriterQuestion = {
  key: string | null;
  text: string;
  status: "OPEN" | "RESOLVED";
  sourceInputIds: string[];
  resolvedByInputId: string | null;
};

export type WriterOutput = { items: WriterItem[]; questions: WriterQuestion[] };

export type SpecWriterErrorCode = "REFUSED" | "INVALID_OUTPUT" | "API_ERROR" | "TIMEOUT";

export class SpecWriterError extends Error {
  constructor(
    readonly code: SpecWriterErrorCode,
    message: string,
  ) {
    super(message);
  }
}

/** spec 작성을 맡는 AI. 구현은 Claude, 테스트는 결정적인 가짜. */
export interface SpecWriter {
  readonly modelName: string;
  write(request: WriterRequest): Promise<WriterOutput>;
}
