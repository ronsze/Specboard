export type SpecStatus = "NONE" | "IDLE" | "UPDATING" | "FAILED" | "FINALIZED";

export type SpecStatusInput = {
  finalized: boolean;
  /** QUEUED 또는 RUNNING 작업이 있는가 */
  activeJob: boolean;
  /** 가장 최근 작업이 FAILED인가 */
  latestJobFailed: boolean;
  /** 승인되었으나 아직 반영되지 않은 입력 수 */
  pendingCount: number;
  hasVersion: boolean;
};

/** spec 상태 판정. spec 화면(getSpec)과 홈 요약이 같은 규칙을 쓴다. */
export function deriveSpecStatus(i: SpecStatusInput): SpecStatus {
  if (i.finalized) return "FINALIZED";
  if (i.activeJob) return "UPDATING";
  if (i.latestJobFailed && i.pendingCount > 0) return "FAILED";
  if (!i.hasVersion && i.pendingCount === 0) return "NONE";
  return "IDLE";
}
