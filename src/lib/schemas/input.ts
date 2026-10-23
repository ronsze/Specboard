import { z } from "zod";

export const MAX_INPUT_LENGTH = 50_000;

export const inputCreateSchema = z.object({
  kind: z.enum(["MEETING_NOTE", "IDEA", "OPINION"]),
  content: z
    .string()
    .refine((v) => v.trim().length >= 1, "내용을 입력해 주세요.")
    .refine((v) => v.length <= MAX_INPUT_LENGTH, `내용은 ${MAX_INPUT_LENGTH.toLocaleString()}자 이하여야 합니다.`),
});

export type InputCreate = z.infer<typeof inputCreateSchema>;

export const inputRejectSchema = z.object({
  reason: z.string().refine((v) => v.trim().length >= 1, "반려 사유를 입력해 주세요."),
});

export const inputStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED"]);
