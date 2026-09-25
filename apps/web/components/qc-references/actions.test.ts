import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Change register item 5: who may change the standards-and-blanks list, and
// that one team can never touch another team's lines. The database is a small
// in-memory stand-in for the few Prisma calls the actions make.

type User = { id: string; organizationId: string | null; role: string; qaqcStage: string | null };
type Line = { id: string; organizationId: string; reference: string; analyte: string; kind: string; [k: string]: unknown };

const db = vi.hoisted(() => ({
  users: new Map<string, User>(),
  lines: new Map<string, Line>(),
  signedIn: null as string | null,
  duplicate: false,
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/session", () => ({
  getSession: async () => (db.signedIn ? { user: { id: db.signedIn } } : null),
}));
vi.mock("@/lib/prisma", () => {
  const duplicateError = () =>
    new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "test",
    });
  return {
    prisma: {
      user: {
        findUnique: async ({ where }: { where: { id: string } }) => db.users.get(where.id) ?? null,
      },
      qcReferenceValue: {
        findUnique: async ({ where }: { where: { id: string } }) => db.lines.get(where.id) ?? null,
        create: async ({ data }: { data: Line }) => {
          if (db.duplicate) throw duplicateError();
          const line = { ...data, id: `line-${db.lines.size + 1}` };
          db.lines.set(line.id, line);
          return line;
        },
        update: async ({ where, data }: { where: { id: string }; data: Partial<Line> }) => {
          if (db.duplicate) throw duplicateError();
          const line = { ...db.lines.get(where.id)!, ...data };
          db.lines.set(where.id, line);
          return line;
        },
        deleteMany: async ({ where }: { where: { id: string; organizationId: string } }) => {
          const line = db.lines.get(where.id);
          if (!line || line.organizationId !== where.organizationId) return { count: 0 };
          db.lines.delete(where.id);
          return { count: 1 };
        },
      },
    },
  };
});

const { removeQcReferenceAction, saveQcReferenceAction } = await import("./actions");

const standard = {
  kind: "standard",
  reference: "OREAS 45e",
  analyte: "Cu",
  unit: "ppm",
  expectedValue: "742",
  standardDeviation: "20",
  maxValue: "",
};

beforeEach(() => {
  db.users.clear();
  db.lines.clear();
  db.duplicate = false;
  db.signedIn = null;
  db.users.set("pm", { id: "pm", organizationId: "org-a", role: "project_manager", qaqcStage: null });
  db.users.set("lab-qc", { id: "lab-qc", organizationId: "org-a", role: "qaqc", qaqcStage: "laboratory_assays" });
  db.users.set("core-qc", { id: "core-qc", organizationId: "org-a", role: "qaqc", qaqcStage: "core_logging" });
  db.users.set("geo", { id: "geo", organizationId: "org-a", role: "geologist", qaqcStage: null });
  db.users.set("lab", { id: "lab", organizationId: "org-a", role: "laboratory", qaqcStage: null });
  db.users.set("other-pm", { id: "other-pm", organizationId: "org-b", role: "project_manager", qaqcStage: null });
  db.users.set("no-team", { id: "no-team", organizationId: null, role: "project_manager", qaqcStage: null });
  db.lines.set("theirs", {
    id: "theirs",
    organizationId: "org-b",
    kind: "standard",
    reference: "OREAS 45e",
    analyte: "Cu",
  });
});

const as = (userId: string | null) => {
  db.signedIn = userId;
};

describe("saveQcReferenceAction", () => {
  it("lets the project manager and the laboratory QA/QC reviewer add a line for their own team", async () => {
    for (const user of ["pm", "lab-qc"]) {
      as(user);
      db.lines.clear();
      expect(await saveQcReferenceAction(standard, null)).toEqual({ ok: true });
      const [line] = [...db.lines.values()];
      expect(line).toMatchObject({ organizationId: "org-a", createdBy: user, reference: "OREAS 45e" });
    }
  });

  it("refuses everyone else, and anyone signed out or not on a team", async () => {
    for (const user of ["core-qc", "geo", "lab"]) {
      as(user);
      expect(await saveQcReferenceAction(standard, null)).toMatchObject({
        ok: false,
        error: expect.stringMatching(/Only the project manager/),
      });
    }
    as(null);
    expect(await saveQcReferenceAction(standard, null)).toEqual({ ok: false, error: "Sign in again." });
    as("no-team");
    expect(await saveQcReferenceAction(standard, null)).toMatchObject({ ok: false, error: expect.stringMatching(/team/) });
    expect(db.lines.size).toBe(1); // only the other team's line
  });

  it("never changes another team's line", async () => {
    as("pm");
    expect(await saveQcReferenceAction({ ...standard, expectedValue: "1" }, "theirs")).toEqual({
      ok: false,
      error: "That line isn't on your team's list.",
    });
    expect(db.lines.get("theirs")).not.toHaveProperty("expectedValue");
  });

  it("refuses values that aren't finite numbers, and a line with no unit", async () => {
    as("pm");
    for (const bad of [
      { expectedValue: "abc" },
      { expectedValue: "Infinity" },
      { expectedValue: "" },
      { standardDeviation: "0" },
      { standardDeviation: "-3" },
      { unit: " " },
    ]) {
      const outcome = await saveQcReferenceAction({ ...standard, ...bad }, null);
      expect(outcome.ok, JSON.stringify(bad)).toBe(false);
    }
    expect(
      await saveQcReferenceAction({ ...standard, kind: "blank", reference: "Blank", maxValue: "1e999" }, null),
    ).toMatchObject({ ok: false });
    expect(await saveQcReferenceAction({ ...standard, kind: "certificate" }, null)).toMatchObject({ ok: false });
  });

  it("explains a second line for the same standard and element (the database compares names without case)", async () => {
    as("pm");
    db.duplicate = true;
    expect(await saveQcReferenceAction({ ...standard, reference: "oreas 45E" }, null)).toEqual({
      ok: false,
      error: "oreas 45E already has a Cu line. Edit that one instead.",
    });
  });
});

describe("removeQcReferenceAction", () => {
  it("removes only the caller's own team's line, and only for an editor", async () => {
    as("pm");
    expect(await removeQcReferenceAction("theirs")).toEqual({
      ok: false,
      error: "That line isn't on your team's list.",
    });
    expect(db.lines.has("theirs")).toBe(true);

    as("other-pm");
    expect(await removeQcReferenceAction("theirs")).toEqual({ ok: true });

    db.lines.set("mine", { id: "mine", organizationId: "org-a", kind: "blank", reference: "Blank", analyte: "Cu" });
    as("core-qc");
    expect(await removeQcReferenceAction("mine")).toMatchObject({ ok: false });
    as(null);
    expect(await removeQcReferenceAction("mine")).toEqual({ ok: false, error: "Sign in again." });
    expect(db.lines.has("mine")).toBe(true);
  });
});
