import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppChrome } from "@/components/app-chrome";
import "@fontsource-variable/dm-sans";
import "@fontsource-variable/manrope";
import "./globals.css";
import "./product-ui.css";

export const metadata: Metadata = {
  title: {
    default: "WorkSphere — Plan, track, deliver",
    template: "%s | WorkSphere",
  },
  description:
    "Plan projects, track work, and keep your team moving in one focused workspace.",
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
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}
