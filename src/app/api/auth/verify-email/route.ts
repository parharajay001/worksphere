import { createApiHandler } from "@/lib/api/handler";
import { parseJson } from "@/lib/api/validation";
import { success } from "@/lib/api/response";
import { tokenSchema } from "@/modules/auth/auth.schemas";
import { verifyEmail } from "@/modules/auth/auth.service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = createApiHandler(
  { route: "/api/auth/verify-email" },
  async (request) => {
    const { token } = await parseJson(request, tokenSchema);
    return success({ user: await verifyEmail(token) });
  },
);
