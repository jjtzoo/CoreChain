"use client";

import type { QueueSample } from "@corechain/domain";
import { useRef, useState, type FormEvent } from "react";
import { receiveScannedSampleAction, type ScanResult } from "./actions";

export type QueueRow = QueueSample;

// Receive by scan. A USB or Bluetooth scanner types the tag and presses
// Enter, often faster than the server answers, so the box never locks:
// each scan joins a line and is checked in turn while the next bag is
// scanned. Only the hole and project are shown, never the depth or the
// sample type, so the standards and blanks the geologist inserted stay blind
// to the laboratory.

type ScanLine = {
  key: number;
  code: string;
  state: "checking" | "done" | "error";
  scan?: ScanResult;
  error?: string;
};

const MAX_LINES = 8;

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString([], {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ScanLineItem({ line }: { line: ScanLine }) {
  const scan = line.scan;
  let pill: { label: string; className: string };
  let detail: string;
  if (line.state === "checking") {
    pill = { label: "Checking…", className: "status-pill is-muted" };
    detail = "";
  } else if (line.state === "error" || !scan) {
    pill = { label: "Not recorded", className: "status-pill is-danger" };
    detail = line.error ?? "Try the scan again.";
  } else if (scan.outcome === "not_dispatched") {
    pill = { label: "Not on a dispatch", className: "status-pill is-danger" };
    detail = "Set the bag aside and tell the sender. It isn't on any batch sent to your team.";
  } else {
    pill =
      scan.outcome === "received"
        ? { label: "Received", className: "status-pill is-success" }
        : { label: "Already received", className: "status-pill is-copper" };
    detail = [
      `Hole ${scan.holeId}`,
      scan.projectName,
      scan.dispatchNumber,
      scan.outcome === "already_received" && scan.receivedAt
        ? `first received ${formatTime(scan.receivedAt)}`
        : null,
    ]
      .filter(Boolean)
      .join(" · ");
  }

  return (
    <li className={`scan-line${line.state === "checking" ? " is-checking" : ""}`}>
      <span className="scan-line-code">{scan?.sampleNumber ?? line.code}</span>
      <span className="scan-line-detail" suppressHydrationWarning>
        {detail}
      </span>
      <span className="scan-line-pills">
        {scan?.urgent ? <span className="status-pill is-danger">Urgent hole</span> : null}
        <span className={pill.className}>{pill.label}</span>
      </span>
    </li>
  );
}

export function ScanReceive() {
  const [code, setCode] = useState("");
  const [lines, setLines] = useState<ScanLine[]>([]);
  const [hint, setHint] = useState<string | null>(null);
  const nextKey = useRef(0);
  const chain = useRef<Promise<void>>(Promise.resolve());
  const input = useRef<HTMLInputElement>(null);

  const update = (key: number, patch: Partial<ScanLine>) =>
    setLines((current) => current.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const scanned = code.trim();
    if (!scanned) {
      setHint("Scan a bag tag, or type its sample number and press Enter.");
      return;
    }
    setHint(null);
    setCode("");
    input.current?.focus();
    const key = nextKey.current++;
    setLines((current) =>
      [{ key, code: scanned, state: "checking" as const }, ...current].slice(0, MAX_LINES),
    );
    chain.current = chain.current.then(async () => {
      try {
        const result = await receiveScannedSampleAction(scanned);
        if (result.ok) update(key, { state: "done", scan: result.scan });
        else update(key, { state: "error", error: result.error });
      } catch {
        update(key, { state: "error", error: "No connection. Scan the bag again." });
      }
    });
  };

  const receivedNow = lines.filter((l) => l.scan?.outcome === "received").length;

  return (
    <section className="admin-card" aria-labelledby="scan-title">
      <div className="admin-card-head">
        <h2 id="scan-title">Receive by scan</h2>
        {receivedNow > 0 ? (
          <span className="admin-count">{receivedNow} received</span>
        ) : null}
      </div>
      <form className="scan-form" onSubmit={submit} noValidate>
        <input
          ref={input}
          className="scan-input"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            if (hint) setHint(null);
          }}
          placeholder="Scan a bag tag or type the sample number"
          aria-label="Sample number"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          enterKeyHint="done"
          autoFocus
        />
        <button type="submit" className="auth-submit">
          Receive
        </button>
      </form>
      {hint ? (
        <p role="alert" className="form-error" style={{ margin: 0 }}>
          {hint}
        </p>
      ) : (
        <p className="admin-hint" style={{ margin: 0 }}>
          A USB or Bluetooth scanner types the tag and presses Enter; typing the
          number works the same way. Each bag is matched to its dispatch and
          recorded as received.
        </p>
      )}
      {lines.length > 0 ? (
        <ul className="scan-lines" aria-live="polite">
          {lines.map((line) => (
            <ScanLineItem key={line.key} line={line} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function PreparationQueue({ queue }: { queue: QueueRow[] }) {
  const urgent = queue.filter((s) => s.priority === "urgent").length;
  return (
    <section className="admin-card" aria-labelledby="queue-title" style={{ padding: 0, overflow: "hidden" }}>
      <div className="admin-card-head" style={{ padding: "16px 20px 0" }}>
        <h2 id="queue-title">Preparation queue</h2>
        <span className="admin-count">{queue.length}</span>
      </div>
      <p className="admin-hint" style={{ margin: 0, padding: "6px 20px 14px" }}>
        Received samples waiting for results. Holes the project manager flagged
        urgent come first{urgent > 0 ? ` (${urgent} sample${urgent === 1 ? "" : "s"} now)` : ""};
        then first received, first prepared.
      </p>
      {queue.length === 0 ? (
        <p className="admin-hint" style={{ margin: 0, padding: "0 20px 20px" }}>
          Nothing waiting. A bag joins the queue when it is received, and leaves
          it once its results are entered.
        </p>
      ) : (
        <div className="queue-table-wrap" style={{ margin: 0 }}>
          <table className="queue-table">
            <thead>
              <tr>
                <th style={{ width: 44 }}>#</th>
                <th>Sample</th>
                <th>Hole</th>
                <th>Dispatch</th>
                <th>Received</th>
              </tr>
            </thead>
            <tbody>
              {queue.map((sample, index) => (
                <tr key={`${sample.dispatchNumber}:${sample.sampleId}`}>
                  <td className="queue-table-number" style={{ color: "var(--muted)" }}>{index + 1}</td>
                  <td className="queue-table-name queue-table-number">{sample.sampleNumber}</td>
                  <td>
                    <span className="queue-hole">
                      {sample.holeId}
                      {sample.priority === "urgent" ? (
                        <span className="status-pill is-danger">Urgent</span>
                      ) : null}
                    </span>
                    {sample.priority === "urgent" && sample.priorityNote ? (
                      <span className="queue-note">{sample.priorityNote}</span>
                    ) : null}
                  </td>
                  <td className="queue-table-number">{sample.dispatchNumber}</td>
                  <td className="queue-table-number" suppressHydrationWarning>
                    {formatTime(sample.receivedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
