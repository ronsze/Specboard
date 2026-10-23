export const MAX_QUOTE_LENGTH = 500;

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * AI가 제시한 발췌가 입력 원문에 실제로 있는지 확인하고, 있으면 원문에서의 구간을 돌려준다.
 * - 공백·줄바꿈 차이는 무시한다(구간은 원문의 실제 표기 기준).
 * - 여러 번 나오면 첫 번째 위치, 비어 있거나 500자를 넘으면 null.
 * 원문에 없는 문장은 절대 인정하지 않는다(퍼지 매칭 없음).
 */
export function locateQuote(content: string, quote: string): { start: number; end: number } | null {
  const words = quote.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  const match = new RegExp(words.map(escapeRegExp).join("\\s+")).exec(content);
  if (!match) return null;
  const start = match.index;
  const end = start + match[0].length;
  if (end <= start || end - start > MAX_QUOTE_LENGTH) return null;
  return { start, end };
}
