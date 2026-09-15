import { createApiHandler } from "@/lib/api/handler";
import { parseJson } from "@/lib/api/validation";
import { success } from "@/lib/api/response";
import { registrationSchema } from "@/modules/auth/auth.schemas";
import { register } from "@/modules/auth/auth.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = createApiHandler(
  { route: "/api/auth/register" },
  async (request) => {
    const input = await parseJson(request, registrationSchema);
    return success({ user: await register(input) }, { status: 201 });
  },
);
