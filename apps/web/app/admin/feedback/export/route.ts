import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

// CSV of every feedback message, for the field-test review. Admin only.

function cell(value: string | null | undefined): string {
  const text = value ?? "";
  // Quote every cell, and defuse anything a spreadsheet would run as a formula.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function GET() {
  await requireAdmin();
  const rows = await prisma.feedback.findMany({
    orderBy: { createdAt: "asc" },
  });
  const people = await prisma.user.findMany({
    where: { id: { in: [...new Set(rows.map((row) => row.userId))] } },
    select: { id: true, name: true, email: true },
  });
  const byId = new Map(people.map((person) => [person.id, person]));

  const header = [
    "created_at_utc",
    "person",
    "email",
    "tier",
    "source",
    "app_version",
    "device",
    "screen",
    "category",
    "status",
    "message",
    "note",
  ];
  const lines = rows.map((row) =>
    [
      row.createdAt.toISOString(),
      byId.get(row.userId)?.name,
      byId.get(row.userId)?.email,
      row.tier,
      row.source,
      row.appVersion,
      row.device,
      row.screen,
      row.category,
      row.status,
      row.message,
      row.note,
    ]
      .map(cell)
      .join(","),
  );

  return new Response([header.map(cell).join(","), ...lines].join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="corechain-feedback.csv"',
    },
  });
}
