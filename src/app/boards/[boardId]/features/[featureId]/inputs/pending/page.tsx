import { redirect } from "next/navigation";

/** 001의 feature별 승인 대기 주소는 보드 단위 화면의 feature 필터로 이동한다. */
export default async function LegacyPendingPage({
  params,
}: {
  params: Promise<{ boardId: string; featureId: string }>;
}) {
  const { boardId, featureId } = await params;
  redirect(`/boards/${boardId}/pending?feature=${featureId}`);
}
