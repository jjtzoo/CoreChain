import { describe, expect, it, vi } from "vitest";
import {
  buildFeedbackEmail,
  feedbackEmailConfig,
  sendFeedbackEmail,
  type FeedbackEmailInput,
} from "./email";

const item: FeedbackEmailInput = {
  id: "0b6f1d2e-9a57-4c1e-8f53-3f0f5c1a2b3c",
  category: "bug",
  message: "The box number resets after <saving>\nSecond line",
  tier: "geologist",
  source: "android",
  appVersion: "0.1.0",
  device: "Infinix X6873",
  screen: "/projects/p1/holes/h1/boxes",
  createdAt: new Date("2026-09-25T10:15:00Z"),
  person: { name: "Ana Reyes", email: "ana@example.com" },
};

const config = {
  apiKey: "re_test",
  to: "owner@example.com",
  from: "CoreChain feedback <onboarding@resend.dev>",
  site: "https://corechain-orpin.vercel.app",
};

describe("feedbackEmailConfig", () => {
  it("is off until both the key and the address are set", () => {
    expect(feedbackEmailConfig({})).toBeNull();
    expect(feedbackEmailConfig({ RESEND_API_KEY: "re_x" })).toBeNull();
    expect(feedbackEmailConfig({ FEEDBACK_NOTIFY_EMAIL: "a@b.c" })).toBeNull();
    expect(
      feedbackEmailConfig({
        RESEND_API_KEY: "re_x",
        FEEDBACK_NOTIFY_EMAIL: "a@b.c",
        BETTER_AUTH_URL: "https://example.org/",
      }),
    ).toEqual({
      apiKey: "re_x",
      to: "a@b.c",
      from: "CoreChain feedback <onboarding@resend.dev>",
      site: "https://example.org",
    });
  });
});

describe("buildFeedbackEmail", () => {
  it("says who sent what, from where, and links to the inbox", () => {
    const email = buildFeedbackEmail(item, config.site);
    expect(email.subject).toBe("Problem from Ana Reyes: The box number resets after <saving>…");
    expect(email.text).toContain("Role: Field geologist");
    expect(email.text).toContain("Sent from: Android app");
    expect(email.text).toContain("Screen: /projects/p1/holes/h1/boxes");
    expect(email.text).toContain("Received: 2026-09-25 10:15 UTC");
    expect(email.text).toContain("https://corechain-orpin.vercel.app/admin/feedback");
  });

  it("escapes the tester's words in the HTML", () => {
    const { html } = buildFeedbackEmail(item, config.site);
    expect(html).toContain("resets after &lt;saving&gt;");
    expect(html).not.toContain("<saving>");
  });
});

describe("sendFeedbackEmail", () => {
  it("does nothing when notifications are off", async () => {
    const fetchImpl = vi.fn();
    expect(await sendFeedbackEmail(item, null, fetchImpl)).toBe("off");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("posts one email to Resend, keyed so a retry cannot send it twice", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    expect(await sendFeedbackEmail(item, config, fetchImpl)).toBe("sent");
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers["Idempotency-Key"]).toBe(`feedback-${item.id}`);
    expect(init.headers.Authorization).toBe("Bearer re_test");
    expect(JSON.parse(init.body)).toMatchObject({ to: ["owner@example.com"] });
  });

  it("never throws when Resend refuses or the network fails", async () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const refused = vi.fn().mockResolvedValue(new Response("{}", { status: 403 }));
    expect(await sendFeedbackEmail(item, config, refused)).toBe("failed");
    const offline = vi.fn().mockRejectedValue(new Error("network down"));
    expect(await sendFeedbackEmail(item, config, offline)).toBe("failed");
    quiet.mockRestore();
  });
});
