import "server-only";

import { NextResponse } from "next/server";
import { auth } from "./auth";

// Shared plumbing for the phone's API routes: who is calling, and a few
// standard answers, so every route refuses and explains itself the same way.

export async function apiUser(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user ?? null;
}

export const signInRequired = () =>
  NextResponse.json({ error: "sign-in-required" }, { status: 401 });

export const badRequest = (error = "bad-request", extra: object = {}) =>
  NextResponse.json({ error, ...extra }, { status: 400 });

/** Reads a JSON object body, or returns null if it isn't one. */
export async function readJson(
  request: Request,
): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return body !== null && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
