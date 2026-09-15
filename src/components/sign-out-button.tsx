"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <button
      className="primary-link"
      type="button"
      onClick={signOut}
      disabled={pending}
    >
      {pending ? "Signing out…" : "Sign out"}
      <span aria-hidden="true">↗</span>
    </button>
  );
}
