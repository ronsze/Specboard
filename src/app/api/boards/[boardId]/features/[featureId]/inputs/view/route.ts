import { currentUser } from "@/server/auth/session";
import { listInputsView } from "@/server/services/inputs";
import { toErrorResponse, ValidationError } from "@/lib/errors";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ boardId: string; featureId: string }> },
) {
  try {
    const { boardId, featureId } = await params;
    const user = await currentUser();
    const q = new URL(req.url).searchParams;
    const limitRaw = q.get("limit");
    const limit = limitRaw === null ? undefined : Number(limitRaw);
    if (limit !== undefined && !Number.isInteger(limit)) throw new ValidationError("limit은 정수여야 합니다.");
    return Response.json(
      await listInputsView(user, boardId, featureId, {
        filter: q.get("filter") ?? undefined,
        limit,
        cursor: q.get("cursor") ?? undefined,
      }),
    );
  } catch (e) {
    return toErrorResponse(e);
  }
}
