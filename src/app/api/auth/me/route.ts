import { createApiHandler } from "@/lib/api/handler";
import { AppError } from "@/lib/api/errors";
import { success } from "@/lib/api/response";
import { getSessionUser } from "@/modules/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = createApiHandler({ route: "/api/auth/me" }, async () => {
  const user = await getSessionUser();
  if (!user) throw new AppError("UNAUTHENTICATED");
  return success({ user });
});
