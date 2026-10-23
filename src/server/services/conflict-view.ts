import type { PrismaClient } from "@prisma/client";
import { db } from "@/server/db/client";
import { itemLabel } from "@/lib/labels";

export type WarningView = {
  id: string;
  itemKey: string;
  label: string;
  kind: "DECISION" | "REQUIREMENT";
  /** 경고를 만든 시점의 항목 문구 */
  itemText: string;
  onFinalizedSpec: boolean;
  reason: string;
  /** 입력 원문에서 강조할 구간. 원문에 없으면 null */
  quote: { start: number; end: number } | null;
  acknowledged: { byName: string; at: string } | null;
};

export type ConflictView = {
  state: "CHECKING" | "DONE" | "FAILED" | "SKIPPED";
  skipReason: string | null;
  failure: { code: string | null; attempts: number } | null;
  /** 확정 충돌이 먼저, 그다음 생성 순 */
  warnings: WarningView[];
  unacknowledgedCount: number;
  checkedAt: string | null;
  /** 검사가 비교에 쓴 spec 버전 */
  baseVersion: number | null;
  currentSpecVersion: number | null;
  /** 검사 이후 spec이 갱신되었거나, 검사 안 함이었는데 비교 대상이 새로 생김 */
  stale: boolean;
  /** 다시 검사 버튼 표시 조건 */
  recheckable: boolean;
  processedAs: "APPROVED" | "REJECTED" | null;
};

type WarningRow = {
  id: string;
  itemKey: string;
  itemKind: "DECISION" | "REQUIREMENT";
  itemNumber: number;
  itemText: string;
  onFinalizedSpec: boolean;
  reason: string;
  quoteStart: number | null;
  quoteEnd: number | null;
  acknowledgedAt: Date | null;
  acknowledgedByName: string | null;
};

export function toWarningView(w: WarningRow): WarningView {
  return {
    id: w.id,
    itemKey: w.itemKey,
    label: itemLabel(w.itemKind, w.itemNumber),
    kind: w.itemKind,
    itemText: w.itemText,
    onFinalizedSpec: w.onFinalizedSpec,
    reason: w.reason,
    quote: w.quoteStart !== null && w.quoteEnd !== null ? { start: w.quoteStart, end: w.quoteEnd } : null,
    acknowledged: w.acknowledgedAt ? { byName: w.acknowledgedByName ?? "", at: w.acknowledgedAt.toISOString() } : null,
  };
}

type InputRef = { id: string; featureId: string; status: "PENDING" | "APPROVED" | "REJECTED" };

/**
 * 관리자에게만 내려가는 충돌 검사 조회 모델. 입력 묶음을 입력 수와 무관한 쿼리 수로 조회한다.
 * 검사 기록이 없는 입력(이 feature 이전, 관리자 제출)은 null.
 */
export async function loadConflictViews(
  inputs: InputRef[],
  client: PrismaClient = db,
): Promise<Map<string, ConflictView | null>> {
  const result = new Map<string, ConflictView | null>(inputs.map((i) => [i.id, null]));
  if (inputs.length === 0) return result;

  const checks = await client.conflictCheck.findMany({
    where: { inputId: { in: inputs.map((i) => i.id) } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    distinct: ["inputId"],
    include: { warnings: true },
  });
  const featureIds = [...new Set(inputs.map((i) => i.featureId))];
  const specs = await client.spec.findMany({
    where: { featureId: { in: featureIds } },
    select: {
      featureId: true,
      versions: { orderBy: { number: "desc" }, take: 1, select: { number: true, _count: { select: { items: true } } } },
    },
  });
  const specByFeature = new Map(specs.map((s) => [s.featureId, s.versions[0] ?? null]));
  const inputById = new Map(inputs.map((i) => [i.id, i]));

  for (const check of checks) {
    const input = inputById.get(check.inputId)!;
    const latest = specByFeature.get(input.featureId) ?? null;
    const state = check.status === "QUEUED" || check.status === "RUNNING" ? "CHECKING" : check.status;
    const hasItems = (latest?._count.items ?? 0) > 0;
    const baseVersion = check.status === "DONE" ? check.baseVersionNumber : null;
    const stale =
      (check.status === "DONE" && baseVersion !== null && latest !== null && baseVersion < latest.number) ||
      (check.status === "SKIPPED" && hasItems);
    const warnings: WarningView[] = [...check.warnings]
      .sort((a, b) => Number(b.onFinalizedSpec) - Number(a.onFinalizedSpec) || a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id))
      .map(toWarningView);
    result.set(check.inputId, {
      state,
      skipReason: check.skipReason,
      failure: check.status === "FAILED" ? { code: check.lastError, attempts: check.attempts } : null,
      warnings,
      unacknowledgedCount: warnings.filter((w) => !w.acknowledged).length,
      checkedAt: check.completedAt?.toISOString() ?? null,
      baseVersion,
      currentSpecVersion: latest?.number ?? null,
      stale,
      recheckable: input.status === "PENDING" && state !== "CHECKING" && (check.status === "FAILED" || stale),
      processedAs: input.status === "PENDING" ? null : input.status,
    });
  }
  return result;
}
