import { inputLabel } from "@/lib/labels";
import type { InputRef, ItemView, QuestionView, SourceRef, VersionDetail } from "@/server/services/spec-view";

export type Change = {
  change: "ADDED" | "REMOVED" | "CHANGED";
  scope: "ITEM" | "QUESTION";
  key: string;
  label: string;
  kind: "DECISION" | "REQUIREMENT" | null;
  before: string | null;
  after: string | null;
  /** 이 변경에서 새로 붙은 출처 (to에만 있는 입력) */
  addedSources: InputRef[];
};

export type Unchanged = { scope: "ITEM" | "QUESTION"; key: string; label: string; kind: "DECISION" | "REQUIREMENT" | null; text: string };

export type Diff = {
  from: number;
  to: number;
  summary: { added: number; removed: number; changed: number; unchanged: number };
  items: Change[];
  questions: Change[];
  /** "변경 없는 항목도 보기"용 */
  unchanged: Unchanged[];
};

type Entry = {
  key: string;
  label: string;
  kind: "DECISION" | "REQUIREMENT" | null;
  text: string;
  sources: SourceRef[];
};

const toRef = (s: SourceRef): InputRef => ({ id: s.inputId, number: s.number, label: inputLabel(s.number) });

const itemEntries = (v: VersionDetail): Entry[] =>
  v.items.map((i: ItemView) => ({ key: i.key, label: i.label, kind: i.kind, text: i.text, sources: i.sources }));
const questionEntries = (v: VersionDetail): Entry[] =>
  v.questions.map((q: QuestionView) => ({
    key: q.key,
    label: q.label,
    kind: null,
    text: `${q.text} (${q.status === "OPEN" ? "열림" : "해소"})`,
    // 해소한 입력이 이미 출처에 들어 있으면 중복해서 세지 않는다
    sources: [...q.sources, ...(q.resolvedBy ? [q.resolvedBy] : [])].filter((s, i, all) => all.findIndex((x) => x.inputId === s.inputId) === i),
  }));

function diffEntries(scope: Change["scope"], from: Entry[], to: Entry[]): { changes: Change[]; unchanged: Unchanged[] } {
  const before = new Map(from.map((e) => [e.key, e]));
  const after = new Map(to.map((e) => [e.key, e]));
  const changes: Change[] = [];
  const unchanged: Unchanged[] = [];

  for (const e of to) {
    const prev = before.get(e.key);
    if (!prev) {
      changes.push({ change: "ADDED", scope, key: e.key, label: e.label, kind: e.kind, before: null, after: e.text, addedSources: e.sources.map(toRef) });
      continue;
    }
    const known = new Set(prev.sources.map((s) => s.inputId));
    const addedSources = e.sources.filter((s) => !known.has(s.inputId)).map(toRef);
    if (prev.text !== e.text || addedSources.length > 0) {
      changes.push({ change: "CHANGED", scope, key: e.key, label: e.label, kind: e.kind, before: prev.text, after: e.text, addedSources });
    } else {
      unchanged.push({ scope, key: e.key, label: e.label, kind: e.kind, text: e.text });
    }
  }
  for (const e of from) {
    if (!after.has(e.key)) {
      changes.push({ change: "REMOVED", scope, key: e.key, label: e.label, kind: e.kind, before: e.text, after: null, addedSources: [] });
    }
  }
  return { changes, unchanged };
}

/** 두 버전을 항목·질문 key로 대응시켜 추가·삭제·변경을 분류한다. 표시 순서 변화는 변경으로 보지 않는다. */
export function diffVersions(from: VersionDetail, to: VersionDetail): Diff {
  const items = diffEntries("ITEM", itemEntries(from), itemEntries(to));
  const questions = diffEntries("QUESTION", questionEntries(from), questionEntries(to));
  const all = [...items.changes, ...questions.changes];
  return {
    from: from.number,
    to: to.number,
    summary: {
      added: all.filter((c) => c.change === "ADDED").length,
      removed: all.filter((c) => c.change === "REMOVED").length,
      changed: all.filter((c) => c.change === "CHANGED").length,
      unchanged: items.unchanged.length + questions.unchanged.length,
    },
    items: items.changes,
    questions: questions.changes,
    unchanged: [...items.unchanged, ...questions.unchanged],
  };
}
