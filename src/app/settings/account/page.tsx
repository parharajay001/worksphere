import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/modules/auth/session";
import { AccountSettings } from "@/components/account-settings";
export const dynamic = "force-dynamic";
export default async function AccountSettingsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return (
    <div className="overview protected-overview workspace-settings-page">
      <div className="page-breadcrumbs">
        <Link href="/dashboard">WorkSphere</Link>
        <span>/</span> Account settings
      </div>
      <header className="settings-page-header">
        <p className="eyebrow accent">PERSONAL SETTINGS</p>
        <h1>Your account</h1>
        <p>
          Manage the identity and credentials you use across every workspace.
        </p>
      </header>
      <AccountSettings user={user} />
    </div>
  );
}
