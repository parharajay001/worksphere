"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Check, MailCheck } from "lucide-react";
export function InvitationAcceptance({
  token,
  signedIn,
}: {
  token: string;
  signedIn: boolean;
}) {
  const [state, setState] = useState<"idle" | "pending" | "accepted" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");
  async function accept() {
    setState("pending");
    setMessage("");
    const response = await fetch("/api/invitations/accept", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (response.ok) setState("accepted");
    else {
      const body = await response.json().catch(() => ({}));
      setMessage(
        response.status === 403
          ? "This invitation belongs to a different email address."
          : (body?.error?.message ??
              "This invitation is invalid, expired, or already used."),
      );
      setState("error");
    }
  }
  return (
    <main className="invitation-page">
      <section className="invitation-ticket">
        <span className="invitation-ticket-mark">
          <MailCheck aria-hidden="true" />
        </span>
        <p className="eyebrow accent">WORKSPHERE INVITATION</p>
        {state === "accepted" ? (
          <>
            <h1>You&apos;re in.</h1>
            <p>
              Your workspace access is ready. Meet the team and find the work
              that is already moving.
            </p>
            <Link className="primary-link" href="/dashboard">
              Open workspace <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </>
        ) : (
          <>
            <h1>Join the workspace.</h1>
            <p>
              Accept this invitation to add the workspace to your WorkSphere
              account.
            </p>
            {!token && (
              <p className="settings-error" role="alert">
                This invitation link is missing its token.
              </p>
            )}
            {state === "error" && (
              <p className="settings-error" role="alert">
                {message}
              </p>
            )}
            {signedIn ? (
              <button
                className="primary-link"
                disabled={!token || state === "pending"}
                onClick={() => void accept()}
              >
                {state === "pending" ? (
                  "Accepting…"
                ) : (
                  <>
                    <Check size={16} aria-hidden="true" /> Accept invitation
                  </>
                )}
              </button>
            ) : (
              <div className="invitation-auth-actions">
                <Link className="primary-link" href="/login">
                  Sign in to accept
                </Link>
                <Link className="secondary-button" href="/register">
                  Create account
                </Link>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
