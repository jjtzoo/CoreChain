import { describe, expect, it } from "vitest";
import {
  countBy,
  FEEDBACK_MAX_LENGTH,
  isFeedbackCategory,
  isFeedbackStatus,
  validateFeedback,
} from "./feedback";

describe("validateFeedback", () => {
  it("accepts a category and a real message", () => {
    expect(validateFeedback({ category: "bug", message: "The interval form loses my depth." })).toEqual({});
  });

  it("asks for a category", () => {
    expect(validateFeedback({ category: "", message: "Something happened here." }).category).toBeDefined();
    expect(validateFeedback({ category: "rant", message: "Something happened here." }).category).toBeDefined();
  });

  it("asks for more than a word or two, ignoring spaces", () => {
    expect(validateFeedback({ category: "idea", message: "   ok  " }).message).toBeDefined();
    expect(validateFeedback({ category: "idea", message: "" }).message).toBeDefined();
  });

  it("refuses a message that is too long", () => {
    const long = "x".repeat(FEEDBACK_MAX_LENGTH + 1);
    expect(validateFeedback({ category: "idea", message: long }).message).toMatch(/under/);
    expect(validateFeedback({ category: "idea", message: "x".repeat(FEEDBACK_MAX_LENGTH) })).toEqual({});
  });
});

describe("type guards", () => {
  it("knows the categories and statuses", () => {
    expect(isFeedbackCategory("bug")).toBe(true);
    expect(isFeedbackCategory("BUG")).toBe(false);
    expect(isFeedbackStatus("planned")).toBe(true);
    expect(isFeedbackStatus("closed")).toBe(false);
  });
});

describe("countBy", () => {
  const items = [
    { screen: "Core log" },
    { screen: "Samples" },
    { screen: "Core log" },
    { screen: "" },
    { screen: null },
    { screen: "Core log" },
  ];

  it("counts, most frequent first", () => {
    expect(countBy(items, (i) => i.screen).slice(0, 2)).toEqual([
      { key: "Core log", count: 3 },
      { key: "Unknown", count: 2 },
    ]);
  });

  it("breaks ties alphabetically so the order is stable", () => {
    expect(countBy([{ s: "b" }, { s: "a" }], (i) => i.s)).toEqual([
      { key: "a", count: 1 },
      { key: "b", count: 1 },
    ]);
  });
});
