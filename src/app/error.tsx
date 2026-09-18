"use client";
import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="route-error" role="alert">
      <span className="route-error-code">ERR</span>
      <AlertTriangle aria-hidden="true" />
      <p className="eyebrow accent">WORKSPACE INTERRUPTED</p>
      <h1>That page lost its footing.</h1>
      <p>
        Your work is safe. Try loading the page again, or return to the
        dashboard.
      </p>
      <div>
        <button className="primary-link" onClick={() => retry()}>
          <RotateCcw size={16} aria-hidden="true" /> Try again
        </button>
        <Link className="secondary-button" href="/dashboard">
          Return to dashboard
        </Link>
      </div>
      {error.digest && <small>Reference: {error.digest}</small>}
    </div>
  );
}
