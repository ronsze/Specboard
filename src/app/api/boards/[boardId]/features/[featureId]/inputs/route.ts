import { currentUser } from "@/server/auth/session";
import { listInputs, submitInput } from "@/server/services/inputs";
import { toErrorResponse } from "@/lib/errors";

type Params = { params: Promise<{ boardId: string; featureId: string }> };

export async function GET(req: Request, { params }: Params) {
  try {
    const { boardId, featureId } = await params;
    const user = await currentUser();
    const status = new URL(req.url).searchParams.get("status") ?? undefined;
    return Response.json(await listInputs(user, boardId, featureId, status));
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function POST(req: Request, { params }: Params) {
  try {
    const { boardId, featureId } = await params;
    const user = await currentUser();
    const body = await req.json().catch(() => ({}));
    return Response.json(await submitInput(user, boardId, featureId, body), { status: 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
