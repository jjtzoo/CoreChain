import { get, put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  checkScreenshotUpload,
  feedbackScreenshotKey,
  storageConfigured,
} from "@/lib/feedback/storage";
import { prisma } from "@/lib/prisma";
import { isUuid } from "@/lib/sync/coerce";

// E10-2: a screenshot attached to a feedback message. The phone sends it here
// (PUT) only after the message itself has been stored, so a screenshot never
// arrives for a message that doesn't exist. Only the account that sent the
// message can PUT or GET its screenshot. Kept in a private Vercel Blob store,
// the same as photo files — nothing is reachable by link.
export const maxDuration = 60;

const notConfigured = () =>
  NextResponse.json({ error: "storage-not-configured" }, { status: 503 });

async function ownedFeedback(feedbackId: string, userId: string) {
  return prisma.feedback.findFirst({
    where: { id: feedbackId, userId },
    select: { id: true },
  });
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ feedbackId: string }> },
) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "sign-in-required" }, { status: 401 });
  }
  const { feedbackId } = await context.params;
  if (!isUuid(feedbackId)) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  if (!storageConfigured(process.env)) return notConfigured();

  const lengthHeader = request.headers.get("content-length");
  const check = checkScreenshotUpload({
    contentType: request.headers.get("content-type"),
    contentLength: lengthHeader === null ? null : Number(lengthHeader),
  });
  if (!check.ok) {
    return NextResponse.json(
      { error: check.error },
      { status: check.error === "too-large" ? 413 : 400 },
    );
  }

  const feedback = await ownedFeedback(feedbackId, session.user.id);
  if (!feedback) {
    return NextResponse.json({ error: "feedback-not-found" }, { status: 404 });
  }

  const bytes = await request.arrayBuffer();
  if (lengthHeader !== null && bytes.byteLength !== Number(lengthHeader)) {
    return NextResponse.json({ error: "incomplete" }, { status: 400 });
  }
  const size = checkScreenshotUpload({
    contentType: check.contentType,
    contentLength: bytes.byteLength,
  });
  if (!size.ok) {
    return NextResponse.json(
      { error: size.error },
      { status: size.error === "too-large" ? 413 : 400 },
    );
  }

  const key = feedbackScreenshotKey({ userId: session.user.id, feedbackId });
  try {
    await put(key, Buffer.from(bytes), {
      access: "private",
      contentType: check.contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
    });
  } catch {
    return NextResponse.json({ error: "storage-failed" }, { status: 502 });
  }

  await prisma.feedback.update({
    where: { id: feedbackId },
    data: { storageKey: key },
  });
  return NextResponse.json({ ok: true });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ feedbackId: string }> },
) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "sign-in-required" }, { status: 401 });
  }
  const { feedbackId } = await context.params;
  if (!isUuid(feedbackId)) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  if (!storageConfigured(process.env)) return notConfigured();

  const isAdmin = session.user.role === "admin";
  const feedback = await prisma.feedback.findFirst({
    where: isAdmin ? { id: feedbackId } : { id: feedbackId, userId: session.user.id },
    select: { storageKey: true },
  });
  if (!feedback?.storageKey) {
    return NextResponse.json({ error: "feedback-not-found" }, { status: 404 });
  }

  const result = await get(feedback.storageKey, { access: "private" });
  if (result?.statusCode !== 200) {
    return NextResponse.json({ error: "feedback-not-found" }, { status: 404 });
  }

  return new NextResponse(result.stream, {
    headers: {
      "Content-Type": result.blob.contentType,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
