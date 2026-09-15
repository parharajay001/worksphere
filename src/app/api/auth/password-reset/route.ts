import { createApiHandler } from "@/lib/api/handler";
import { parseJson } from "@/lib/api/validation";
import { success } from "@/lib/api/response";
import { passwordResetSchema } from "@/modules/auth/auth.schemas";
import { resetPassword } from "@/modules/auth/auth.service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = createApiHandler(
  { route: "/api/auth/password-reset" },
  async (request) => {
    const input = await parseJson(request, passwordResetSchema);
    await resetPassword(input.token, input.password);
    return success({ message: "Password reset successfully." });
  },
);
