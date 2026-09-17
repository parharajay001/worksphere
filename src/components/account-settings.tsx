"use client";
import { useState, type FormEvent } from "react";
import { Check, KeyRound, UserRound } from "lucide-react";
type User = {
  id: string;
  name: string;
  email: string;
  emailVerifiedAt: Date | string | null;
};
type Errors = Record<string, string>;
export function AccountSettings({ user }: { user: User }) {
  const [name, setName] = useState(user.name);
  const [pending, setPending] = useState("");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Errors>({});
  async function request(path: string, payload?: object) {
    const response = await fetch(path, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(
        response.status === 401
          ? "Your current password is incorrect."
          : (body?.error?.details?.[0]?.message ??
              body?.error?.message ??
              "The change could not be saved."),
      );
    return body;
  }
  async function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const input = form.elements.namedItem("name") as HTMLInputElement;
    const next: Errors = {};
    if (!input.value.trim()) next.name = "Enter your name.";
    setFields(next);
    if (next.name) {
      input.focus();
      return;
    }
    setPending("name");
    setError("");
    setSuccess("");
    try {
      const body = await request("/api/auth/me", { name: input.value });
      setName(body.data.user.name);
      setSuccess("Profile name updated.");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Name could not be updated.",
      );
    }
    setPending("");
  }
  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const current = String(data.get("currentPassword") ?? "");
    const password = String(data.get("newPassword") ?? "");
    const confirmation = String(data.get("confirmation") ?? "");
    const next: Errors = {};
    if (current.length < 12)
      next.currentPassword = "Enter your current password.";
    if (password.length < 12) next.newPassword = "Use at least 12 characters.";
    if (password !== confirmation)
      next.confirmation = "Passwords do not match.";
    setFields(next);
    if (Object.keys(next).length) {
      (
        form.elements.namedItem(Object.keys(next)[0]!) as HTMLInputElement
      )?.focus();
      return;
    }
    setPending("password");
    setError("");
    setSuccess("");
    try {
      await request("/api/auth/me", {
        currentPassword: current,
        newPassword: password,
      });
      form.reset();
      setSuccess("Password updated.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Password could not be updated.",
      );
    }
    setPending("");
  }
  async function resend() {
    setPending("verify");
    setError("");
    const response = await fetch("/api/auth/verify-email/resend", {
      method: "POST",
    });
    setPending("");
    if (response.ok) setSuccess("Verification link requested.");
    else setError("Verification link could not be requested.");
  }
  return (
    <div className="account-settings-stack">
      <div className="settings-status" aria-live="polite">
        {error && (
          <p className="settings-error" role="alert">
            {error}
          </p>
        )}
        {success && (
          <p className="settings-success">
            <Check size={15} aria-hidden="true" />
            {success}
          </p>
        )}
      </div>
      <section className="settings-card account-profile-card">
        <span className="settings-card-icon">
          <UserRound aria-hidden="true" />
        </span>
        <p className="eyebrow accent">IDENTITY</p>
        <h2>Profile details</h2>
        <p className="settings-lede">
          Keep the name your teammates see across tasks, comments, and activity.
        </p>
        <form className="settings-form" onSubmit={saveName} noValidate>
          <label>
            Display name
            <input
              name="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              maxLength={100}
              autoComplete="name"
              aria-invalid={Boolean(fields.name)}
            />
            {fields.name && (
              <small className="field-error">{fields.name}</small>
            )}
          </label>
          <label>
            Email address
            <input value={user.email} disabled />
          </label>
          <div className="account-verification">
            <span className={user.emailVerifiedAt ? "verified" : "unverified"}>
              {user.emailVerifiedAt ? "Verified email" : "Verification pending"}
            </span>
            {!user.emailVerifiedAt && (
              <button
                type="button"
                className="secondary-button"
                disabled={pending === "verify"}
                onClick={() => void resend()}
              >
                {pending === "verify" ? "Requesting…" : "Resend verification"}
              </button>
            )}
          </div>
          <div className="settings-actions">
            <button className="primary-link" disabled={pending === "name"}>
              {pending === "name" ? "Saving…" : "Save profile"}
            </button>
          </div>
        </form>
      </section>
      <section className="settings-card account-security-card">
        <span className="settings-card-icon">
          <KeyRound aria-hidden="true" />
        </span>
        <p className="eyebrow accent">SECURITY</p>
        <h2>Change password</h2>
        <p className="settings-lede">
          Confirm your current password before choosing a new one.
        </p>
        <form className="settings-form" onSubmit={savePassword} noValidate>
          <label>
            Current password
            <input
              name="currentPassword"
              type="password"
              required
              minLength={12}
              maxLength={128}
              autoComplete="current-password"
              aria-invalid={Boolean(fields.currentPassword)}
            />
            {fields.currentPassword && (
              <small className="field-error">{fields.currentPassword}</small>
            )}
          </label>
          <div className="account-password-grid">
            <label>
              New password
              <input
                name="newPassword"
                type="password"
                required
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
                aria-invalid={Boolean(fields.newPassword)}
              />
              {fields.newPassword && (
                <small className="field-error">{fields.newPassword}</small>
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
          </div>
          <div className="settings-actions">
            <button className="primary-link" disabled={pending === "password"}>
              {pending === "password" ? "Updating…" : "Update password"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
