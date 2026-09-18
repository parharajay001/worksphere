import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/modules/auth/session";
import { listNotifications } from "@/modules/notifications/notification.service";
import { NotificationCenter } from "@/components/notification-center";
import { NotificationPreferences } from "@/components/notification-preferences";
import { getNotificationPreferences } from "@/modules/notifications/preferences";
export const dynamic = "force-dynamic";
export default async function NotificationsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const notifications = await listNotifications(user.id, {
    limit: 20,
    unreadOnly: false,
  });
  const preferences = await getNotificationPreferences(user.id);
  return (
    <div className="overview protected-overview notifications-page">
      <div className="page-breadcrumbs">
        <Link href="/dashboard">WorkSphere</Link>
        <span>/</span> Notifications
      </div>
      <header className="dashboard-header">
        <div>
          <p className="eyebrow accent">INBOX</p>
          <h1>Notifications</h1>
          <p className="intro">
            Everything that needs your attention, in one place.
          </p>
        </div>
      </header>
      <NotificationCenter initialPage={notifications} />
      <NotificationPreferences initialPreferences={preferences} />
    </div>
  );
}
