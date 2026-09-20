import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { isUuid } from "./coerce";
import {
  insertStatement,
  matchStatement,
  prepareOperation,
  updateStatement,
  type Prepared,
} from "./prepare";
import { prisma } from "../prisma";

// E8-3, the server half of upload: apply the changes a phone made while it had
// no signal. Each change is checked (see prepare.ts), tied to the account that
// owns it, applied, and written to the audit log. Nothing is ever silently
// lost: a change that cannot be applied comes back with its reason, and two
// phones editing one record offline produce a recorded conflict, not an
// overwrite.

const MAX_OPS = 200;

export type OpStatus = "applied" | "duplicate" | "conflict" | "rejected";
export type OpResult = {
  id: string | null;
  table: string | null;
  status: OpStatus;
  reason?: string;
  detail?: string;
};

export type UploadOutcome =
  | { ok: true; results: OpResult[] }
  | {
      ok: false;
      reason:
        | "invalid"
        | "too-many-operations"
        | "device-not-found"
        | "device-revoked";
    };

type Tx = Prisma.TransactionClient;

const rejected = (
  id: string | null,
  table: string | null,
  reason: string,
  detail?: string,
): OpResult => ({
  id,
  table,
  status: "rejected",
  reason,
  ...(detail ? { detail } : {}),
});

/** Postgres error codes that mean "this operation is refused", not "the server broke". */
function describeDbError(error: unknown, table: string): string {
  const text = String(error);
  if (/\b23505\b/.test(text))
    return table === "samples" ? "duplicate-sample-number" : "duplicate-value";
  if (/\b23503\b/.test(text)) return "parent-not-found";
  if (/\b(23514|23P01|23502|22P02|22003)\b/.test(text)) return "constraint";
  return "error";
}

/**
 * The project a row belongs to, or null if there is no such row IN THIS
 * ORGANIZATION. It must be scoped: otherwise asking about someone else's record
 * would confirm that it exists.
 */
async function projectIdOf(
  tx: Tx,
  table: string,
  id: string,
  orgId: string,
): Promise<string | null> {
  const rows = await tx.$queryRawUnsafe<Array<{ project_id: string }>>(
    table === "projects"
      ? `SELECT id AS project_id FROM projects WHERE id = $1::uuid AND organization_id = $2`
      : `SELECT project_id FROM "${table}" WHERE id = $1::uuid AND organization_id = $2`,
    id,
    orgId,
  );
  return rows[0]?.project_id ?? null;
}

async function audit(
  tx: Tx,
  entry: {
    orgId: string;
    userId: string;
    deviceId: string;
    table: string;
    id: string;
    projectId: string | null;
    action: "put" | "patch" | "conflict";
    version: number | null;
    changes: Record<string, unknown>;
  },
) {
  await tx.auditEvent.create({
    data: {
      id: randomUUID(),
      organizationId: entry.orgId,
      projectId: entry.projectId,
      actorUserId: entry.userId,
      deviceId: entry.deviceId,
      entityTable: entry.table,
      entityId: entry.id,
      action: entry.action,
      fromVersion: null,
      toVersion: entry.version,
      changes: entry.changes as Prisma.InputJsonValue,
      occurredAt: new Date(),
    },
  });
}

async function applyPut(
  tx: Tx,
  ctx: { orgId: string; userId: string; deviceId: string },
  op: Extract<Prepared, { ok: true }>,
): Promise<OpResult> {
  const { spec, id, values } = op;
  const server: Record<string, unknown> = { organization_id: ctx.orgId };
  // The status history is the one table without created_by.
  if (spec.name !== "drillhole_status_history") server.created_by = ctx.userId;

  let projectId: string | null = spec.name === "projects" ? id : null;
  if (spec.parent === "project") {
    projectId = values.project_id as string;
    const owned = await tx.$queryRawUnsafe<unknown[]>(
      `SELECT 1 FROM projects WHERE id = $1::uuid AND organization_id = $2`,
      projectId,
      ctx.orgId,
    );
    if (owned.length === 0)
      return rejected(id, spec.name, "parent-not-found", "project_id");
    if (spec.name === "samples") {
      const hole = await tx.$queryRawUnsafe<unknown[]>(
        `SELECT 1 FROM drillholes WHERE id = $1::uuid AND project_id = $2::uuid AND organization_id = $3`,
        values.drillhole_id,
        projectId,
        ctx.orgId,
      );
      if (hole.length === 0)
        return rejected(id, spec.name, "parent-not-found", "drillhole_id");
    }
  } else if (spec.parent === "drillhole") {
    const hole = await tx.$queryRawUnsafe<Array<{ project_id: string }>>(
      `SELECT project_id FROM drillholes WHERE id = $1::uuid AND organization_id = $2`,
      values.drillhole_id,
      ctx.orgId,
    );
    if (hole.length === 0)
      return rejected(id, spec.name, "parent-not-found", "drillhole_id");
    projectId = hole[0].project_id;
    server.project_id = projectId;
  }

  const statement = insertStatement(spec, id, values, server);
  const inserted = await tx.$executeRawUnsafe(
    statement.sql,
    ...statement.params,
  );
  if (inserted === 1) {
    await audit(tx, {
      ...ctx,
      table: spec.name,
      id,
      projectId,
      action: "put",
      version: (values.version as number) ?? null,
      changes: values,
    });
    return { id, table: spec.name, status: "applied" };
  }

  // The id already exists: a retried upload, or someone else's row.
  const existing = await tx.$queryRawUnsafe<unknown[]>(
    `SELECT 1 FROM "${spec.name}" WHERE id = $1::uuid AND organization_id = $2`,
    id,
    ctx.orgId,
  );
  return existing.length > 0
    ? { id, table: spec.name, status: "duplicate" }
    : rejected(id, spec.name, "not-allowed");
}

