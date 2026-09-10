"use client";

export default function DrillholesError({ reset }: { reset: () => void }) {
  return (
    <div className="workspace-content workspace-content-dense">
      <section className="register-empty" role="alert">
        <h1>We could not load the drillhole records.</h1>
        <p>
          Check the local source files, then try loading the register again.
        </p>
        <button className="primary-action" onClick={reset} type="button">
          Try again
        </button>
      </section>
    </div>
  );
}
