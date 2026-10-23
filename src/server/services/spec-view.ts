import type {
  Input,
  OpenQuestion,
  OpenQuestionSource,
  SpecItem,
  SpecItemSource,
  SpecVersion,
  SpecVersionInput,
} from "@prisma/client";
import { inputLabel, itemLabel, questionLabel } from "@/lib/labels";
import type { ItemProvenance, QuestionProvenance } from "@/server/services/spec-provenance";

export type SourceRef = {
  inputId: string;
  /** 입력 번호 (표시는 IN-{number}) */
  number: number;
  kind: Input["kind"];
  submitterName: string;
  submittedAt: string;
  status: Input["status"];
  content: string;
  /** 원문에서 강조할 구간(문자 오프셋). 발췌가 없으면 null */
  quote: { start: number; end: number } | null;
};

export type ItemView = {
  key: string;
  kind: SpecItem["kind"];
  number: number;
  label: string;
  text: string;
  firstVersion: number;
  lastChangedVersion: number;
  change: ItemProvenance["change"];
  sources: SourceRef[];
};

export type QuestionView = {
  key: string;
  number: number;
  label: string;
  text: string;
  status: OpenQuestion["status"];
  resolvedInVersion: number | null;
  sources: SourceRef[];
  resolvedBy: SourceRef | null;
};

export type InputRef = { id: string; number: number; label: string };

export type VersionSummary = {
  number: number;
  kind: SpecVersion["kind"];
  revertedFromNumber: number | null;
  createdByName: string | null;
  createdAt: string;
  inputIds: string[];
  inputs: InputRef[];
  isCurrent: boolean;
};

export type VersionCounts = {
  decisions: number;
  requirements: number;
  openQuestions: number;
  resolvedQuestions: number;
};

export type VersionDetail = VersionSummary & {
  items: ItemView[];
  questions: QuestionView[];
  counts: VersionCounts;
};

export const toSourceRef = (
  i: Input,
  quote?: { quoteStart: number | null; quoteEnd: number | null },
): SourceRef => ({
  inputId: i.id,
  number: i.number,
  kind: i.kind,
  submitterName: i.submitterName,
  submittedAt: i.submittedAt.toISOString(),
  status: i.status,
  content: i.content,
  quote:
    quote && quote.quoteStart !== null && quote.quoteEnd !== null
      ? { start: quote.quoteStart, end: quote.quoteEnd }
      : null,
});

export const summaryInclude = {
  inputs: { include: { input: { select: { id: true, number: true } } } },
} as const;

export type SummaryRow = SpecVersion & {
  inputs: (SpecVersionInput & { input: { id: string; number: number } })[];
};

export function toVersionSummary(v: SummaryRow, isCurrent = false): VersionSummary {
  return {
    number: v.number,
    kind: v.kind,
    revertedFromNumber: v.revertedFromNumber,
    createdByName: v.createdByName,
    createdAt: v.createdAt.toISOString(),
    inputIds: v.inputs.map((i) => i.inputId),
    inputs: v.inputs
      .map((i) => ({ id: i.input.id, number: i.input.number, label: inputLabel(i.input.number) }))
      .sort((a, b) => a.number - b.number),
    isCurrent,
  };
}

export type VersionRow = SummaryRow & {
  items: (SpecItem & { sources: (SpecItemSource & { input: Input })[] })[];
  questions: (OpenQuestion & { sources: (OpenQuestionSource & { input: Input })[]; resolvedBy: Input | null })[];
};

export const versionInclude = {
  ...summaryInclude,
  items: { orderBy: { position: "asc" as const }, include: { sources: { include: { input: true } } } },
  questions: {
    orderBy: { position: "asc" as const },
    include: { sources: { include: { input: true } }, resolvedBy: true },
  },
} as const;

const bySubmittedAt = (a: SourceRef, b: SourceRef) => a.submittedAt.localeCompare(b.submittedAt) || a.number - b.number;

export type Provenance = {
  items: Map<string, ItemProvenance>;
  questions: Map<string, QuestionProvenance>;
};

/** provenance가 없으면(과거 버전 조회) 그 버전에서 처음 보이는 것으로 취급한다. */
export function toVersionDetail(v: VersionRow, provenance?: Provenance, isCurrent = false): VersionDetail {
  const items: ItemView[] = v.items.map((item) => {
    const p = provenance?.items.get(item.key);
    return {
      key: item.key,
      kind: item.kind,
      number: item.number,
      label: itemLabel(item.kind, item.number),
      text: item.text,
      firstVersion: p?.firstVersion ?? v.number,
      lastChangedVersion: p?.lastChangedVersion ?? v.number,
      change: p?.change ?? "NONE",
      sources: item.sources.map((s) => toSourceRef(s.input, s)).sort(bySubmittedAt),
    };
  });
  const questions: QuestionView[] = v.questions.map((q) => ({
    key: q.key,
    number: q.number,
    label: questionLabel(q.number),
    text: q.text,
    status: q.status,
    resolvedInVersion: provenance?.questions.get(q.key)?.resolvedInVersion ?? null,
    sources: q.sources.map((s) => toSourceRef(s.input, s)).sort(bySubmittedAt),
    resolvedBy: q.resolvedBy ? toSourceRef(q.resolvedBy) : null,
  }));
  return {
    ...toVersionSummary(v, isCurrent),
    items,
    questions,
    counts: {
      decisions: items.filter((i) => i.kind === "DECISION").length,
      requirements: items.filter((i) => i.kind === "REQUIREMENT").length,
      openQuestions: questions.filter((q) => q.status === "OPEN").length,
      resolvedQuestions: questions.filter((q) => q.status === "RESOLVED").length,
    },
  };
}