async function applyPatch(
  tx: Tx,
  ctx: { orgId: string; userId: string; deviceId: string },
  op: Extract<Prepared, { ok: true }>,
): Promise<OpResult> {
  const { spec, id, values } = op;
  const update = updateStatement(spec, id, values, ctx.orgId);
  const changed = await tx.$executeRawUnsafe(update.sql, ...update.params);
  const projectId = await projectIdOf(tx, spec.name, id, ctx.orgId);

  if (changed === 1) {
    await audit(tx, {
      ...ctx,
      table: spec.name,
      id,
      projectId,
      action: "patch",
      version: values.version as number,
      changes: values,
    });
    return { id, table: spec.name, status: "applied" };
  }

  // Not applied: the row is missing or not ours, or it already has this version or a newer one.
  if (projectId === null) return rejected(id, spec.name, "not-found");
  const same = matchStatement(spec, id, values, ctx.orgId);
  const identical = await tx.$queryRawUnsafe<unknown[]>(
    same.sql,
    ...same.params,
  );
  if (identical.length > 0)
    return { id, table: spec.name, status: "duplicate" };

  // A different change at the same version or older: keep both. The server
  // keeps what it has; the incoming change is recorded in full for review.
  await audit(tx, {
    ...ctx,
    table: spec.name,
    id,
    projectId,
    action: "conflict",
    version: values.version as number,
    changes: values,
  });
  return {
    id,
    table: spec.name,
    status: "conflict",
    reason: "newer-version-on-server",
  };
}

export async function applyUpload(
  userId: string,
  input: { deviceId: unknown; ops: unknown },
): Promise<UploadOutcome> {
  if (!isUuid(input.deviceId) || !Array.isArray(input.ops))
    return { ok: false, reason: "invalid" };
  if (input.ops.length > MAX_OPS)
    return { ok: false, reason: "too-many-operations" };
  const deviceId = input.deviceId.toLowerCase();
  const operations: unknown[] = input.ops;

  const device = await prisma.device.findUnique({ where: { id: deviceId } });
  if (!device || device.userId !== userId)
    return { ok: false, reason: "device-not-found" };
  if (device.revokedAt) return { ok: false, reason: "device-revoked" };
  const ctx = { orgId: device.organizationId, userId, deviceId };

  const results = await prisma.$transaction(
    async (tx) => {
      const out: OpResult[] = [];
      for (const [index, raw] of operations.entries()) {
        const prepared = prepareOperation(raw);
        if (!prepared.ok) {
          const candidate = raw as { id?: unknown; table?: unknown } | null;
          out.push(
            rejected(
              typeof candidate?.id === "string" ? candidate.id : null,
              typeof candidate?.table === "string" ? candidate.table : null,
              prepared.reason,
              prepared.detail,
            ),
          );
          continue;
        }
        // Each operation gets its own savepoint: if it fails, only it is undone.
        const savepoint = `op_${index}`;
        await tx.$executeRawUnsafe(`SAVEPOINT ${savepoint}`);
        try {
          out.push(
            prepared.kind === "put"
              ? await applyPut(tx, ctx, prepared)
              : await applyPatch(tx, ctx, prepared),
          );
          await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${savepoint}`);
        } catch (error) {
          await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${savepoint}`);
          out.push(
            rejected(
              prepared.id,
              prepared.spec.name,
              describeDbError(error, prepared.spec.name),
            ),
          );
        }
      }
      await tx.device.update({
        where: { id: deviceId },
        data: { lastSeenAt: new Date() },
      });
      return out;
    },
    { timeout: 30_000, maxWait: 10_000 },
  );
  return { ok: true, results };
}
