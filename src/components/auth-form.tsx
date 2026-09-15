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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const input = Object.fromEntries(
      new FormData(event.currentTarget).entries(),
    );
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
      if (!response.ok)
        throw new Error(
          body.error?.details?.[0]?.message ??
            body.error?.message ??
            "Unable to continue.",
        );
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
              />
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
            />
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
            />
          </label>
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
