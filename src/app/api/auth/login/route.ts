import { createApiHandler } from "@/lib/api/handler";
import { parseJson } from "@/lib/api/validation";
import { success } from "@/lib/api/response";
import { loginSchema } from "@/modules/auth/auth.schemas";
import { login } from "@/modules/auth/auth.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = createApiHandler(
  { route: "/api/auth/login" },
  async (request) => {
    const input = await parseJson(request, loginSchema);
    return success({ user: await login(input) });
  },
);
