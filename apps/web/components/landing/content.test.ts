import { describe, expect, it } from "vitest";
import { allLandingCopy } from "./content";

// The landing page is read by outsiders, so its wording has rules: nothing
// that overstates where CoreChain is, and the house style. This keeps the
// wording from drifting back after an edit.

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

const copy = strings(allLandingCopy);

describe("landing page copy", () => {
  it("has copy to check", () => {
    expect(copy.length).toBeGreaterThan(50);
  });

  it.each([
    ["an em-dash", /—/],
    ["offline-first as a pitch", /offline[- ]first/i],
    ["a final or modelling dataset", /final dataset|modell?ing (dataset|database)/i],
    ["Leapfrog or GEOVIA", /leapfrog|geovia/i],
    ["iOS or Google Play", /\biOS\b|iPhone|google play|play store/i],
    ["a public sign-up", /sign up free|create (an|your) account|start (a )?free trial/i],
    ["a count of testers, customers or teams", /\d+\s*(\+\s*)?(testers|customers|clients|teams|companies)/i],
    ["customer or production claims", /trusted by|customers use|in production|production[- ]proven|released on/i],
    ["automatic compliance", /pmrc[- ]compliant|makes? .* compliant|guarantees? compliance/i],
    ["hype words", /revolution|seamless|ai[- ]powered|transform your/i],
  ])("never contains %s", (_label, pattern) => {
    const hits = copy.filter((text) => pattern.test(text));
    expect(hits).toEqual([]);
  });

  it("says it is not released", () => {
    expect(copy.some((text) => /not yet released|not been released/i.test(text))).toBe(true);
  });
});
