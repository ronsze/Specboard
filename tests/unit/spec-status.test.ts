import { describe, expect, it } from "vitest";
import { deriveSpecStatus } from "@/server/services/spec-status";

const base = { finalized: false, activeJob: false, latestJobFailed: false, pendingCount: 0, hasVersion: true };

describe("deriveSpecStatus", () => {
  it("확정이 가장 우선한다", () => {
    expect(deriveSpecStatus({ ...base, finalized: true, activeJob: true, latestJobFailed: true, pendingCount: 2 })).toBe("FINALIZED");
  });

  it("활성 작업이 있으면 UPDATING", () => {
    expect(deriveSpecStatus({ ...base, activeJob: true, latestJobFailed: true, pendingCount: 1 })).toBe("UPDATING");
  });

  it("최신 작업이 실패이고 반영 대기 입력이 있을 때만 FAILED", () => {
    expect(deriveSpecStatus({ ...base, latestJobFailed: true, pendingCount: 1 })).toBe("FAILED");
    expect(deriveSpecStatus({ ...base, latestJobFailed: true, pendingCount: 0 })).toBe("IDLE");
  });

  it("버전도 반영 대기 입력도 없으면 NONE", () => {
    expect(deriveSpecStatus({ ...base, hasVersion: false })).toBe("NONE");
  });

  it("버전이 없어도 반영 대기 입력이 있으면 IDLE, 그 외는 IDLE", () => {
    expect(deriveSpecStatus({ ...base, hasVersion: false, pendingCount: 2 })).toBe("IDLE");
    expect(deriveSpecStatus(base)).toBe("IDLE");
  });
});
