import Link from "next/link";
import { after } from "next/server";
import { pageContext } from "@/server/auth/page-context";
import { getSpec } from "@/server/services/spec";
import { drainSpecJobs } from "@/server/services/spec-jobs";
import { AutoRefresh } from "@/components/AutoRefresh";
import { RetryButton } from "@/components/RetryButton";
import { SpecItemList } from "@/components/SpecItemList";
import { OpenQuestionList } from "@/components/OpenQuestionList";

const STATUS_LABEL = {
  NONE: "입력 없음",
  IDLE: "최신",
  UPDATING: "갱신 중",
  FAILED: "갱신 실패",
  FINALIZED: "확정",
} as const;

export default async function SpecPage({
  params,
}: {
  params: Promise<{ boardId: string; featureId: string }>;
}) {
  const { boardId, featureId } = await params;
  const { user, role } = await pageContext(boardId);
  const spec = await getSpec(user, boardId, featureId);
  // 멈춘 갱신(프로세스 재시작 등)이 있으면 이어서 처리한다
  if (spec.status === "UPDATING") after(() => drainSpecJobs(featureId).catch(console.error));

  return (
    <main>
      <nav>
        <Link href={`/boards/${boardId}/features/${featureId}/inputs`}>← 입력 목록</Link>
        <span className="spacer" />
        <Link href={`/boards/${boardId}/features/${featureId}/spec/history`}>버전 이력</Link>
        <span className="badge">{role}</span>
      </nav>
      <h1>
        spec {spec.version && <span className="meta">v{spec.version.number}</span>}{" "}
        <span className={`badge ${spec.status}`}>{STATUS_LABEL[spec.status]}</span>
      </h1>
      <AutoRefresh active={spec.status === "UPDATING"} />
      {spec.message && (
        <p className={spec.status === "FAILED" ? "error" : "meta"} role="status">
          {spec.message} {spec.status === "FAILED" && role === "ADMIN" && <RetryButton boardId={boardId} featureId={featureId} />}
        </p>
      )}
      {spec.pendingInputCount > 0 && spec.status !== "FINALIZED" && (
        <p className="meta">반영 대기 입력 {spec.pendingInputCount}개</p>
      )}
      {spec.finalizedAt && (
        <p className="meta">
          {spec.finalizedByName} 확정 · {new Date(spec.finalizedAt).toLocaleString("ko-KR")}
        </p>
      )}
      {spec.version && (
        <>
          <SpecItemList items={spec.version.items} />
          <OpenQuestionList questions={spec.version.questions} />
        </>
      )}
    </main>
  );
}
