import Link from "next/link";

export default function NotFound() {
  return (
    <div className="not-found">
      <p className="eyebrow accent">404 / A wrong turn</p>
      <h1>This space isn&apos;t here.</h1>
      <p>Head back to your overview to find your way.</p>
      <Link className="primary-link" href="/">
        Back to overview <span aria-hidden="true">↗</span>
      </Link>
    </div>
  );
}
