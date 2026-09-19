import { describe, expect, it } from "vitest";
import { albertaDemoProject } from "@/lib/demo/alberta-project";

describe("albertaDemoProject", () => {
  it("keeps the verified curated-data counts available to the workspace", () => {
    expect(albertaDemoProject.drillholeCount).toBe(6);
    expect(albertaDemoProject.intervalCount).toBe(27);
    expect(albertaDemoProject.assayCount).toBe(313);
  });

  it("keeps a source reference and a public provenance link", () => {
    expect(albertaDemoProject.sourceReference).toBe(
      "AER/AGS Digital Data 2024-0022",
    );
    expect(albertaDemoProject.sourceUrl).toMatch(/^https:\/\//);
  });
});
