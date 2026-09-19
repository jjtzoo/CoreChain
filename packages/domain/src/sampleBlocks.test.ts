import { describe, expect, it } from "vitest";
import {
  DEFAULT_BLOCK_SIZE,
  findOverlaps,
  needsMoreNumbers,
  nextBlockRange,
  nextNumberFromBlocks,
  numbersLeft,
} from "./sampleBlocks";

describe("nextBlockRange", () => {
  it("starts at the project's first free number when nothing was issued", () => {
    expect(nextBlockRange([], 1)).toEqual({ start: 1, size: DEFAULT_BLOCK_SIZE });
  });

  it("starts after numbers the project used before it had a server", () => {
    // The offline alpha already used 1..24, so its next number is 25.
    expect(nextBlockRange([], 25)).toEqual({ start: 25, size: 100 });
  });

  it("starts after the highest block already issued, whichever device holds it", () => {
    const issued = [
      { start: 25, size: 100 },
      { start: 125, size: 50 },
    ];
    expect(nextBlockRange(issued, 25, 100)).toEqual({ start: 175, size: 100 });
  });

  it("never hands out a number below the project's own next number", () => {
    expect(nextBlockRange([{ start: 1, size: 10 }], 500).start).toBe(500);
  });

  it("issues blocks that never overlap, however many devices ask", () => {
    const issued: Array<{ start: number; size: number }> = [];
    for (let device = 0; device < 6; device++) {
      issued.push(nextBlockRange(issued, 1, 40 + device));
    }
    expect(findOverlaps(issued)).toEqual([]);
  });

  it("refuses nonsense sizes and start numbers", () => {
    expect(() => nextBlockRange([], 0)).toThrow(/first available/);
    expect(() => nextBlockRange([], 1, 0)).toThrow(/block size/);
    expect(() => nextBlockRange([], 1, 2.5)).toThrow(/block size/);
  });
});

describe("findOverlaps", () => {
  it("reports blocks that share a number", () => {
    const a = { start: 1, size: 10 };
    const b = { start: 10, size: 10 };
    const c = { start: 30, size: 5 };
    expect(findOverlaps([c, b, a])).toEqual([[a, b]]);
  });

  it("treats blocks that touch end to end as fine", () => {
    expect(
      findOverlaps([
        { start: 1, size: 10 },
        { start: 11, size: 10 },
      ]),
    ).toEqual([]);
  });
});

describe("using a device's blocks", () => {
  const blocks = [
    { start: 101, size: 5 },
    { start: 25, size: 3 },
  ];

  it("uses the lowest unused number across all its blocks", () => {
    expect(nextNumberFromBlocks(blocks, new Set())).toBe(25);
    expect(nextNumberFromBlocks(blocks, new Set([25, 26]))).toBe(27);
    expect(nextNumberFromBlocks(blocks, new Set([25, 26, 27]))).toBe(101);
  });

  it("skips numbers already used, even out of order (a typed pre-printed tag)", () => {
    expect(nextNumberFromBlocks(blocks, new Set([25, 27]))).toBe(26);
  });

  it("returns null when the device has run out", () => {
    const used = new Set([25, 26, 27, 101, 102, 103, 104, 105]);
    expect(nextNumberFromBlocks(blocks, used)).toBeNull();
  });

  it("counts the numbers left and warns when they run low", () => {
    expect(numbersLeft(blocks, new Set())).toBe(8);
    expect(numbersLeft(blocks, new Set([25, 101]))).toBe(6);
    expect(needsMoreNumbers(19)).toBe(true);
    expect(needsMoreNumbers(20)).toBe(false);
    expect(needsMoreNumbers(6, 5)).toBe(false);
  });
});
