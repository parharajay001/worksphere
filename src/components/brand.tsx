import Link from "next/link";

export function Brand() {
  return (
    <Link className="brand" href="/" aria-label="WorkSphere home">
      <svg
        className="brand-mark"
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
      >
        <rect width="32" height="32" rx="10" fill="currentColor" />
        <path
          d="m7 11 4 11 5-9 5 9 4-11"
          stroke="#FAF9F5"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      WorkSphere<span className="brand-period">.</span>
    </Link>
  );
}
