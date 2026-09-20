import { describe, expect, it } from "vitest";
import { PASSPHRASE_WORDS, suggestPassphrase } from "./passwords";

describe("suggestPassphrase", () => {
  it("is three words and three digits", () => {
    let calls = 0;
    const counter = (min: number, max: number) => min + (calls++ % (max - min));
    expect(suggestPassphrase(counter)).toMatch(/^[a-z]+-[a-z]+-[a-z]+-\d{3}$/);
  });

  it("uses the random source it is given, within range", () => {
    const seen: Array<[number, number]> = [];
    suggestPassphrase((min, max) => {
      seen.push([min, max]);
      return min;
    });
    expect(seen).toEqual([
      [0, PASSPHRASE_WORDS.length],
      [0, PASSPHRASE_WORDS.length],
      [0, PASSPHRASE_WORDS.length],
      [100, 1000],
    ]);
  });

  it("is long enough for the server's minimum and has no look-alike or odd characters", () => {
    const longest = suggestPassphrase((_min, max) => max - 1);
    expect(longest.length).toBeGreaterThanOrEqual(10);
    expect(longest).toMatch(/^[a-z0-9-]+$/);
  });

  it("keeps the word list short, lowercase and free of duplicates", () => {
    expect(new Set(PASSPHRASE_WORDS).size).toBe(PASSPHRASE_WORDS.length);
    for (const word of PASSPHRASE_WORDS) {
      expect(word).toMatch(/^[a-z]{2,7}$/);
    }
  });
});
