import { currentUser } from "@/server/auth/session";
import { listBoardPending } from "@/server/services/board-pending";
import { toErrorResponse } from "@/lib/errors";

export async function GET(req: Request, { params }: { params: Promise<{ boardId: string }> }) {
  try {
    const { boardId } = await params;
    const user = await currentUser();
    const featureId = new URL(req.url).searchParams.get("feature") ?? undefined;
    return Response.json(await listBoardPending(user, boardId, { featureId }));
  } catch (e) {
    return toErrorResponse(e);
  }
}
