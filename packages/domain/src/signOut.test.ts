import { describe, expect, it } from "vitest";
import { unsentItems, wipeWarning, type PhoneHoldings } from "./signOut";

const nothing: PhoneHoldings = {
  unsent: 0,
  refused: 0,
  photos: 0,
  feedback: 0,
};

describe("wipeWarning", () => {
  it("is calm when everything has reached the server", () => {
    const warning = wipeWarning(nothing);
    expect(warning.losesWork).toBe(false);
    expect(warning.confirmLabel).toBe("Sign out and remove");
    expect(warning.message).toContain("comes back when you sign in again");
  });

  it("names what would be lost, in numbers", () => {
    const warning = wipeWarning({
      unsent: 12,
      refused: 1,
      photos: 3,
      feedback: 2,
    });
    expect(warning.losesWork).toBe(true);
    expect(warning.confirmLabel).toBe("Remove anyway");
    expect(warning.message).toContain(
      "• 12 changes not sent to the server yet",
    );
    expect(warning.message).toContain("• 1 change the server did not accept");
    expect(warning.message).toContain("• 3 photos that are only on this phone");
    expect(warning.message).toContain("• 2 feedback messages not sent yet");
  });

  it("uses the singular for one", () => {
    expect(
      unsentItems({ ...nothing, unsent: 1, photos: 1, feedback: 1 }),
    ).toEqual([
      "1 change not sent to the server yet",
      "1 photo that is only on this phone",
      "1 feedback message not sent yet",
    ]);
  });

  it("lists nothing when nothing is at risk", () => {
    expect(unsentItems(nothing)).toEqual([]);
  });

  it("warns for photos alone while their files are not backed up", () => {
    expect(wipeWarning({ ...nothing, photos: 4 }).losesWork).toBe(true);
  });
});
