export type ItemProvenance = {
  firstVersion: number;
  lastChangedVersion: number;
  /** 최신 버전 기준: 이번에 새로 생김 / 이번에 문구가 바뀜 / 변화 없음 */
  change: "NONE" | "ADDED" | "CHANGED";
};

export type QuestionProvenance = { resolvedInVersion: number | null };

type ItemRow = { key: string; text: string; versionNumber: number };
type QuestionRow = { key: string; status: "OPEN" | "RESOLVED"; versionNumber: number };

const byVersion = <T extends { versionNumber: number }>(rows: T[]) => [...rows].sort((a, b) => a.versionNumber - b.versionNumber);

function groupByKey<T extends { key: string }>(rows: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) groups.set(row.key, [...(groups.get(row.key) ?? []), row]);
  return groups;
}

/**
 * spec의 전 버전 항목·질문 행에서 변경 버전을 계산한다 (저장하지 않는 조회 전용 계산).
 * - firstVersion: key가 처음 나타난 버전
 * - lastChangedVersion: 직전 버전에 key가 없었거나(되돌리기로 복원) 문구가 달라진 가장 최근 버전
 * - resolvedInVersion: 질문이 현재의 RESOLVED 상태가 시작된 버전 (열린 질문은 null)
 */
export function computeProvenance(
  itemRows: ItemRow[],
  questionRows: QuestionRow[],
  latestVersion: number,
): { items: Map<string, ItemProvenance>; questions: Map<string, QuestionProvenance> } {
  const items = new Map<string, ItemProvenance>();
  for (const [key, rows] of groupByKey(itemRows)) {
    const ordered = byVersion(rows);
    let lastChanged = ordered[0].versionNumber;
    for (let i = 1; i < ordered.length; i++) {
      const prev = ordered[i - 1];
      const cur = ordered[i];
      const reappeared = cur.versionNumber !== prev.versionNumber + 1;
      if (reappeared || cur.text.trim() !== prev.text.trim()) lastChanged = cur.versionNumber;
    }
    const first = ordered[0].versionNumber;
    const inLatest = ordered[ordered.length - 1].versionNumber === latestVersion;
    const change = !inLatest || lastChanged !== latestVersion ? "NONE" : first === latestVersion ? "ADDED" : "CHANGED";
    items.set(key, { firstVersion: first, lastChangedVersion: lastChanged, change });
  }

  const questions = new Map<string, QuestionProvenance>();
  for (const [key, rows] of groupByKey(questionRows)) {
    const ordered = byVersion(rows);
    const last = ordered[ordered.length - 1];
    let resolvedIn: number | null = null;
    if (last.status === "RESOLVED") {
      // 현재의 RESOLVED 구간이 시작된 버전: 뒤에서부터 연속된 RESOLVED의 첫 버전
      for (let i = ordered.length - 1; i >= 0 && ordered[i].status === "RESOLVED"; i--) resolvedIn = ordered[i].versionNumber;
    }
    questions.set(key, { resolvedInVersion: resolvedIn });
  }
  return { items, questions };
}
