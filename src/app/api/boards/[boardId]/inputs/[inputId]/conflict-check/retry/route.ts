import { currentUser } from "@/server/auth/session";
import { retryConflictCheck } from "@/server/services/conflict-checks";
import { toErrorResponse } from "@/lib/errors";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ boardId: string; inputId: string }> },
) {
  try {
    const { boardId, inputId } = await params;
    await retryConflictCheck(await currentUser(), boardId, inputId);
    return Response.json({ ok: true }, { status: 202 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
