import { createApiHandler } from "@/lib/api/handler";
import { success } from "@/lib/api/response";
import { clearSession } from "@/modules/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = createApiHandler(
  { route: "/api/auth/logout" },
  async () => {
    await clearSession();
    return success({ loggedOut: true });
  },
);
