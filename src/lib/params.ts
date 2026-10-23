import { ValidationError } from "@/lib/errors";

/** 양의 정수 파라미터만 허용한다. */
export function positiveInt(value: string | null, name: string): number {
  const n = Number(value);
  if (!value || !Number.isInteger(n) || n < 1) throw new ValidationError(`${name}은(는) 1 이상의 정수여야 합니다.`);
  return n;
}
