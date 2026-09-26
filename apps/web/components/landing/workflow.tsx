import { roles, workflow } from "./content";

export function Workflow() {
  return (
    <section id="workflow" className="lp-section">
      <div className="lp-wrap">
        <div className="lp-head">
          <h2>{workflow.title}</h2>
          <p>{workflow.intro}</p>
        </div>
        <ol className="lp-flow">
          {workflow.steps.map((step) => (
            <li className="lp-flow-step" key={step.n}>
              <span className="lp-flow-n">{step.n}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
              <ul className="lp-carries" aria-label="Carried forward">
                {step.carries.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
        <p className="lp-note">{workflow.note}</p>
      </div>
    </section>
  );
}

export function Roles() {
  return (
    <section id="team" className="lp-section">
      <div className="lp-wrap">
        <div className="lp-head">
          <h2>{roles.title}</h2>
          <p>{roles.intro}</p>
        </div>
        <div className="lp-roles">
          {roles.items.map((role) => (
            <article className="lp-role" key={role.title}>
              <p className="lp-where">{role.where}</p>
              <h3>{role.title}</h3>
              <p>{role.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
