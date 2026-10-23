import { currentUser } from "@/server/auth/session";
import { diff } from "@/server/services/spec";
import { toErrorResponse } from "@/lib/errors";
import { positiveInt } from "@/lib/params";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ boardId: string; featureId: string }> },
) {
  try {
    const { boardId, featureId } = await params;
    const user = await currentUser();
    const q = new URL(req.url).searchParams;
    return Response.json(
      await diff(user, boardId, featureId, positiveInt(q.get("from"), "from"), positiveInt(q.get("to"), "to")),
    );
  } catch (e) {
    return toErrorResponse(e);
  }
}
