import { createApiHandler } from "@/lib/api/handler";
import { AppError } from "@/lib/api/errors";
import { success } from "@/lib/api/response";
import { parseJson } from "@/lib/api/validation";
import { getSessionUser } from "@/modules/auth/session";
import { accountUpdateSchema } from "@/modules/auth/auth.schemas";
import { updateAccount } from "@/modules/auth/auth.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = createApiHandler({ route: "/api/auth/me" }, async () => {
  const user = await getSessionUser();
  if (!user) throw new AppError("UNAUTHENTICATED");
  return success({ user });
});
export const PATCH = createApiHandler(
  { route: "/api/auth/me" },
  async (request) => {
    const user = await getSessionUser();
    if (!user) throw new AppError("UNAUTHENTICATED");
    const input = await parseJson(request, accountUpdateSchema);
    return success({ user: await updateAccount(user.id, input) });
  },
);
