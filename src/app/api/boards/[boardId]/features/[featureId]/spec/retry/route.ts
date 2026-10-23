import { currentUser } from "@/server/auth/session";
import { retrySpecJob } from "@/server/services/spec-jobs";
import { toErrorResponse } from "@/lib/errors";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ boardId: string; featureId: string }> },
) {
  try {
    const { boardId, featureId } = await params;
    await retrySpecJob(await currentUser(), boardId, featureId);
    return Response.json({ ok: true }, { status: 202 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
