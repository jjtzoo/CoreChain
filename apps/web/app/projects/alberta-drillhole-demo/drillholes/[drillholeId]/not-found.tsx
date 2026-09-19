import Link from "next/link";

export default function DrillholeNotFound() {
  return (
    <div className="workspace-content workspace-content-dense">
      <section className="register-empty">
        <h1>That drillhole is not in this demonstration import.</h1>
        <p>
          Return to the register to choose one of the six linked source records.
        </p>
        <Link
          className="primary-action"
          href="/projects/alberta-drillhole-demo/drillholes"
        >
          Return to register
        </Link>
      </section>
    </div>
  );
}
