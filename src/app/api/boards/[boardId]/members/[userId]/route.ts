import { currentUser } from "@/server/auth/session";
import { changeRole } from "@/server/services/members";
import { toErrorResponse } from "@/lib/errors";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ boardId: string; userId: string }> },
) {
  try {
    const { boardId, userId } = await params;
    const user = await currentUser();
    const body = await req.json().catch(() => ({}));
    return Response.json(await changeRole(user, boardId, userId, body));
  } catch (e) {
    return toErrorResponse(e);
  }
}
