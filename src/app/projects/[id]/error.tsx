"use client";

export default function ProjectError({ reset }: { reset: () => void }) {
  return (
    <section className="overview">
      <h1>Project unavailable</h1>
      <p>We could not load this project. Please try again.</p>
      <button type="button" onClick={reset}>
        Try again
      </button>
    </section>
  );
}
