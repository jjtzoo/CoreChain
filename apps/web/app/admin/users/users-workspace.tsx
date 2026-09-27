"use client";

import {
  canBeViewedAs,
  QAQC_STAGE_LABELS,
  QAQC_STAGES,
  ROLE_LABELS,
  ROLE_SUMMARIES,
  USER_ROLES,
  toUserRole,
  type UserRole,
} from "@corechain/domain";
import {
  useState,
  useSyncExternalStore,
  useTransition,
  type FormEvent,
} from "react";
import {
  createTeamAction,
  createUserAction,
  resetPasswordAction,
  setQaqcStageAction,
  setRoleAction,
  setUserTeamAction,
  setUserTitleAction,
  dismissRequestAction,
  loadDemoProjectsAction,
  removeDemoProjectsAction,
  setSwitchedOffAction,
  suggestPasswordAction,
} from "./actions";
import { viewAsAction } from "@/app/actions/view-as";

export type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string | null;
  title: string | null;
  switchedOff: boolean;
  createdAt: string;
  lastActiveAt: string | null;
  organizationId: string | null;
  qaqcStage: string | null;
};

const NO_STAGE = "";

export type TeamRow = {
  id: string;
  name: string;
  /** How many of the demo projects the team has now, out of demoProjectsTotal. */
  demoProjects: number;
  demoProjectsTotal: number;
};

const PERSONAL_WORKSPACE = "";

export type RequestRow = {
  id: string;
  name: string;
  company: string;
  email: string;
  /** "Tester" or "Team pilot": what the person asked for. */
  interest: string;
  createdAt: string;
};

type Credentials = {
  kind: "created" | "reset";
  name: string;
  email: string;
  password: string;
};

// Days, not times: server and browser can be in different time zones, and a
// time-of-day here would flicker when the page hydrates.
function formatDay(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "Never";
}

