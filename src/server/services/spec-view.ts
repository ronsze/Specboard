import type {
  Input,
  OpenQuestion,
  OpenQuestionSource,
  SpecItem,
  SpecItemSource,
  SpecVersion,
  SpecVersionInput,
} from "@prisma/client";

export type SourceRef = {
  inputId: string;
  kind: Input["kind"];
  submitterName: string;
  submittedAt: string;
  content: string;
};

export type ItemView = {
  key: string;
  kind: SpecItem["kind"];
  text: string;
  sources: SourceRef[];
};

export type QuestionView = {
  key: string;
  text: string;
  status: OpenQuestion["status"];
  sources: SourceRef[];
  resolvedBy: SourceRef | null;
};

export type VersionSummary = {
  number: number;
  kind: SpecVersion["kind"];
  revertedFromNumber: number | null;
  createdByName: string | null;
  createdAt: string;
  inputIds: string[];
};

export type VersionDetail = VersionSummary & { items: ItemView[]; questions: QuestionView[] };

export const toSourceRef = (i: Input): SourceRef => ({
  inputId: i.id,
  kind: i.kind,
  submitterName: i.submitterName,
  submittedAt: i.submittedAt.toISOString(),
  content: i.content,
});

export type VersionRow = SpecVersion & {
  inputs: SpecVersionInput[];
  items: (SpecItem & { sources: (SpecItemSource & { input: Input })[] })[];
  questions: (OpenQuestion & { sources: (OpenQuestionSource & { input: Input })[]; resolvedBy: Input | null })[];
};

export const versionInclude = {
  inputs: true,
  items: { orderBy: { position: "asc" as const }, include: { sources: { include: { input: true } } } },
  questions: {
    orderBy: { position: "asc" as const },
    include: { sources: { include: { input: true } }, resolvedBy: true },
  },
} as const;

export function toVersionSummary(v: Pick<SpecVersion, "number" | "kind" | "revertedFromNumber" | "createdByName" | "createdAt"> & { inputs: SpecVersionInput[] }): VersionSummary {
  return {
    number: v.number,
    kind: v.kind,
    revertedFromNumber: v.revertedFromNumber,
    createdByName: v.createdByName,
    createdAt: v.createdAt.toISOString(),
    inputIds: v.inputs.map((i) => i.inputId),
  };
}

const bySubmittedAt = (a: SourceRef, b: SourceRef) => a.submittedAt.localeCompare(b.submittedAt);

export function toVersionDetail(v: VersionRow): VersionDetail {
  return {
    ...toVersionSummary(v),
    items: v.items.map((item) => ({
      key: item.key,
      kind: item.kind,
      text: item.text,
      sources: item.sources.map((s) => toSourceRef(s.input)).sort(bySubmittedAt),
    })),
    questions: v.questions.map((q) => ({
      key: q.key,
      text: q.text,
      status: q.status,
      sources: q.sources.map((s) => toSourceRef(s.input)).sort(bySubmittedAt),
      resolvedBy: q.resolvedBy ? toSourceRef(q.resolvedBy) : null,
    })),
  };
}
