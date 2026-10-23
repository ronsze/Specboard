import { currentUser } from "@/server/auth/session";
import { approveInput } from "@/server/services/inputs";
import { toErrorResponse } from "@/lib/errors";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ boardId: string; inputId: string }> },
) {
  try {
    const { boardId, inputId } = await params;
    return Response.json(await approveInput(await currentUser(), boardId, inputId));
  } catch (e) {
    return toErrorResponse(e);
  }
}