function CredentialsCard({
  credentials,
  onDismiss,
  onCopied,
}: {
  credentials: Credentials;
  onDismiss: () => void;
  onCopied: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const text = `CoreChain\nEmail: ${credentials.email}\nPassword: ${credentials.password}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      onCopied();
    } catch {
      setCopied(false);
    }
  };

  return (
    <section
      className="admin-card admin-credentials"
      role="status"
      aria-live="polite"
    >
      <div className="admin-credentials-head">
        <h2>
          {credentials.kind === "created"
            ? "Account created"
            : "New password set"}{" "}
          for {credentials.name}
        </h2>
        <button type="button" className="admin-link" onClick={onDismiss}>
          Dismiss
        </button>
      </div>
      <dl className="admin-credentials-values">
        <div>
          <dt>Email</dt>
          <dd>{credentials.email}</dd>
        </div>
        <div>
          <dt>Password</dt>
          <dd className="admin-mono">{credentials.password}</dd>
        </div>
      </dl>
      <p className="admin-hint">
        Send this to {credentials.name} yourself. It is shown only now:
        CoreChain stores a scrambled copy, so it can&apos;t be looked up later,
        only reset.
      </p>
      <button type="button" className="admin-button" onClick={copy}>
        {copied ? "Copied" : "Copy email and password"}
      </button>
    </section>
  );
}

// Per-browser only: whether the admin dismissed the checklist early, and
// whether they've ever copied a set of credentials to send. Both are cheap
// UI convenience, not data another admin or device needs to see.
const DISMISSED_KEY = "corechain-admin-checklist-dismissed";
const COPIED_KEY = "corechain-admin-checklist-login-copied";

function readFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "true";
  } catch {
    return false;
  }
}

function writeFlag(key: string, value: boolean) {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Private browsing or blocked storage: the checklist just won't remember.
  }
}

function noSubscription() {
  return () => {};
}

// The server has no localStorage, so the first render (and the client's
// first, matching, hydration pass) always sees `false`; React re-renders
// with the real value right after, without a manual effect + setState.
function useStoredFlag(key: string): [boolean, (value: boolean) => void] {
  const stored = useSyncExternalStore(
    noSubscription,
    () => readFlag(key),
    () => false,
  );
  const [override, setOverride] = useState<boolean | null>(null);
  return [
    override ?? stored,
    (value: boolean) => {
      writeFlag(key, value);
      setOverride(value);
    },
  ];
}

// E10-5: a short checklist so a first-time admin can set up their first
// tester without help. It hides itself once a tester account exists and its
// login has been copied at least once, or once dismissed early, but a link
// stays available to bring it back for a refresher.
function FirstRunChecklist({
  hasTester,
  everCopied,
}: {
  hasTester: boolean;
  everCopied: boolean;
}) {
  const [dismissed, setDismissed] = useStoredFlag(DISMISSED_KEY);
  const [forceShow, setForceShow] = useState(false);

  const done = hasTester && everCopied;
  const visible = forceShow || (!dismissed && !done);

  if (!visible) {
    return (
      <button
        type="button"
        className="admin-link admin-checklist-reopen"
        onClick={() => setForceShow(true)}
      >
        Show setup checklist
      </button>
    );
  }

  return (
    <section className="admin-card admin-checklist" aria-labelledby="checklist-title">
      <div className="admin-card-head">
        <h2 id="checklist-title">Set up your first tester</h2>
        <button
          type="button"
          className="admin-link"
          onClick={() => {
            setDismissed(true);
            setForceShow(false);
          }}
        >
          Hide
        </button>
      </div>
      <ol className="admin-checklist-steps">
        <li data-done={hasTester || undefined}>Add a user</li>
        <li data-done={hasTester || undefined}>Choose their tier</li>
        <li data-done={everCopied || undefined}>Send them the login</li>
      </ol>
      <p className="admin-hint">
        Use the form to the right. Once you copy a set of credentials to send,
        this checklist is done — it disappears, and you can bring it back from
        here any time.
      </p>
    </section>
  );
}

// E11-1: teams keep a company's data from mixing with another company's, or
// with a solo tester's personal workspace. A team's own workspace, in the
// admin's own words, so it reads right whether there is one team or ten.
function TeamsCard({
  teams,
  memberCounts,
}: {
  teams: TeamRow[];
  memberCounts: Map<string, number>;
}) {
  const [name, setName] = useState("");
  const [withDemo, setWithDemo] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await createTeamAction(name, withDemo);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setName("");
      setNotice(
        result.demo
          ? `Created "${result.name}" with the demo projects: ${describeDemo(result.demo)}.`
          : `Created "${result.name}".`,
      );
    });
  };

  return (
    <section className="admin-card" aria-labelledby="teams-title">
      <div className="admin-card-head">
        <h2 id="teams-title">Teams</h2>
        <span className="admin-count">{teams.length}</span>
      </div>
      <p className="admin-hint">
        A team keeps one company&apos;s projects, holes and samples isolated
        from every other team and from solo testers. Assign each person to a
        team below, or leave them in their own personal workspace.
      </p>
      {teams.length > 0 ? (
        <ul className="admin-users">
          {teams.map((team) => (
            <li className="admin-user team-row" key={team.id}>
              <div className="admin-user-who">
                <span className="admin-user-name">{team.name}</span>
              </div>
              <div className="admin-status">
                <span className="admin-meta-label">People</span>
                <span>{memberCounts.get(team.id) ?? 0}</span>
              </div>
              <TeamDemoControls team={team} />
            </li>
          ))}
        </ul>
      ) : null}
      <form className="team-create" onSubmit={submit} noValidate>
        <div className="field-with-action">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New team name, e.g. a company's name"
            autoComplete="off"
            aria-label="New team name"
          />
          <button type="submit" className="admin-button" disabled={pending}>
            {pending ? "Working…" : "Create team"}
          </button>
        </div>
        <label className="team-demo-option">
          <input
            type="checkbox"
            checked={withDemo}
            onChange={(e) => setWithDemo(e.target.checked)}
          />
          <span>
            Start with the demo projects and a demo crew (three geologists, a
            laboratory and three QA/QC reviewers, who cannot sign in), so the
            team has holes, logs, samples, a batch for the laboratory and
            results to look at before its own work syncs. They can be removed at any time.
          </span>
        </label>
      </form>
      {error ? (
        <p role="alert" className="form-error">
          {error}
        </p>
      ) : null}
      {notice ? <p className="admin-hint">{notice}</p> : null}
    </section>
  );
}

function describeDemo(demo: { name: string; holes: number; samples: number }[]): string {
  return demo
    .map((p) => `${p.name} (${p.holes} holes, ${p.samples} samples)`)
    .join(" and ");
}

// The manual option, per team: add the demo projects, replace them with a
// fresh copy, or remove them. Replacing and removing delete everything
// recorded in the demo projects, so both ask first.
function TeamDemoControls({ team }: { team: TeamRow }) {
  const [confirming, setConfirming] = useState<"replace" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const has = team.demoProjects > 0;

  const load = () => {
    setError(null);
    setNotice(null);
    setConfirming(null);
    startTransition(async () => {
      const result = await loadDemoProjectsAction(team.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNotice(`Added ${describeDemo(result.demo)}.`);
    });
  };

  const remove = () => {
    setError(null);
    setNotice(null);
    setConfirming(null);
    startTransition(async () => {
      const result = await removeDemoProjectsAction(team.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNotice(
        result.removed > 0
          ? "Removed the demo projects and the demo crew. Phones drop the projects at their next sync."
          : "There were no demo projects to remove.",
      );
    });
  };

  return (
    <div className="team-demo">
      <div className="team-demo-line">
        <span className="admin-meta-label">Demo projects</span>
        <span>{has ? `${team.demoProjects} of ${team.demoProjectsTotal} added` : "None"}</span>
        {confirming === null ? (
          <span className="team-demo-actions">
            {has ? (
              <>
                <button
                  type="button"
                  className="admin-link"
                  disabled={pending}
                  onClick={() => setConfirming("replace")}
                >
                  Replace with a fresh copy
                </button>
                <button
                  type="button"
                  className="admin-link"
                  disabled={pending}
                  onClick={() => setConfirming("remove")}
                >
                  Remove
                </button>
              </>
            ) : (
              <button type="button" className="admin-link" disabled={pending} onClick={load}>
                {pending ? "Adding…" : "Add demo projects"}
              </button>
            )}
          </span>
        ) : null}
      </div>
      {confirming ? (
        <div className="team-demo-confirm" role="alert">
          <span>
            {confirming === "replace"
              ? "Replace the demo projects? Anything recorded in them since they were added is deleted, on the web and on phones at their next sync."
              : "Remove the demo projects? They and anything recorded in them are deleted, on the web and on phones at their next sync. The demo crew's accounts are removed too. The team's own people and projects are not touched."}
          </span>
          <span className="team-demo-actions">
            <button
              type="button"
              className="admin-button"
              disabled={pending}
              onClick={confirming === "replace" ? load : remove}
            >
              {confirming === "replace" ? "Replace" : "Remove"}
            </button>
            <button
              type="button"
              className="admin-link"
              disabled={pending}
              onClick={() => setConfirming(null)}
            >
              Cancel
            </button>
          </span>
        </div>
      ) : null}
      {pending ? <p className="admin-hint">Working… this can take up to a minute.</p> : null}
      {error ? (
        <p role="alert" className="form-error">
          {error}
        </p>
      ) : null}
      {notice ? <p className="admin-hint">{notice}</p> : null}
    </div>
  );
}

function AddUserForm({
  teams,
  initialSuggestion,
  initialName = "",
  initialEmail = "",
  onCreated,
}: {
  teams: TeamRow[];
  initialSuggestion: string;
  initialName?: string;
  initialEmail?: string;
  onCreated: (credentials: Credentials) => void;
}) {
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [title, setTitle] = useState("");
  const [role, setRole] = useState<UserRole>("geologist");
  const [organizationId, setOrganizationId] = useState(PERSONAL_WORKSPACE);
  const [password, setPassword] = useState(initialSuggestion);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const suggest = () => {
    startTransition(async () => {
      setPassword(await suggestPasswordAction());
    });
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createUserAction({
        name,
        email,
        role,
        password,
        organizationId: organizationId || null,
        title: title || null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onCreated({
        kind: "created",
        name: name.trim(),
        email: result.email,
        password: result.password,
      });
      setName("");
      setEmail("");
      setTitle("");
      setRole("geologist");
      setOrganizationId(PERSONAL_WORKSPACE);
      setPassword(await suggestPasswordAction());
    });
  };

  return (
    <form className="admin-card admin-add" onSubmit={submit} noValidate>
      <h2>Add a user</h2>

      <label className="field">
        <span className="field-label">Name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="off"
        />
      </label>

      <label className="field">
        <span className="field-label">Email</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
        />
      </label>

      <label className="field">
        <span className="field-label">Title (optional)</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Senior geologist, Site manager"
          autoComplete="off"
        />
        <span className="admin-hint">
          Shown instead of the tier name on the team roster. Leave blank to
          just show the tier.
        </span>
      </label>

      <label className="field">
        <span className="field-label">What they can do</span>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as UserRole)}
        >
          {USER_ROLES.map((value) => (
            <option key={value} value={value}>
              {ROLE_LABELS[value]}
            </option>
          ))}
        </select>
        <span className="admin-hint">{ROLE_SUMMARIES[role]}</span>
      </label>

      <label className="field">
        <span className="field-label">Team</span>
        <select
          value={organizationId}
          onChange={(e) => setOrganizationId(e.target.value)}
        >
          <option value={PERSONAL_WORKSPACE}>Personal workspace</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
        <span className="admin-hint">
          Put testers from the same company on the same team so they share
          one workspace, isolated from every other team.
        </span>
      </label>

      <label className="field">
        <span className="field-label">Starting password</span>
        <span className="field-with-action">
          <input
            className="admin-mono"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            className="field-toggle"
            onClick={suggest}
            disabled={pending}
          >
            New
          </button>
        </span>
        <span className="admin-hint">
          Easy to say and type on a phone. They can change it later.
        </span>
      </label>

      {error ? (
        <p role="alert" className="form-error">
          {error}
        </p>
      ) : null}

      <button type="submit" className="auth-submit" disabled={pending}>
        {pending ? "Working…" : "Create account"}
      </button>
    </form>
  );
}

function UserItem({
  user,
  teams,
  isYou,
  onCredentials,
}: {
  user: UserRow;
  teams: TeamRow[];
  isYou: boolean;
  onCredentials: (credentials: Credentials) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(user.title ?? "");
  const role = toUserRole(user.role);

  const saveTitle = () => {
    if (title.trim() === (user.title ?? "").trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await setUserTitleAction(user.id, title);
      if (!result.ok) setError(result.error);
    });
  };

  const changeRole = (next: string) => {
    setError(null);
    startTransition(async () => {
      const result = await setRoleAction(user.id, next);
      if (!result.ok) setError(result.error);
    });
  };

  const changeTeam = (next: string) => {
    setError(null);
    startTransition(async () => {
      const result = await setUserTeamAction(user.id, next || null);
      if (!result.ok) setError(result.error);
    });
  };

  const changeStage = (next: string) => {
    setError(null);
    startTransition(async () => {
      const result = await setQaqcStageAction(user.id, next || null);
      if (!result.ok) setError(result.error);
    });
  };

  const reset = () => {
    if (
      !window.confirm(
        `Set a new password for ${user.name}? Anyone signed in as them on a phone will be signed out.`,
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await resetPasswordAction(user.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onCredentials({
        kind: "reset",
        name: user.name,
        email: user.email,
        password: result.password,
      });
    });
  };

  const canView = canBeViewedAs({ role: user.role, banned: user.switchedOff });

  const viewAs = () => {
    setError(null);
    startTransition(async () => {
      const result = await viewAsAction(user.id);
      if (result && !result.ok) setError(result.error);
    });
  };

  const toggleSwitchedOff = () => {
    const turningOff = !user.switchedOff;
    if (
      turningOff &&
      !window.confirm(
        `Switch off ${user.name}? They won't be able to sign in or sync until you switch them back on.`,
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await setSwitchedOffAction(user.id, turningOff);
      if (!result.ok) setError(result.error);
    });
  };

  return (
    <li
      className="admin-user"
      data-switched-off={user.switchedOff || undefined}
    >
      <div className="admin-user-who">
        <span className="admin-user-name">
          {user.name}
          {isYou ? <span className="admin-you">You</span> : null}
        </span>
        <span className="admin-user-email">{user.email}</span>
        <input
          className="admin-user-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          placeholder="Add a title (optional)"
          aria-label={`Title for ${user.name}`}
          autoComplete="off"
          disabled={pending}
        />
      </div>

      <div className="admin-user-meta">
        <label className="admin-tier">
          <span className="admin-meta-label">Tier</span>
          <select
            value={role}
            onChange={(e) => changeRole(e.target.value)}
            disabled={pending || isYou}
            aria-label={`Tier for ${user.name}`}
          >
            {USER_ROLES.map((value) => (
              <option key={value} value={value}>
                {ROLE_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-tier">
          <span className="admin-meta-label">Team</span>
          <select
            value={user.organizationId ?? PERSONAL_WORKSPACE}
            onChange={(e) => changeTeam(e.target.value)}
            disabled={pending}
            aria-label={`Team for ${user.name}`}
          >
            <option value={PERSONAL_WORKSPACE}>Personal workspace</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </label>
        {role === "qaqc" ? (
          <label className="admin-tier">
            <span className="admin-meta-label">Stage reviewed</span>
            <select
              value={user.qaqcStage ?? NO_STAGE}
              onChange={(e) => changeStage(e.target.value)}
              disabled={pending}
              aria-label={`Stage reviewed by ${user.name}`}
            >
              <option value={NO_STAGE}>Not set</option>
              {QAQC_STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {QAQC_STAGE_LABELS[stage]}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="admin-status">
          <span className="admin-meta-label">Status</span>
          <span
            className={
              user.switchedOff ? "admin-pill admin-pill-off" : "admin-pill"
            }
          >
            {user.switchedOff ? "Switched off" : "Active"}
          </span>
        </div>
        <div className="admin-status">
          <span className="admin-meta-label">Last active</span>
          <span>{formatDay(user.lastActiveAt)}</span>
        </div>
      </div>

      <div className="admin-user-actions">
        {canView ? (
          <button
            type="button"
            className="admin-button"
            onClick={viewAs}
            disabled={pending}
            title={`Open CoreChain as ${user.name} sees it, without their password`}
          >
            View as
          </button>
        ) : null}
        <button
          type="button"
          className="admin-button"
          onClick={reset}
          disabled={pending}
        >
          Reset password
        </button>
        {!isYou ? (
          <button
            type="button"
            className="admin-button"
            onClick={toggleSwitchedOff}
            disabled={pending}
          >
            {user.switchedOff ? "Switch on" : "Switch off"}
          </button>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="form-error admin-user-error">
          {error}
        </p>
      ) : null}
    </li>
  );
}

function RequestsCard({
  requests,
  onUse,
}: {
  requests: RequestRow[];
  onUse: (request: RequestRow) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const dismiss = (id: string) => {
    setError(null);
    startTransition(async () => {
      const result = await dismissRequestAction(id);
      if (!result.ok) setError(result.error);
    });
  };

  return (
    <section className="admin-card" aria-labelledby="requests-title">
      <div className="admin-card-head">
        <h2 id="requests-title">Access requests</h2>
        <span className="admin-count">{requests.length}</span>
      </div>
      <p className="admin-hint">
        People who asked on the landing page to test CoreChain Field or to
        discuss a team pilot. Create their account, or dismiss the request.
      </p>
      <ul className="admin-users">
        {requests.map((request) => (
          <li className="admin-user" key={request.id}>
            <div className="admin-user-who">
              <span className="admin-user-name">{request.name}</span>
              <span className="admin-user-email">{request.email}</span>
              <span className="admin-user-email">{request.company}</span>
            </div>
            <div className="admin-status">
              <span className="admin-meta-label">Wants</span>
              <span>{request.interest}</span>
            </div>
            <div className="admin-status">
              <span className="admin-meta-label">Asked</span>
              <span>{formatDay(request.createdAt)}</span>
            </div>
            <div className="admin-user-actions">
              <button
                type="button"
                className="admin-button"
                onClick={() => onUse(request)}
              >
                Create account
              </button>
              <button
                type="button"
                className="admin-button"
                onClick={() => dismiss(request.id)}
                disabled={pending}
              >
                Dismiss
              </button>
            </div>
          </li>
        ))}
      </ul>
      {error ? (
        <p role="alert" className="form-error">
          {error}
        </p>
      ) : null}
    </section>
  );
}

export function UsersWorkspace({
  users,
  teams,
  requests,
  currentUserId,
  hasTester,
  initialSuggestion,
}: {
  users: UserRow[];
  teams: TeamRow[];
  requests: RequestRow[];
  currentUserId: string;
  hasTester: boolean;
  initialSuggestion: string;
}) {
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [everCopied, setEverCopied] = useStoredFlag(COPIED_KEY);
  // Choosing a request fills the add form; the key makes the form start afresh.
  const [prefill, setPrefill] = useState<{
    name: string;
    email: string;
    nonce: number;
  } | null>(null);

  const memberCounts = new Map<string, number>();
  for (const user of users) {
    if (!user.organizationId) continue;
    memberCounts.set(
      user.organizationId,
      (memberCounts.get(user.organizationId) ?? 0) + 1,
    );
  }

  // With no team yet, everyone is in the same personal-workspace bucket, so
  // a flat list reads fine. Once a team exists, group by team so the People
  // card doesn't read as one undifferentiated pile once there is more than
  // one workspace to keep straight.
  const personal = users.filter((user) => !user.organizationId);
  const userGroups =
    teams.length === 0
      ? [{ key: "all", label: null, users }]
      : [
          ...teams
            .map((team) => ({
              key: team.id,
              label: team.name,
              users: users.filter((user) => user.organizationId === team.id),
            }))
            .filter((group) => group.users.length > 0),
          { key: "personal", label: "Personal workspace", users: personal },
        ].filter((group) => group.users.length > 0);

  return (
    <div className="admin-columns">
      <div className="admin-list-column">
        <FirstRunChecklist hasTester={hasTester} everCopied={everCopied} />

        {credentials ? (
          <CredentialsCard
            // A fresh key per account remounts the card, so its own "Copied"
            // state resets instead of carrying over from whichever account
            // was created before this one.
            key={credentials.email}
            credentials={credentials}
            onDismiss={() => setCredentials(null)}
            onCopied={() => setEverCopied(true)}
          />
        ) : null}

        {requests.length > 0 ? (
          <RequestsCard
            requests={requests}
            onUse={(request) =>
              setPrefill({
                name: request.name,
                email: request.email,
                nonce: Date.now(),
              })
            }
          />
        ) : null}

        <TeamsCard teams={teams} memberCounts={memberCounts} />

        <section className="admin-card" aria-labelledby="people-title">
          <div className="admin-card-head">
            <h2 id="people-title">People</h2>
            <span className="admin-count">{users.length}</span>
          </div>
          {userGroups.map((group) => {
            const list = (
              <ul className="admin-users">
                {group.users.map((user) => (
                  <UserItem
                    key={user.id}
                    user={user}
                    teams={teams}
                    isYou={user.id === currentUserId}
                    onCredentials={setCredentials}
                  />
                ))}
              </ul>
            );
            if (!group.label) {
              return (
                <div className="admin-user-group" key={group.key}>
                  {list}
                </div>
              );
            }
            // Collapsed by default so a growing list of client teams stays a
            // list of names, not a page-length scroll; Personal workspace
            // starts open since that is usually who an admin is actively
            // setting up.
            return (
              <details
                className="admin-user-group"
                key={group.key}
                open={group.key === "personal"}
              >
                <summary className="admin-user-group-head">
                  <span className="admin-user-group-chevron" aria-hidden="true" />
                  <span>{group.label}</span>
                  <span className="admin-count">{group.users.length}</span>
                </summary>
                {list}
              </details>
            );
          })}
        </section>
      </div>

      <AddUserForm
        key={prefill?.nonce ?? 0}
        teams={teams}
        initialSuggestion={initialSuggestion}
        initialName={prefill?.name}
        initialEmail={prefill?.email}
        onCreated={(created) => {
          setPrefill(null);
          setCredentials(created);
        }}
      />
    </div>
  );
}
