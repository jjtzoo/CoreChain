import { toUserRole, validateFeedback } from "@corechain/domain";
import { NextResponse, after } from "next/server";
import { auth } from "@/lib/auth";
import { sendFeedbackEmail } from "@/lib/feedback/email";
import { prisma } from "@/lib/prisma";

// Feedback from the phone app. The phone signs in with the same cookie session
// it uses for everything else, queues a message offline, and retries until this
// answers. `clientId` (made on the phone) makes a retry harmless: the same
// message is stored once, and the owner is emailed once, after the answer.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PER_HOUR_LIMIT = 30;

function text(value: unknown, max: number): string | null {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, max)
    : null;
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "sign-in-required" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }

  const category = typeof body.category === "string" ? body.category : "";
  const message = typeof body.message === "string" ? body.message : "";
  const problems = validateFeedback({ category, message });
  if (problems.category || problems.message) {
    return NextResponse.json({ error: "invalid", problems }, { status: 400 });
  }

  const clientId =
    typeof body.clientId === "string" && UUID.test(body.clientId)
      ? body.clientId
      : null;
  if (clientId) {
    const existing = await prisma.feedback.findUnique({
      where: { clientId },
      select: { id: true },
    });
    if (existing)
      return NextResponse.json({ ok: true, id: existing.id, duplicate: true });
  }

  const recent = await prisma.feedback.count({
    where: {
      userId: session.user.id,
      createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
    },
  });
  if (recent >= PER_HOUR_LIMIT) {
    return NextResponse.json({ error: "rate-limited" }, { status: 429 });
  }

  const created = await prisma.feedback.create({
    data: {
      clientId,
      userId: session.user.id,
      tier: toUserRole(session.user.role),
      source: body.source === "web" ? "web" : "android",
      appVersion: text(body.appVersion, 40),
      device: text(body.device, 120),
      screen: text(body.screen, 120),
      category,
      message: message.trim(),
    },
    select: {
      id: true,
      category: true,
      message: true,
      tier: true,
      source: true,
      appVersion: true,
      device: true,
      screen: true,
      createdAt: true,
    },
  });
  const person = { name: session.user.name, email: session.user.email };
  after(() => sendFeedbackEmail({ ...created, person }));
  return NextResponse.json({ ok: true, id: created.id }, { status: 201 });
}

/** The signed-in person's own feedback, with what the admin answered. */
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "sign-in-required" }, { status: 401 });
  }
  const items = await prisma.feedback.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      category: true,
      message: true,
      status: true,
      note: true,
      createdAt: true,
    },
  });
  return NextResponse.json({ items });
}
