"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode } from "react";
import {
  Bell,
  ChartNoAxesCombined,
  CircleHelp,
  Clock3,
  FolderKanban,
  LayoutDashboard,
  Plus,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Brand } from "./brand";
import { WorkspacePicker } from "./workspace-picker";
import { ProfileMenu } from "./profile-menu";
import { GlobalSearch } from "./global-search";
import { SidebarPlan } from "./sidebar-plan";

const navItems = [
  { href: "/dashboard", label: "Your work", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/analytics", label: "Reports", icon: ChartNoAxesCombined },
  { href: "/activity", label: "Activity", icon: Clock3 },
];

export function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isPublic =
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname === "/verify-email" ||
    pathname === "/invitations/accept";
  if (isPublic)
    return (
      <div className="public-shell">
        <header className="public-header">
          <Brand />
          <nav aria-label="Account navigation">
            <Link href="/login">Log in</Link>
            <Link className="public-signup" href="/register">
              Get started
            </Link>
          </nav>
        </header>
        {children}
      </div>
    );
  return (
    <div className="product-shell">
      <header className="product-topbar">
        <Brand />
        <WorkspacePicker />
        <GlobalSearch />
        <div className="topbar-actions">
          <Link href="/projects/new" aria-label="Create project">
            <Plus size={18} />
          </Link>
          <Link href="/notifications" aria-label="Notifications">
            <Bell size={18} aria-hidden="true" />
          </Link>
          <Link href="/help" aria-label="Help">
            <CircleHelp size={18} aria-hidden="true" />
          </Link>
          <ProfileMenu />
        </div>
      </header>
      <div className="product-body">
        <aside className="product-sidebar">
          <div className="sidebar-project">
            <span className="sidebar-project-mark">W</span>
            <span>
              <strong>WorkSphere</strong>
              <small>Team workspace</small>
            </span>
          </div>
          <nav aria-label="Workspace navigation">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`product-nav-item${pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`)) ? " active" : ""}`}
              >
                <Icon size={17} aria-hidden="true" />
                {label}
              </Link>
            ))}
          </nav>
          <div className="sidebar-section">
            <p>Workspace</p>
            <Link
              href="/teams"
              className={`product-nav-item${pathname === "/teams" ? " active" : ""}`}
            >
              <Users size={16} aria-hidden="true" /> Teams
            </Link>
            <Link
              href="/people"
              className={`product-nav-item${pathname === "/people" ? " active" : ""}`}
            >
              <Users size={16} aria-hidden="true" /> People
            </Link>
            <Link
              href="/settings/workspace"
              className={`product-nav-item${pathname.startsWith("/settings") && pathname !== "/settings/audit" ? " active" : ""}`}
            >
              <Settings size={16} aria-hidden="true" /> Settings
            </Link>
            <Link
              href="/settings/audit"
              className={`product-nav-item${pathname === "/settings/audit" ? " active" : ""}`}
            >
              <ShieldCheck size={16} aria-hidden="true" /> Audit log
            </Link>
          </div>
          <SidebarPlan />
        </aside>
        <main id="main" tabIndex={-1} className="product-main">
          {children}
        </main>
      </div>
    </div>
  );
}
