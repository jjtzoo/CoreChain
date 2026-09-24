import { describe, expect, it } from "vitest";
import { mergeSetCookies } from "./mergeSetCookies";

describe("mergeSetCookies", () => {
  it("writes new cookies over the request's and drops expired ones", () => {
    const merged = mergeSetCookies(
      "better-auth.session_token=viewed.sig; better-auth.admin_session=admin.sig; theme=dark",
      [
        "better-auth.session_token=admin.sig; Path=/; HttpOnly; SameSite=Lax",
        "better-auth.admin_session=; Max-Age=0; Path=/",
      ],
    );
    expect(merged).toBe("better-auth.session_token=admin.sig; theme=dark");
  });

  it("adds a cookie the request did not have, and copes with an empty header", () => {
    expect(mergeSetCookies("", ["a=1; Path=/"])).toBe("a=1");
    expect(mergeSetCookies("b=2", [])).toBe("b=2");
  });
});
