import { currentUser } from "@/server/auth/session";
import { revertSpec } from "@/server/services/spec";
import { toErrorResponse } from "@/lib/errors";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ boardId: string; featureId: string }> },
) {
  try {
    const { boardId, featureId } = await params;
    const user = await currentUser();
    const body = (await req.json().catch(() => ({}))) as { toVersion?: number };
    return Response.json(await revertSpec(user, boardId, featureId, body.toVersion as number), { status: 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
