import { currentUser } from "@/server/auth/session";
import { rejectInput } from "@/server/services/inputs";
import { toErrorResponse } from "@/lib/errors";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ boardId: string; inputId: string }> },
) {
  try {
    const { boardId, inputId } = await params;
    const user = await currentUser();
    const body = await req.json().catch(() => ({}));
    return Response.json(await rejectInput(user, boardId, inputId, body));
  } catch (e) {
    return toErrorResponse(e);
  }
}
