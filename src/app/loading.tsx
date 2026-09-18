export default function Loading() {
  return (
    <div className="route-loading" role="status" aria-live="polite">
      <div className="route-loading-heading">
        <span className="skeleton-block short" />
        <span className="skeleton-block title" />
        <span className="skeleton-block copy" />
      </div>
      <div className="route-loading-grid">
        <span />
        <span />
        <span />
      </div>
      <p>Loading workspace…</p>
    </div>
  );
}
