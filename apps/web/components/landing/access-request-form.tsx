"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  requestAccessAction,
  type RequestAccessState,
} from "@/app/actions/request-access";

const INITIAL: RequestAccessState = { status: "idle", error: null };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="lp-submit" disabled={pending}>
      {pending ? "Sending…" : "Request access"}
    </button>
  );
}

export function AccessRequestForm() {
  const [state, formAction] = useActionState(requestAccessAction, INITIAL);

  if (state.status === "sent") {
    return (
      <div className="lp-sent" role="status">
        <strong>Request received.</strong>
        <p>
          Thank you. We will write to {state.email} when there is a place for
          your team in the pilot.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="lp-form" noValidate>
      <label className="lp-field-row">
        <span>Name</span>
        <input name="name" autoComplete="name" required maxLength={100} />
      </label>
      <label className="lp-field-row">
        <span>Company or project</span>
        <input
          name="company"
          autoComplete="organization"
          required
          maxLength={120}
        />
      </label>
      <label className="lp-field-row">
        <span>Work email</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          maxLength={200}
        />
      </label>
      {/* A bot trap: people never see or fill this. */}
      <div className="lp-trap" aria-hidden="true">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      {state.status === "error" ? (
        <p className="lp-error" role="alert">
          {state.error}
        </p>
      ) : null}
      <Submit />
    </form>
  );
}
