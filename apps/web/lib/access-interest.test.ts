import { describe, expect, it } from "vitest";
import { parseAccessInterest, toAccessInterest } from "./access-interest";

describe("access request interest", () => {
  it("accepts the two choices the form offers", () => {
    expect(parseAccessInterest("tester")).toBe("tester");
    expect(parseAccessInterest("team")).toBe("team");
  });

  it("rejects anything else, so the form can ask again", () => {
    expect(parseAccessInterest("")).toBeNull();
    expect(parseAccessInterest("Tester")).toBeNull();
    expect(parseAccessInterest(null)).toBeNull();
    expect(parseAccessInterest("admin")).toBeNull();
  });

  it("reads an unexpected stored value as a team request", () => {
    expect(toAccessInterest("tester")).toBe("tester");
    expect(toAccessInterest("something")).toBe("team");
    expect(toAccessInterest(undefined)).toBe("team");
  });
});
