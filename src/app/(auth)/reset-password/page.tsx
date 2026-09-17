import { AccountRecovery } from "@/components/account-recovery";
export const metadata = { title: "Reset password" };
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return <AccountRecovery mode="reset" token={token ?? ""} />;
}
