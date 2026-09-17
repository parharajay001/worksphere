import { createApiHandler } from "@/lib/api/handler";
import { AppError } from "@/lib/api/errors";
import { success } from "@/lib/api/response";
import { getSessionUser } from "@/modules/auth/session";
import { resendEmailVerification } from "@/modules/auth/auth.service";
import { enforceAuthRateLimit } from "@/modules/auth/rate-limit";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = createApiHandler(
  { route: "/api/auth/verify-email/resend" },
  async (request) => {
    const user = await getSessionUser();
    if (!user) throw new AppError("UNAUTHENTICATED");
    await enforceAuthRateLimit(
      "recovery",
      `${request.headers.get("x-forwarded-for") ?? "unknown"}:${user.email}`,
    );
    if (user.emailVerifiedAt)
      return success({ message: "Your email is already verified." });
    const token = await resendEmailVerification(user.id);
    return success({
      message: "A fresh verification link has been sent.",
      ...(process.env.EMAIL_DELIVERY_PREVIEW === "true"
        ? { previewToken: token }
        : {}),
    });
  },
);
