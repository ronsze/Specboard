import { currentUser } from "@/server/auth/session";
import { getVersion } from "@/server/services/spec";
import { toErrorResponse } from "@/lib/errors";
import { positiveInt } from "@/lib/params";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ boardId: string; featureId: string; number: string }> },
) {
  try {
    const { boardId, featureId, number } = await params;
    const user = await currentUser();
    return Response.json(await getVersion(user, boardId, featureId, positiveInt(number, "number")));
  } catch (e) {
    return toErrorResponse(e);
  }
}
