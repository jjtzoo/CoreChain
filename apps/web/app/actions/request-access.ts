"use server";

import { parseAccessInterest } from "@/lib/access-interest";
import { prisma } from "@/lib/prisma";

export type RequestAccessState =
  | { status: "idle"; error: null }
  | { status: "error"; error: string }
  | { status: "sent"; error: null; email: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * An access request from the landing page, either to test CoreChain Field or
 * to discuss a pilot for a team. It only stores the request:
 * nothing is sent and no account is made. The admin sees it on the Users page
 * and creates the account (decision D13: the owner creates every account).
 *
 * The form is public, so it is kept cheap to abuse: fields have length limits,
 * a hidden field catches simple bots (they get the same "sent" answer, so they
 * learn nothing), and asking twice with the same email inside a day stores one
 * request.
 */
export async function requestAccessAction(
  _previous: RequestAccessState,
  formData: FormData,
): Promise<RequestAccessState> {
  const name = String(formData.get("name") ?? "").trim();
  const company = String(formData.get("company") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const interest = parseAccessInterest(formData.get("interest"));
  const trap = String(formData.get("website") ?? "");

  if (trap.length > 0) return { status: "sent", error: null, email };

  if (!interest) {
    return { status: "error", error: "Choose whether you want to test the app or discuss a pilot." };
  }

  if (name.length < 2 || name.length > 100) {
    return { status: "error", error: "Enter your name." };
  }
  if (company.length < 2 || company.length > 120) {
    return { status: "error", error: "Enter your company or project, or Independent." };
  }
  if (email.length > 200 || !EMAIL.test(email)) {
    return { status: "error", error: "Enter an email we can reply to." };
  }

  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recent = await prisma.accessRequest.findFirst({
      where: { email, createdAt: { gte: since } },
      select: { id: true },
    });
    if (!recent) {
      await prisma.accessRequest.create({ data: { name, company, email, interest } });
    }
  } catch {
    return {
      status: "error",
      error: "Something went wrong on our side. Please try again in a moment.",
    };
  }
  return { status: "sent", error: null, email };
}
