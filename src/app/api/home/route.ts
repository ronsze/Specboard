import { currentUser } from "@/server/auth/session";
import { getHome } from "@/server/services/home";
import { toErrorResponse } from "@/lib/errors";

export async function GET() {
  try {
    const user = await currentUser();
    return Response.json({ user: { name: user.displayName }, ...(await getHome(user)) });
  } catch (e) {
    return toErrorResponse(e);
  }
}
