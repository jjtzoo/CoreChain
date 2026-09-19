import { describe, expect, it } from "vitest";
import { buildDrillholeRegister } from "@/lib/demo/drillhole-register";
import { getAlbertaDemoDataset } from "@/lib/repositories/alberta-demo-repository";

describe("drillhole register presenter", () => {
  it("adds real linked-record counts without inventing missing source fields", async () => {
    const register = buildDrillholeRegister(await getAlbertaDemoDataset());
    const hole = register.find((row) => row.name === "200110-128");

    expect(register).toHaveLength(6);
    expect(hole?.intervalCount).toBe(4);
    expect(hole?.assayCount).toBeGreaterThan(0);
    expect(hole?.completenessLabel).toBe("Source fields incomplete");
  });
});
