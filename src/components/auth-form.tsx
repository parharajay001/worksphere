"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type Props = { mode: "login" | "register" };
type ApiError = {
  error?: {
    message?: string;
    details?: Array<{ path: string; message: string }>;
  };
};

export function AuthForm({ mode }: Props) {
  const register = mode === "register";
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = event.currentTarget;
    const validation: Record<string, string> = {};
    for (const element of Array.from(form.elements)) {
      if (!(element instanceof HTMLInputElement) || element.validity.valid)
        continue;
      validation[element.name] = element.validity.valueMissing
        ? "This field is required."
        : element.validity.typeMismatch
          ? "Enter a valid email address."
          : element.validity.tooShort
            ? `Use at least ${element.minLength} characters.`
            : element.validationMessage;
    }
    setFieldErrors(validation);
    const firstField = Object.keys(validation)[0];
    if (firstField) {
      (form.elements.namedItem(firstField) as HTMLInputElement | null)?.focus();
      return;
    }
    setPending(true);
    const input = Object.fromEntries(new FormData(form).entries());
    try {
      const response = await fetch(
        `/api/auth/${register ? "register" : "login"}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        },
      );
      const body = (await response.json()) as ApiError;
      if (!response.ok) {
        const serverFields = Object.fromEntries(
          (body.error?.details ?? [])
            .filter((detail) => detail.path)
            .map((detail) => [detail.path.split(".").at(-1)!, detail.message]),
        );
        setFieldErrors(serverFields);
        const firstServerField = Object.keys(serverFields)[0];
        if (firstServerField)
          (
            form.elements.namedItem(firstServerField) as HTMLInputElement | null
          )?.focus();
        throw new Error(
          body.error?.details?.[0]?.message ??
            body.error?.message ??
            "Unable to continue.",
        );
      }
      router.push("/dashboard");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to continue.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <Link className="auth-brand" href="/">
          WorkSphere<span>.</span>
        </Link>
        <p className="eyebrow accent">
          {register ? "Start together" : "Welcome back"}
        </p>
        <h1>
          {register ? "Make room for good work." : "Good to see you again."}
        </h1>
        <p className="auth-intro">
          {register
            ? "Create your account and find a clearer way to work."
            : "Sign in to continue where your team left off."}
        </p>
        <form onSubmit={submit} noValidate>
          {register && (
            <label>
              Name
              <input
                name="name"
                type="text"
                autoComplete="name"
                required
                minLength={1}
                maxLength={100}
                aria-invalid={Boolean(fieldErrors.name)}
              />
              {fieldErrors.name && (
                <small className="field-error">{fieldErrors.name}</small>
              )}
            </label>
          )}
          <label>
            Email
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              aria-invalid={Boolean(fieldErrors.email)}
            />
            {fieldErrors.email && (
              <small className="field-error">{fieldErrors.email}</small>
            )}
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete={register ? "new-password" : "current-password"}
              required
              minLength={12}
              maxLength={128}
              aria-invalid={Boolean(fieldErrors.password)}
            />
            {fieldErrors.password && (
              <small className="field-error">{fieldErrors.password}</small>
            )}
          </label>
          {!register && (
            <Link className="forgot-password-link" href="/forgot-password">
              Forgot password?
            </Link>
          )}
          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="primary-link auth-submit"
            type="submit"
            disabled={pending}
          >
            {pending ? "One moment…" : register ? "Create account" : "Sign in"}
            <span aria-hidden="true">↗</span>
          </button>
        </form>
        <p className="auth-switch">
          {register ? "Already have an account?" : "New to WorkSphere?"}{" "}
          <Link href={register ? "/login" : "/register"}>
            {register ? "Sign in" : "Create an account"}
          </Link>
        </p>
      </div>
      <div className="auth-art" aria-hidden="true">
        <div className="auth-orbit" />
        <div className="auth-orbit second" />
        <span>w</span>
        <small>together, in motion</small>
      </div>
    </main>
  );
}
