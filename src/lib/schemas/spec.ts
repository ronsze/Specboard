import { z } from "zod";

export const MAX_ITEM_TEXT = 2_000;
export const MAX_QUESTION_TEXT = 1_000;

const sourceIds = z.array(z.string().min(1)).min(1, "출처 입력이 하나 이상 필요합니다.");

/** AI가 출처마다 제시하는 원문 발췌. 서버가 원문에 실제로 있는지 확인한 것만 저장한다(FR-032). */
export const quoteSchema = z.object({ inputId: z.string().min(1), quote: z.string() });

export const writerItemSchema = z.object({
  key: z.string().nullable(),
  kind: z.enum(["DECISION", "REQUIREMENT"]),
  text: z
    .string()
    .refine((v) => v.trim().length >= 1, "항목 내용이 비어 있습니다.")
    .refine((v) => v.length <= MAX_ITEM_TEXT, `항목은 ${MAX_ITEM_TEXT}자 이하여야 합니다.`),
  sourceInputIds: sourceIds,
  quotes: z.array(quoteSchema).default([]),
});

export const writerQuestionSchema = z.object({
  key: z.string().nullable(),
  text: z
    .string()
    .refine((v) => v.trim().length >= 1, "질문 내용이 비어 있습니다.")
    .refine((v) => v.length <= MAX_QUESTION_TEXT, `질문은 ${MAX_QUESTION_TEXT}자 이하여야 합니다.`),
  status: z.enum(["OPEN", "RESOLVED"]),
  sourceInputIds: sourceIds,
  resolvedByInputId: z.string().nullable(),
  quotes: z.array(quoteSchema).default([]),
});

export const writerOutputSchema = z.object({
  items: z.array(writerItemSchema),
  questions: z.array(writerQuestionSchema),
});

export const revertSchema = z.object({ toVersion: z.number().int().min(1) });

export const revertExpectedSchema = z.object({
  latestVersion: z.number().int().min(1),
  removedItems: z.number().int().min(0),
  reopenedQuestions: z.number().int().min(0),
});

/**
 * 모델에게 요구하는 출력 형식(구조화 출력). 발췌 배열은 필수로 두되 비어 있어도 된다.
 * 서버 쪽 writerOutputSchema는 발췌를 생략한 출력(가짜 AI, 과거 형식)도 받아들인다.
 */
export const modelOutputSchema = z.object({
  items: z.array(writerItemSchema.extend({ quotes: z.array(quoteSchema) })),
  questions: z.array(writerQuestionSchema.extend({ quotes: z.array(quoteSchema) })),
});
