import Link from "next/link";

export function Brand() {
  return (
    <Link className="brand" href="/" aria-label="WorkSphere home">
      <span className="brand-mark" aria-hidden="true">
        W
      </span>
      <span>WorkSphere</span>
    </Link>
  );
}
