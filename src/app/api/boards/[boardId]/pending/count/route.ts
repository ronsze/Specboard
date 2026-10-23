import { currentUser } from "@/server/auth/session";
import { countBoardPending } from "@/server/services/board-pending";
import { toErrorResponse } from "@/lib/errors";

export async function GET(_req: Request, { params }: { params: Promise<{ boardId: string }> }) {
  try {
    const { boardId } = await params;
    return Response.json({ count: await countBoardPending(await currentUser(), boardId) });
  } catch (e) {
    return toErrorResponse(e);
  }
}
