"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LogOut, Settings, UserRound } from "lucide-react";
export function ProfileMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<{ name: string; email: string } | null>(
    null,
  );
  const container = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open || user) return;
    void fetch("/api/auth/me")
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => body && setUser(body.data.user));
  }, [open, user]);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    const outside = (event: MouseEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", close);
    document.addEventListener("mousedown", outside);
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("mousedown", outside);
    };
  }, [open]);
  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }
  const initials =
    user?.name
      .split(" ")
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() ?? "WS";
  return (
    <div className="profile-menu" ref={container}>
      <button
        ref={button}
        className="topbar-avatar"
        type="button"
        aria-label="Open profile menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {initials}
      </button>
      {open && (
        <div className="profile-popover" role="menu">
          <header>
            <span>{initials}</span>
            <div>
              <strong>{user?.name ?? "Loading…"}</strong>
              <small>{user?.email ?? "Account"}</small>
            </div>
          </header>
          <Link
            role="menuitem"
            href="/settings/account"
            onClick={() => setOpen(false)}
          >
            <UserRound size={16} aria-hidden="true" /> Account settings
          </Link>
          <Link
            role="menuitem"
            href="/settings/workspace"
            onClick={() => setOpen(false)}
          >
            <Settings size={16} aria-hidden="true" /> Workspace settings
          </Link>
          <button role="menuitem" onClick={() => void signOut()}>
            <LogOut size={16} aria-hidden="true" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
