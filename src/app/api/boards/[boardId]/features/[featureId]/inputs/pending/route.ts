import { currentUser } from "@/server/auth/session";
import { listPendingInputs } from "@/server/services/inputs";
import { toErrorResponse } from "@/lib/errors";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ boardId: string; featureId: string }> },
) {
  try {
    const { boardId, featureId } = await params;
    return Response.json(await listPendingInputs(await currentUser(), boardId, featureId));
  } catch (e) {
    return toErrorResponse(e);
  }
}
