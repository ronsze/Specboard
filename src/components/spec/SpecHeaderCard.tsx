import Link from "next/link";
import { LockControl } from "@/components/spec/LockControl";
import { Badge, SpecStatusBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { formatFull, formatShort } from "@/lib/format";
import type { SpecView } from "@/server/services/spec";

/** 현재 버전 카드: 상태, 버전·시각·생성 방식, 이력 링크, 관리자 전용 확정 컨트롤. */
export function SpecHeaderCard({
  spec,
  role,
  boardId,
  featureId,
}: {
  spec: SpecView;
  role: "ADMIN" | "MEMBER" | "VIEWER";
  boardId: string;
  featureId: string;
}) {
  const v = spec.version;
  if (!v) return null;
  const canLock = role === "ADMIN" && (spec.status === "IDLE" || spec.status === "FINALIZED");
  return (
    <Card aria-label="현재 버전">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="row" style={{ gap: 12 }}>
          <SpecStatusBadge status={spec.status} />
          <span>
            버전 <strong className="mono">v{v.number}</strong>
          </span>
          <span className="meta mono">{formatFull(v.createdAt)} 생성</span>
          <Badge tone={v.kind === "AI_UPDATE" ? "ai" : "outline"} icon={v.kind === "AI_UPDATE" ? "lines" : "undo"}>
            {v.kind === "AI_UPDATE" ? "AI 갱신" : `v${v.revertedFromNumber}로 되돌림`}
          </Badge>
          <Link href={`/boards/${boardId}/features/${featureId}/spec/history`} className="row" style={{ gap: 4 }}>
            <Icon name="compare" size={14} /> 이력·비교
          </Link>
        </div>
        {canLock && (
          <LockControl
            boardId={boardId}
            featureId={featureId}
            finalized={spec.status === "FINALIZED"}
            finalizedBy={spec.finalizedByName}
            finalizedAt={spec.finalizedAt}
            pendingCount={spec.pendingInputCount}
          />
        )}
      </div>
      {spec.status === "FINALIZED" && spec.finalizedAt && (
        <p className="meta" style={{ marginTop: 8 }}>
          <Icon name="lock" size={13} /> {spec.finalizedByName} 확정 · <span className="mono">{formatShort(spec.finalizedAt)}</span>
        </p>
      )}
    </Card>
  );
}
