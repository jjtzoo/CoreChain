// What to tell a geologist before their phone is wiped
// (docs/product/corechain-mobile-mvp-scrum-plan.md, Sprint 5: E1-5).
//
// Signing out and removing the data must never be a surprise. If anything is
// only on this phone, the warning lists it, in numbers, and defaults to keeping
// it. If everything is safe on the server, it says so, because that is what
// lets a geologist hand a phone back without worry.

/** What the phone holds that the server does not. */
export type PhoneHoldings = {
  /** Changes waiting to be sent to the server. */
  unsent: number;
  /** Changes the server refused and the geologist has not resolved. */
  refused: number;
  /** Photos whose image file exists only on this phone. */
  photos: number;
  /** Feedback messages written offline and not yet sent. */
  feedback: number;
};

export type WipeWarning = {
  title: string;
  message: string;
  /** True when removing the data would lose something. */
  losesWork: boolean;
  /** The label of the button that goes ahead. */
  confirmLabel: string;
};

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

/** The lines naming what would be lost, empty when nothing would be. */
export function unsentItems(holdings: PhoneHoldings): string[] {
  const items: string[] = [];
  if (holdings.unsent > 0) {
    items.push(
      `${plural(holdings.unsent, "change", "changes")} not sent to the server yet`,
    );
  }
  if (holdings.refused > 0) {
    items.push(
      `${plural(holdings.refused, "change", "changes")} the server did not accept`,
    );
  }
  if (holdings.photos > 0) {
    items.push(
      `${plural(holdings.photos, "photo", "photos")} that ${holdings.photos === 1 ? "is" : "are"} only on this phone`,
    );
  }
  if (holdings.feedback > 0) {
    items.push(
      `${plural(holdings.feedback, "feedback message", "feedback messages")} not sent yet`,
    );
  }
  return items;
}

export function wipeWarning(holdings: PhoneHoldings): WipeWarning {
  const items = unsentItems(holdings);
  if (items.length === 0) {
    return {
      title: "Sign out and remove your data?",
      message:
        "Your projects, logs and photos will be removed from this phone. Everything has reached the server, so it all comes back when you sign in again with signal.",
      losesWork: false,
      confirmLabel: "Sign out and remove",
    };
  }
  return {
    title: "Some of your work is only on this phone",
    message: `Removing your data now would lose:\n\n${items.map((item) => `• ${item}`).join("\n")}\n\nKeep the app open with signal to send what can be sent, or cancel and sign out without removing anything.`,
    losesWork: true,
    confirmLabel: "Remove anyway",
  };
}
