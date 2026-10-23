import { currentUser } from "@/server/auth/session";
import { finalizeSpec } from "@/server/services/spec";
import { toErrorResponse } from "@/lib/errors";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ boardId: string; featureId: string }> },
) {
  try {
    const { boardId, featureId } = await params;
    return Response.json(await finalizeSpec(await currentUser(), boardId, featureId));
  } catch (e) {
    return toErrorResponse(e);
  }
}
