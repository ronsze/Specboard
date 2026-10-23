import { currentUser } from "@/server/auth/session";
import { unfinalizeSpec } from "@/server/services/spec";
import { toErrorResponse } from "@/lib/errors";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ boardId: string; featureId: string }> },
) {
  try {
    const { boardId, featureId } = await params;
    return Response.json(await unfinalizeSpec(await currentUser(), boardId, featureId));
  } catch (e) {
    return toErrorResponse(e);
  }
}
