import type { VersionDetail } from "@/server/services/spec-view";

export type Change = {
  change: "ADDED" | "REMOVED" | "CHANGED";
  key: string;
  before: string | null;
  after: string | null;
};

export type Diff = { from: number; to: number; items: Change[]; questions: Change[] };

function diffByKey(from: Map<string, string>, to: Map<string, string>): Change[] {
  const changes: Change[] = [];
  for (const [key, after] of to) {
    const before = from.get(key);
    if (before === undefined) changes.push({ change: "ADDED", key, before: null, after });
    else if (before !== after) changes.push({ change: "CHANGED", key, before, after });
  }
  for (const [key, before] of from) {
    if (!to.has(key)) changes.push({ change: "REMOVED", key, before, after: null });
  }
  return changes;
}

const itemMap = (v: VersionDetail) => new Map(v.items.map((i) => [i.key, i.text]));
const questionMap = (v: VersionDetail) =>
  new Map(v.questions.map((q) => [q.key, `${q.text} (${q.status === "OPEN" ? "열림" : "해소"})`]));

/** 두 버전을 항목·질문 key로 대응시켜 추가·삭제·변경을 분류한다. 표시 순서 변화는 변경으로 보지 않는다. */
export function diffVersions(from: VersionDetail, to: VersionDetail): Diff {
  return {
    from: from.number,
    to: to.number,
    items: diffByKey(itemMap(from), itemMap(to)),
    questions: diffByKey(questionMap(from), questionMap(to)),
  };
}
