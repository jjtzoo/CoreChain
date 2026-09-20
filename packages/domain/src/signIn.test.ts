import { describe, expect, it } from "vitest";
import {
  classifySignInFailure,
  signInFailureMessage,
  validateSignInInput,
} from "./signIn";

describe("classifySignInFailure", () => {
  it("treats no answer at all as a signal problem", () => {
    expect(classifySignInFailure(null)).toBe("network");
  });

  it("recognises a wrong email or password", () => {
    expect(classifySignInFailure(401, "INVALID_EMAIL_OR_PASSWORD")).toBe("invalid-credentials");
    expect(classifySignInFailure(401)).toBe("invalid-credentials");
  });

  it("recognises a switched-off account before any other 4xx", () => {
    expect(classifySignInFailure(403, "BANNED_USER")).toBe("banned");
  });

  it("recognises rate limiting", () => {
    expect(classifySignInFailure(429)).toBe("rate-limited");
  });

  it("calls anything else a server problem, not the person's fault", () => {
    expect(classifySignInFailure(500)).toBe("server");
    expect(classifySignInFailure(403, "SOMETHING_ELSE")).toBe("server");
  });
});

describe("signInFailureMessage", () => {
  it("says what to do next, and reassures that only sign-in needs signal", () => {
    expect(signInFailureMessage("network")).toContain("online to sign in");
    expect(signInFailureMessage("banned")).toContain("Ask your admin");
    expect(signInFailureMessage("invalid-credentials")).not.toMatch(/password (is )?wrong/i);
  });
});

describe("validateSignInInput", () => {
  it("accepts a normal email and any password", () => {
    expect(validateSignInInput("geologist1@corechain.test", "copper-gold-482")).toEqual({});
  });

  it("ignores spaces around the email", () => {
    expect(validateSignInInput("  a@b.co  ", "x")).toEqual({});
  });

  it("asks for what's missing", () => {
    expect(validateSignInInput("", "")).toEqual({
      email: "Enter your email.",
      password: "Enter your password.",
    });
  });

  it("flags something that isn't an email", () => {
    expect(validateSignInInput("not-an-email", "x").email).toMatch(/email address/);
    expect(validateSignInInput("a@b", "x").email).toMatch(/email address/);
  });
});
