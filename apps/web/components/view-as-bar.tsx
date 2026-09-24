import { stopViewingAction, switchViewAction } from "@/app/actions/view-as";
import { viewAsRoleLabel, viewAsTeam } from "@/lib/viewAs";

type Session = {
  user: {
    id: string;
    name: string;
    role?: string | null;
  };
  session: { impersonatedBy?: string | null };
};

// Shown at the top of every web page while the admin is viewing as someone
// ("View as", admin Users page). Says whose view this is, switches to anyone
// else on the same team in one click, and returns to the admin's own session.
// Renders nothing in a normal session.
export async function ViewAsBar({ session }: { session: Session }) {
  if (!session.session.impersonatedBy) return null;
  const team = await viewAsTeam(session.user.id);
  const self = team.find((person) => person.id === session.user.id);

  return (
    <div className="view-as-bar" role="region" aria-label="View as">
      <div className="view-as-inner">
        <p className="view-as-who">
          <span className="view-as-label">Viewing as</span>
          <strong>{session.user.name}</strong>
          <span className="view-as-role">
            {self?.roleLabel ?? viewAsRoleLabel(session.user.role, null)}
          </span>
        </p>
        <nav className="view-as-switch" aria-label="Switch to">
          {team
            .filter((person) => person.id !== session.user.id)
            .map((person) => (
              <form key={person.id} action={switchViewAction.bind(null, person.id)}>
                <button type="submit" className="view-as-person">
                  {person.name}
                  <span>{person.roleLabel}</span>
                </button>
              </form>
            ))}
        </nav>
        <form action={stopViewingAction}>
          <button type="submit" className="view-as-return">
            Return to admin
          </button>
        </form>
      </div>
      <p className="view-as-note">
        Anything you do here is recorded as {session.user.name}.
      </p>
    </div>
  );
}
