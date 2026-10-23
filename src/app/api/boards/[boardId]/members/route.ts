import { currentUser } from "@/server/auth/session";
import { addMember, listMembers } from "@/server/services/members";
import { toErrorResponse } from "@/lib/errors";

type Params = { params: Promise<{ boardId: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { boardId } = await params;
    return Response.json(await listMembers(await currentUser(), boardId));
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function POST(req: Request, { params }: Params) {
  try {
    const { boardId } = await params;
    const user = await currentUser();
    const body = await req.json().catch(() => ({}));
    return Response.json(await addMember(user, boardId, body), { status: 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
