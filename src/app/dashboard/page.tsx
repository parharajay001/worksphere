import { redirect } from "next/navigation";
import { getSessionUser } from "../../modules/auth/session.ts";
import { SignOutButton } from "../../components/sign-out-button";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return (
    <div className="overview protected-overview">
      <p className="eyebrow accent">Private workspace</p>
      <h1>
        Welcome, <em>{user.name}</em>.
      </h1>
      <p className="intro">
        You’re signed in as {user.email}. Organization setup arrives on Day 6.
      </p>
      <SignOutButton />
    </div>
  );
}
