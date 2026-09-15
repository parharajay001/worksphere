import "server-only";
import { cookies } from "next/headers";
import { requireMembership } from "./organization.service.ts";
const COOKIE = "worksphere_active_org";
export async function getActiveOrganization(userId: string) {
  const id = (await cookies()).get(COOKIE)?.value;
  if (id) {
    try {
      return (await requireMembership(userId, id)).organization;
    } catch {
      /* fall through */
    }
  }
  return (await import("./organization.repository.ts"))
    .listForUser(userId)
    .then((items) => items[0]?.organization ?? null);
}
export async function setActiveOrganization(userId: string, id: string) {
  const organization = (await requireMembership(userId, id)).organization;
  (await cookies()).set(COOKIE, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    priority: "high",
  });
  return organization;
}
