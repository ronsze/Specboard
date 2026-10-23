import { locateQuote } from "@/server/services/quotes";
import { MAX_REASON_LENGTH, MAX_WARNINGS_PER_CHECK, type ConflictCandidate } from "@/server/ai/conflict-detector";

export type LatestItem = { key: string; kind: "DECISION" | "REQUIREMENT"; number: number; text: string };

export type ValidatedWarning = {
  itemKey: string;
  itemKind: "DECISION" | "REQUIREMENT";
  itemNumber: number;
  itemText: string;
  reason: string;
  quoteStart: number | null;
  quoteEnd: number | null;
};

/**
 * 모델이 낸 경고 후보를 저장 전에 검증한다 (constitution 원칙 I, II).
 * - 저장 시점의 최신 버전에 존재하는 항목만 (SC-003)
 * - 항목당 1개(먼저 나온 것), 입력당 최대 5개
 * - 이유는 첫 줄만, 200자 이하, 비어 있으면 버림
 * - 발췌는 원문에 실제로 있는 것만 구간으로 저장, 없으면 null(경고는 유지, SC-004)
 */
export function validateConflicts(
  candidates: ConflictCandidate[],
  latestItems: LatestItem[],
  inputContent: string,
): ValidatedWarning[] {
  const byKey = new Map(latestItems.map((i) => [i.key, i]));
  const seen = new Set<string>();
  const out: ValidatedWarning[] = [];
  for (const c of candidates) {
    if (out.length >= MAX_WARNINGS_PER_CHECK) break;
    const item = byKey.get(c.itemKey);
    if (!item || seen.has(c.itemKey)) continue;
    const reason = (c.reason ?? "").split("\n").map((l) => l.trim()).find((l) => l.length > 0)?.slice(0, MAX_REASON_LENGTH);
    if (!reason) continue;
    seen.add(c.itemKey);
    const located = c.quote ? locateQuote(inputContent, c.quote) : null;
    out.push({
      itemKey: item.key,
      itemKind: item.kind,
      itemNumber: item.number,
      itemText: item.text,
      reason,
      quoteStart: located?.start ?? null,
      quoteEnd: located?.end ?? null,
    });
  }
  return out;
}
