export default function Home() {
  return (
    <div className="overview">
      <div className="page-heading">
        <p className="eyebrow">Workspace / Overview</p>
        <span className="edition">The beginning of something good</span>
      </div>
      <section className="welcome" aria-labelledby="welcome-title">
        <div className="welcome-copy">
          <p className="eyebrow accent">Less noise. More momentum.</p>
          <h1 id="welcome-title">
            Good work starts
            <br />
            with a shared <em>space.</em>
          </h1>
          <p className="intro">
            Bring your people, projects, and next steps together.
            <br className="desktop-break" /> Make room for the work that
            matters.
          </p>
          <a className="primary-link" href="#workspace">
            Explore your space <span aria-hidden="true">↗</span>
          </a>
        </div>
        <div className="orbit-art" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <span className="orbit-point point-one" />
          <span className="orbit-point point-two" />
          <span className="orbit-point point-three" />
          <span className="orbit-center">
            w<span>together, in motion</span>
          </span>
          <span className="art-caption">
            A shared direction. A world of possibility.
          </span>
        </div>
      </section>
      <section
        className="workspace-section"
        id="workspace"
        aria-labelledby="workspace-title"
      >
        <div className="section-heading">
          <h2 id="workspace-title">Your workspace</h2>
          <span className="outline-label">A fresh start</span>
        </div>
        <div className="empty-workspace">
          <div className="empty-illustration" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <h3>A little space. A lot of potential.</h3>
          <p>
            This is where your team&apos;s work will come together.
            <br />
            Project creation will be available in a future update.
          </p>
          <span className="quiet-label">
            You&apos;re here at the beginning.
          </span>
        </div>
      </section>
      <footer className="page-footer">
        <span>
          WorkSphere <span aria-hidden="true">/</span> Room for good work.
        </span>
        <span>
          Built to bring people together <span aria-hidden="true">↗</span>
        </span>
      </footer>
    </div>
  );
}
