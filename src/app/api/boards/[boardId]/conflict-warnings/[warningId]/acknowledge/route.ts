import { currentUser } from "@/server/auth/session";
import { acknowledgeWarning } from "@/server/services/conflicts";
import { toErrorResponse } from "@/lib/errors";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ boardId: string; warningId: string }> },
) {
  try {
    const { boardId, warningId } = await params;
    return Response.json(await acknowledgeWarning(await currentUser(), boardId, warningId));
  } catch (e) {
    return toErrorResponse(e);
  }
}
