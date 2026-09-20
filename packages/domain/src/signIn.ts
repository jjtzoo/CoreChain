// E1-3: what the sign-in screen checks and says. Kept here, not in the app, so
// the wording is tested and stays the same everywhere. Messages are plain and
// never blame the person: a field geologist reading one at the rig needs to know
// what to do next, not what went wrong inside the server.

export type SignInFailure =
  | "invalid-credentials"
  | "network"
  | "rate-limited"
  | "banned"
  | "server";

const MESSAGES: Record<SignInFailure, string> = {
  "invalid-credentials": "That email or password isn't right. Check them and try again.",
  network:
    "Can't reach CoreChain. Check your signal and try again. You only need to be online to sign in.",
  "rate-limited": "Too many tries. Wait a minute, then try again.",
  banned: "This account has been switched off. Ask your admin.",
  server: "Something went wrong on our side. Try again in a moment.",
};

export function signInFailureMessage(failure: SignInFailure): string {
  return MESSAGES[failure];
}

/**
 * Turns what came back from the server into a failure kind. `status` is null
 * when there was no answer at all (no signal, server unreachable).
 */
export function classifySignInFailure(
  status: number | null,
  code?: string | null,
): SignInFailure {
  if (status === null) return "network";
  if (code === "BANNED_USER") return "banned";
  if (status === 401 || code === "INVALID_EMAIL_OR_PASSWORD") return "invalid-credentials";
  if (status === 429) return "rate-limited";
  return "server";
}

export type SignInErrors = { email?: string; password?: string };

/** Checks the form before anything is sent. An empty object means it can be sent. */
export function validateSignInInput(email: string, password: string): SignInErrors {
  const errors: SignInErrors = {};
  const trimmed = email.trim();
  if (trimmed.length === 0) {
    errors.email = "Enter your email.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    errors.email = "That doesn't look like an email address.";
  }
  if (password.length === 0) {
    errors.password = "Enter your password.";
  }
  return errors;
}
