"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { signInAction, type SignInState } from "./actions";

const INITIAL: SignInState = { error: null, email: "" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="auth-submit" disabled={pending}>
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}

export function LoginForm() {
  const [state, formAction] = useActionState(signInAction, INITIAL);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="auth-form" noValidate>
      <label className="field">
        <span className="field-label">Email</span>
        <input
          name="email"
          defaultValue={state.email}
          type="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          autoFocus
        />
      </label>

      <label className="field">
        <span className="field-label">Password</span>
        <span className="field-with-action">
          <input
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
          />
          <button
            type="button"
            className="field-toggle"
            onClick={() => setShowPassword((shown) => !shown)}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </span>
      </label>

      {state.error ? (
        <p role="alert" className="form-error">
          {state.error}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
