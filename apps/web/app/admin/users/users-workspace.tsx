"use client";

import {
  ROLE_LABELS,
  USER_ROLES,
  toUserRole,
  type UserRole,
} from "@corechain/domain";
import { useState, useTransition, type FormEvent } from "react";
import {
  createUserAction,
  resetPasswordAction,
  setRoleAction,
  setSwitchedOffAction,
  suggestPasswordAction,
} from "./actions";

export type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string | null;
  switchedOff: boolean;
  createdAt: string;
  lastActiveAt: string | null;
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
}: {
  credentials: Credentials;
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const text = `CoreChain\nEmail: ${credentials.email}\nPassword: ${credentials.password}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
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

function AddUserForm({
  initialSuggestion,
  onCreated,
}: {
  initialSuggestion: string;
  onCreated: (credentials: Credentials) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("geologist");
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
      const result = await createUserAction({ name, email, role, password });
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
      setRole("geologist");
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
  isYou,
  onCredentials,
}: {
  user: UserRow;
  isYou: boolean;
  onCredentials: (credentials: Credentials) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const role = toUserRole(user.role);

  const changeRole = (next: string) => {
    setError(null);
    startTransition(async () => {
      const result = await setRoleAction(user.id, next);
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

export function UsersWorkspace({
  users,
  currentUserId,
  initialSuggestion,
}: {
  users: UserRow[];
  currentUserId: string;
  initialSuggestion: string;
}) {
  const [credentials, setCredentials] = useState<Credentials | null>(null);

  return (
    <div className="admin-columns">
      <div className="admin-list-column">
        {credentials ? (
          <CredentialsCard
            credentials={credentials}
            onDismiss={() => setCredentials(null)}
          />
        ) : null}

        <section className="admin-card" aria-labelledby="people-title">
          <div className="admin-card-head">
            <h2 id="people-title">People</h2>
            <span className="admin-count">{users.length}</span>
          </div>
          <ul className="admin-users">
            {users.map((user) => (
              <UserItem
                key={user.id}
                user={user}
                isYou={user.id === currentUserId}
                onCredentials={setCredentials}
              />
            ))}
          </ul>
        </section>
      </div>

      <AddUserForm
        initialSuggestion={initialSuggestion}
        onCreated={setCredentials}
      />
    </div>
  );
}
