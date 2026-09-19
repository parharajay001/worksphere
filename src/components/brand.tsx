import Link from "next/link";

export function Brand({
  href = "/",
  label = "WorkSphere home",
}: {
  href?: string;
  label?: string;
}) {
  return (
    <Link className="brand" href={href} aria-label={label}>
      <span className="brand-mark" aria-hidden="true">
        W
      </span>
      <span>WorkSphere</span>
    </Link>
  );
}
