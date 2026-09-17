import { AccountRecovery } from "@/components/account-recovery";
import { getSessionUser } from "@/modules/auth/session";
export const dynamic = "force-dynamic";
export const metadata = { title: "Verify email" };
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const [user, query] = await Promise.all([getSessionUser(), searchParams]);
  return (
    <AccountRecovery
      mode="verify"
      token={query.token ?? ""}
      signedIn={Boolean(user)}
    />
  );
}
