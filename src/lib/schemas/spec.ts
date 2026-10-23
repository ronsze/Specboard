import { z } from "zod";

export const MAX_ITEM_TEXT = 2_000;
export const MAX_QUESTION_TEXT = 1_000;

const sourceIds = z.array(z.string().min(1)).min(1, "출처 입력이 하나 이상 필요합니다.");

export const writerItemSchema = z.object({
  key: z.string().nullable(),
  kind: z.enum(["DECISION", "REQUIREMENT"]),
  text: z
    .string()
    .refine((v) => v.trim().length >= 1, "항목 내용이 비어 있습니다.")
    .refine((v) => v.length <= MAX_ITEM_TEXT, `항목은 ${MAX_ITEM_TEXT}자 이하여야 합니다.`),
  sourceInputIds: sourceIds,
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
});

export const writerOutputSchema = z.object({
  items: z.array(writerItemSchema),
  questions: z.array(writerQuestionSchema),
});

export const revertSchema = z.object({ toVersion: z.number().int().min(1) });
