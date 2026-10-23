export type Segment = { text: string; changed: boolean };

/** 공백을 보존한 채 어절(공백이 아닌 연속 문자열) 단위로 나눈다. 공백 조각도 토큰이다. */
const tokenize = (s: string) => s.match(/\s+|\S+/g) ?? [];
const isSpace = (t: string) => /^\s+$/.test(t);

/** 연속된 같은 상태의 토큰을 한 구간으로 합친다. 두 변경 사이의 공백은 변경에 포함한다. */
function merge(tokens: { text: string; changed: boolean }[]): Segment[] {
  const out: Segment[] = [];
  for (const t of tokens) {
    const last = out[out.length - 1];
    if (last && last.changed === t.changed) last.text += t.text;
    else out.push({ ...t });
  }
  // 변경 구간 사이에 끼인 공백뿐인 "같음" 구간은 하나의 변경 구간으로 이어 붙인다
  const merged: Segment[] = [];
  for (let i = 0; i < out.length; i++) {
    const seg = out[i];
    const prev = merged[merged.length - 1];
    const next = out[i + 1];
    if (!seg.changed && isSpace(seg.text) && prev?.changed && next?.changed) {
      prev.text += seg.text + next.text;
      i++;
    } else if (seg.changed && prev?.changed) {
      prev.text += seg.text;
    } else {
      merged.push({ ...seg });
    }
  }
  return merged;
}

/**
 * 어절 단위 diff. 이전 문장에서는 사라진 어절을, 이후 문장에서는 새로 생긴 어절을 changed로 표시한다.
 * 두 결과를 이어 붙이면 각각 원문과 같다.
 */
export function wordDiff(before: string, after: string): { before: Segment[]; after: Segment[] } {
  const a = tokenize(before);
  const b = tokenize(after);
  // LCS 길이 표 (공백이 아닌 어절만 맞춘다)
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] && !isSpace(a[i]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const left: { text: string; changed: boolean }[] = [];
  const right: { text: string; changed: boolean }[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j] && !isSpace(a[i])) {
      left.push({ text: a[i], changed: false });
      right.push({ text: b[j], changed: false });
      i++;
      j++;
    } else if (j < b.length && (i >= a.length || dp[i][j + 1] >= dp[i + 1][j])) {
      right.push({ text: b[j], changed: !isSpace(b[j]) });
      j++;
    } else {
      left.push({ text: a[i], changed: !isSpace(a[i]) });
      i++;
    }
  }
  return { before: merge(left), after: merge(right) };
}
