import { currentUser } from "@/server/auth/session";
import { revertSpec } from "@/server/services/spec";
import { revertExpectedSchema } from "@/lib/schemas/spec";
import { parse } from "@/server/services/inputs";
import { toErrorResponse } from "@/lib/errors";
import { z } from "zod";

const bodySchema = z.object({ toVersion: z.number().int().min(1), expected: revertExpectedSchema.optional() });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ boardId: string; featureId: string }> },
) {
  try {
    const { boardId, featureId } = await params;
    const user = await currentUser();
    const body = parse(bodySchema, await req.json().catch(() => ({})));
    return Response.json(await revertSpec(user, boardId, featureId, body.toVersion, body.expected), { status: 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
