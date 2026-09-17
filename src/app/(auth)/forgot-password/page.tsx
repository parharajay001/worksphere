import { AccountRecovery } from "@/components/account-recovery";
export const metadata = { title: "Forgot password" };
export default function ForgotPasswordPage() {
  return <AccountRecovery mode="forgot" />;
}
