import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, KeyRound, Search, Users, Workflow } from "lucide-react";
import { getSessionUser } from "@/modules/auth/session";
const topics = [
  {
    icon: Search,
    title: "Find anything",
    body: "Press / anywhere in WorkSphere to search projects and tasks.",
    href: "/dashboard",
  },
  {
    icon: Workflow,
    title: "Plan the work",
    body: "Create projects, shape task details, and move work across the board.",
    href: "/dashboard#projects",
  },
  {
    icon: Users,
    title: "Bring your team",
    body: "Invite people, set roles, and organize collaborators into focused teams.",
    href: "/people",
  },
  {
    icon: KeyRound,
    title: "Secure your account",
    body: "Update your profile, password, and email verification from account settings.",
    href: "/settings/account",
  },
];
export default async function HelpPage() {
  if (!(await getSessionUser())) redirect("/login");
  return (
    <div className="overview protected-overview help-page">
      <div className="page-breadcrumbs">
        <Link href="/dashboard">WorkSphere</Link>
        <span>/</span> Help
      </div>
      <header className="help-hero">
        <span>
          <BookOpen aria-hidden="true" />
        </span>
        <div>
          <p className="eyebrow accent">QUICK GUIDE</p>
          <h1>Keep work moving.</h1>
          <p>Short answers for the essential WorkSphere workflows.</p>
        </div>
      </header>
      <div className="help-topic-grid">
        {topics.map(({ icon: Icon, title, body, href }, index) => (
          <Link key={title} href={href}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <Icon aria-hidden="true" />
            <h2>{title}</h2>
            <p>{body}</p>
            <strong>Open guide →</strong>
          </Link>
        ))}
      </div>
      <section className="help-footer-card">
        <div>
          <p className="eyebrow">STILL STUCK?</p>
          <h2>Check the workspace settings first.</h2>
          <p>
            Most access and workspace questions can be resolved by an owner or
            admin.
          </p>
        </div>
        <Link className="primary-link" href="/settings/workspace">
          Workspace settings
        </Link>
      </section>
    </div>
  );
}
