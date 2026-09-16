import { createApiHandler } from "@/lib/api/handler";
import { parseJson } from "@/lib/api/validation";
import { success } from "@/lib/api/response";
import { emailSchema } from "@/modules/auth/auth.schemas";
import { requestPasswordReset } from "@/modules/auth/auth.service";
import { enforceAuthRateLimit } from "@/modules/auth/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = createApiHandler(
  { route: "/api/auth/password-reset/request" },
  async (request) => {
    const input = await parseJson(request, emailSchema);
    await enforceAuthRateLimit(
      "recovery",
      `${request.headers.get("x-forwarded-for") ?? "unknown"}:${input.email}`,
    );
    await requestPasswordReset(input.email);
    return success({
      message: "If an account exists, reset instructions will be sent.",
    });
  },
);
