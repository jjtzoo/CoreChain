"use client";

import {
  FEEDBACK_CATEGORY_LABELS,
  FEEDBACK_STATUS_LABELS,
  FEEDBACK_STATUSES,
  ROLE_LABELS,
  isFeedbackCategory,
  toUserRole,
} from "@corechain/domain";
import { useState, useTransition } from "react";
import { updateFeedbackAction } from "./actions";

export type FeedbackRow = {
  id: string;
  who: string;
  email: string;
  tier: string;
  source: string;
  appVersion: string | null;
  device: string | null;
  screen: string | null;
  category: string;
  message: string;
  status: string;
  note: string | null;
  hasScreenshot: boolean;
  createdAt: string;
};

// Days and times in UTC, so the server and the browser print the same text.
function stamp(iso: string): string {
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

export function FeedbackItem({ item }: { item: FeedbackRow }) {
  const [status, setStatus] = useState(item.status);
  const [note, setNote] = useState(item.note ?? "");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const changed = status !== item.status || note.trim() !== (item.note ?? "");

  const save = () => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateFeedbackAction(item.id, status, note);
      if (result.ok) setSaved(true);
      else setError(result.error);
    });
  };

  const category = isFeedbackCategory(item.category)
    ? FEEDBACK_CATEGORY_LABELS[item.category]
    : item.category;

  return (
    <li className="fb-item" data-status={item.status}>
      <div className="fb-head">
        <span className="admin-pill">{category}</span>
        <span className="fb-who">
          {item.who}{" "}
          <span className="fb-muted">
            · {ROLE_LABELS[toUserRole(item.tier)]}
          </span>
        </span>
        <time className="fb-muted" dateTime={item.createdAt}>
          {stamp(item.createdAt)}
        </time>
      </div>

      <p className="fb-message">{item.message}</p>

      {item.hasScreenshot ? (
        // A private, cookie-authenticated route; next/image can't proxy that.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="fb-screenshot"
          src={`/api/feedback/${item.id}/screenshot`}
          alt={`Screenshot from ${item.who}'s message`}
        />
      ) : null}

      <p className="fb-context fb-muted">
        {[
          item.screen,
          item.appVersion ? `v${item.appVersion}` : null,
          item.device,
          item.source,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>

      <div className="fb-triage">
        <label className="admin-tier">
          <span className="admin-meta-label">Status</span>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setSaved(false);
            }}
            disabled={pending}
            aria-label={`Status for feedback from ${item.who}`}
          >
            {FEEDBACK_STATUSES.map((value) => (
              <option key={value} value={value}>
                {FEEDBACK_STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="fb-note">
          <span className="admin-meta-label">Note the tester can see</span>
          <input
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              setSaved(false);
            }}
            placeholder="For example: fixed in the next build"
            maxLength={1000}
            disabled={pending}
          />
        </label>
        <button
          type="button"
          className="admin-button"
          onClick={save}
          disabled={pending || !changed}
        >
          {pending ? "Saving…" : saved ? "Saved" : "Save"}
        </button>
      </div>
      {error ? (
        <p role="alert" className="form-error">
          {error}
        </p>
      ) : null}
    </li>
  );
}
