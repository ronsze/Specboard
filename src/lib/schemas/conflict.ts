import { z } from "zod";

/** 모델에게 요구하는 출력 형식. 개수·길이 제한은 서버 검증(validateConflicts)에서 적용한다. */
export const conflictCandidateSchema = z.object({
  itemKey: z.string().min(1),
  reason: z.string(),
  quote: z.string().nullable(),
});

export const conflictOutputSchema = z.object({
  warnings: z.array(conflictCandidateSchema),
});
