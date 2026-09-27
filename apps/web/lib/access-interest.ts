// What a landing-page access request is for: trying CoreChain Field as a
// tester, or evaluating it for a team. Stored on AccessRequest.interest.

export const ACCESS_INTERESTS = ["tester", "team"] as const;
export type AccessInterest = (typeof ACCESS_INTERESTS)[number];

export const ACCESS_INTEREST_LABELS: Record<AccessInterest, string> = {
  tester: "Tester",
  team: "Team pilot",
};

/** The interest a form value names, or null when it names neither. */
export function parseAccessInterest(value: unknown): AccessInterest | null {
  return typeof value === "string" && (ACCESS_INTERESTS as readonly string[]).includes(value)
    ? (value as AccessInterest)
    : null;
}

/** The stored interest, read back; anything unexpected counts as a team request. */
export function toAccessInterest(value: unknown): AccessInterest {
  return parseAccessInterest(value) ?? "team";
}
