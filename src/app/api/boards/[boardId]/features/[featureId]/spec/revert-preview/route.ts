import { currentUser } from "@/server/auth/session";
import { previewRevert } from "@/server/services/spec";
import { toErrorResponse } from "@/lib/errors";
import { positiveInt } from "@/lib/params";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ boardId: string; featureId: string }> },
) {
  try {
    const { boardId, featureId } = await params;
    const user = await currentUser();
    const toVersion = positiveInt(new URL(req.url).searchParams.get("toVersion"), "toVersion");
    return Response.json(await previewRevert(user, boardId, featureId, toVersion));
  } catch (e) {
    return toErrorResponse(e);
  }
}
