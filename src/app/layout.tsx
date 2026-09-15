import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Brand } from "@/components/brand";
import "@fontsource-variable/dm-sans";
import "@fontsource-variable/manrope";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "WorkSphere — Room for good work",
    template: "%s | WorkSphere",
  },
  description:
    "A shared home for your team's projects, conversations, and progress.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <header className="site-header">
          <Brand />
          <span className="preview-label">
            <span className="status-dot" /> Early preview
          </span>
        </header>
        <div className="app-layout">
          <aside className="sidebar">
            <p className="eyebrow sidebar-label">Your space</p>
            <nav aria-label="Main navigation">
              <Link className="nav-item" href="/" aria-current="page">
                <span aria-hidden="true">◫</span> Overview{" "}
                <span className="nav-arrow" aria-hidden="true">
                  ↗
                </span>
              </Link>
            </nav>
            <div className="sidebar-note">
              <span className="small-orbit" aria-hidden="true" />
              <p>
                A little less scattered.
                <br />A lot more together.
              </p>
            </div>
            <span className="sidebar-footer">A home for teamwork.</span>
          </aside>
          <main id="main" tabIndex={-1}>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
