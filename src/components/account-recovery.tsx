"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, KeyRound, MailCheck } from "lucide-react";

type Mode = "forgot" | "reset" | "verify";
type FieldErrors = Record<string, string>;
function firstInvalid(form: HTMLFormElement, errors: FieldErrors) {
  const field = Object.keys(errors)[0];
  if (field)
    (form.elements.namedItem(field) as HTMLInputElement | null)?.focus();
}
function clientErrors(form: HTMLFormElement) {
  const errors: FieldErrors = {};
  for (const element of Array.from(form.elements)) {
    if (!(element instanceof HTMLInputElement) || element.validity.valid)
      continue;
    errors[element.name] = element.validity.valueMissing
      ? "This field is required."
      : element.validity.typeMismatch
        ? "Enter a valid email address."
        : element.validity.tooShort
          ? `Use at least ${element.minLength} characters.`
          : element.validationMessage;
  }
  const password = form.elements.namedItem(
    "password",
  ) as HTMLInputElement | null;
  const confirmation = form.elements.namedItem(
    "confirmation",
  ) as HTMLInputElement | null;
  if (password && confirmation && password.value !== confirmation.value)
    errors.confirmation = "Passwords do not match.";
  return errors;
}

export function AccountRecovery({
  mode,
  token = "",
  signedIn = false,
}: {
  mode: Mode;
  token?: string;
  signedIn?: boolean;
}) {
  const [pending, setPending] = useState(mode === "verify" && Boolean(token));
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<FieldErrors>({});
  const submitted = useRef(false);

  useEffect(() => {
    if (mode !== "verify" || !token || submitted.current) return;
    submitted.current = true;
    void fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            "This verification link is expired or has already been used.",
          );
        setComplete(true);
      })
      .catch((cause) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "Email could not be verified.",
        ),
      )
      .finally(() => setPending(false));
  }, [mode, token]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const validation = clientErrors(form);
    setFields(validation);
    setError("");
    if (Object.keys(validation).length) {
      firstInvalid(form, validation);
      return;
    }
    const data = new FormData(form);
    setPending(true);
    const response = await fetch(
      mode === "forgot"
        ? "/api/auth/password-reset/request"
        : "/api/auth/password-reset",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          mode === "forgot"
            ? { email: data.get("email") }
            : { token, password: data.get("password") },
        ),
      },
    );
    if (response.ok) setComplete(true);
    else {
      const body = await response.json().catch(() => ({}));
      if (response.status === 400 && mode === "reset")
        setError("This reset link is expired or has already been used.");
      else
        setError(
          body?.error?.details?.[0]?.message ??
            body?.error?.message ??
            "Unable to continue.",
        );
    }
    setPending(false);
  }

  async function resend() {
    setPending(true);
    setError("");
    const response = await fetch("/api/auth/verify-email/resend", {
      method: "POST",
    });
    if (response.ok) setComplete(true);
    else
      setError(
        response.status === 401
          ? "Sign in before requesting a new verification link."
          : "A new link could not be sent.",
      );
    setPending(false);
  }

  const copy =
    mode === "forgot"
      ? {
          eyebrow: "ACCOUNT RECOVERY",
          title: "Find your way back.",
          intro:
            "Enter your account email. If it matches, we’ll send a secure reset link.",
          icon: KeyRound,
        }
      : mode === "reset"
        ? {
            eyebrow: "NEW CREDENTIALS",
            title: "Choose a fresh password.",
            intro:
              "Use at least 12 characters and avoid reusing an old password.",
            icon: KeyRound,
          }
        : {
            eyebrow: "EMAIL CHECK",
            title: "Confirm it’s really you.",
            intro:
              "Verification keeps account recovery and workspace invitations secure.",
            icon: MailCheck,
          };
  const Icon = copy.icon;
  return (
    <main className="recovery-page">
      <section className="recovery-card">
        <span className="recovery-index">
          {mode === "forgot" ? "01" : mode === "reset" ? "02" : "✓"}
        </span>
        <span className="settings-card-icon">
          <Icon aria-hidden="true" />
        </span>
        <p className="eyebrow accent">{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
        <p className="auth-intro">{copy.intro}</p>
        {complete ? (
          <div className="recovery-result" role="status">
            <CheckCircle2 aria-hidden="true" />
            <div>
              <h2>
                {mode === "forgot"
                  ? "Check your inbox"
                  : mode === "reset"
                    ? "Password updated"
                    : token
                      ? "Email verified"
                      : "Fresh link requested"}
              </h2>
              <p>
                {mode === "forgot"
                  ? "If that email belongs to an account, reset instructions are on their way."
                  : mode === "reset"
                    ? "Your previous sessions were closed. Sign in with your new password."
                    : "You can return to WorkSphere and keep moving."}
              </p>
            </div>
            <Link
              className="primary-link"
              href={signedIn && mode === "verify" ? "/dashboard" : "/login"}
            >
              {signedIn && mode === "verify"
                ? "Return to workspace"
                : "Go to sign in"}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        ) : mode === "verify" ? (
          <div className="recovery-action">
            {pending && <p role="status">Checking verification link…</p>}
            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}
            {!pending && (
              <>
                {signedIn ? (
                  <button
                    className="primary-link"
                    onClick={() => void resend()}
                  >
                    Send a new link
                  </button>
                ) : (
                  <Link className="primary-link" href="/login">
                    Sign in to request a new link
                  </Link>
                )}
              </>
            )}
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            {mode === "forgot" ? (
              <label>
                Email address
                <input
                  name="email"
                  type="email"
                  required
                  maxLength={254}
                  autoComplete="email"
                  aria-invalid={Boolean(fields.email)}
                  aria-describedby={fields.email ? "email-error" : undefined}
                />
                {fields.email && (
                  <small id="email-error" className="field-error">
                    {fields.email}
                  </small>
                )}
              </label>
            ) : (
              <>
                <label>
                  New password
                  <input
                    name="password"
                    type="password"
                    required
                    minLength={12}
                    maxLength={128}
                    autoComplete="new-password"
                    aria-invalid={Boolean(fields.password)}
                  />
                  {fields.password && (
                    <small className="field-error">{fields.password}</small>
                  )}
                </label>
                <label>
                  Confirm new password
                  <input
                    name="confirmation"
                    type="password"
                    required
                    minLength={12}
                    maxLength={128}
                    autoComplete="new-password"
                    aria-invalid={Boolean(fields.confirmation)}
                  />
                  {fields.confirmation && (
                    <small className="field-error">{fields.confirmation}</small>
                  )}
                </label>
              </>
            )}
            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}
            <button
              className="primary-link auth-submit"
              disabled={pending || (mode === "reset" && !token)}
            >
              {pending
                ? "One moment…"
                : mode === "forgot"
                  ? "Send reset link"
                  : "Reset password"}
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </form>
        )}
        {!complete && mode !== "verify" && (
          <p className="auth-switch">
            <Link href="/login">Back to sign in</Link>
          </p>
        )}
      </section>
      <aside className="recovery-aside" aria-hidden="true">
        <span>private by design</span>
        <strong>
          One link.
          <br />
          One hour.
          <br />
          One use.
        </strong>
      </aside>
    </main>
  );
}
