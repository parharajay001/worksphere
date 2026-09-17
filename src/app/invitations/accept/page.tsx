import { getSessionUser } from "@/modules/auth/session";
import { InvitationAcceptance } from "@/components/invitation-acceptance";
export const dynamic = "force-dynamic";
export default async function AcceptInvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const [user, query] = await Promise.all([getSessionUser(), searchParams]);
  return (
    <InvitationAcceptance token={query.token ?? ""} signedIn={Boolean(user)} />
  );
}
