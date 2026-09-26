"use client";

// E18-2: the project manager's 3D evidence view. Where each hole runs, which
// intervals were sampled and what the laboratory returned, coloured by one
// element at a time. It interprets nothing: no surfaces, no grade shells.

import {
  analytesWithResults,
  depthStretchOptions,
  formatGrade,
  gradeScale,
  gradeSegments,
  projectViewLayout,
  type GradeSegment,
  type GradeState,
  type ProjectViewHole,
  type ProjectViewHoleInput,
  type ViewAssayResult,
  type ViewSample,
} from "@corechain/domain";
import type { Route } from "next";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { SceneHoleData } from "./scene";
import { GradeLegend } from "./grade-legend";
import { gridCellMetres } from "./view-frame";

const ProjectScene = dynamic(() => import("./scene"), {
  ssr: false,
  loading: () => <p className="pv-loading">Loading the 3D view…</p>,
});

export type ProjectViewSample = ViewSample & { status: string };

export type ProjectViewProps = {
  holes: ProjectViewHoleInput<SceneHoleData>[];
  samples: ProjectViewSample[];
  results: ViewAssayResult[];
  /** From "See in 3D" on a hole's page. */
  initialHoleId: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  planned: "Planned",
  drilling: "Drilling",
  complete: "Complete",
  logged: "Logged",
};

const STATUS_PILL_CLASS: Record<string, string> = {
  planned: "status-pill is-muted",
  drilling: "status-pill is-copper",
  complete: "status-pill is-muted",
  logged: "status-pill is-success",
};

const metres = (value: number) => `${value.toFixed(1)} m`;

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(REDUCED_MOTION);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
}

export function ProjectView({ holes, samples, results, initialHoleId }: ProjectViewProps) {
  const layout = useMemo(() => projectViewLayout(holes), [holes]);
  const analytes = useMemo(() => analytesWithResults(samples, results), [samples, results]);
  const stretches = useMemo(() => depthStretchOptions(layout.bounds), [layout.bounds]);
  const sampleStatus = useMemo(() => new Map(samples.map((s) => [s.id, s.status])), [samples]);
  const reduceMotion = usePrefersReducedMotion();

  const located = layout.holes.some((h) => h.id === initialHoleId) ? initialHoleId : null;
  const [analyteKey, setAnalyteKey] = useState(analytes[0]?.key ?? null);
  const [stretch, setStretch] = useState(stretches.initial);
  const [selectedHoleId, setSelectedHoleId] = useState<string | null>(located);
  const [focusHoleId, setFocusHoleId] = useState<string | null>(located);
  const [viewKey, setViewKey] = useState(0);
  const [resetDirection, setResetDirection] = useState(true);

  const analyte = analytes.find((a) => a.key === analyteKey) ?? analytes[0] ?? null;
  const segments = useMemo(
    () =>
      gradeSegments(
        samples,
        results,
        analyte ?? { key: "", label: "", unit: null, sampleCount: 0 },
      ),
    [samples, results, analyte],
  );
  const scale = useMemo(
    () =>
      gradeScale(
        segments.filter((s) => s.state === "result" && s.value != null).map((s) => s.value!),
      ),
    [segments],
  );
  const states = useMemo(() => new Set<GradeState>(segments.map((s) => s.state)), [segments]);

  const selectHole = useCallback((holeId: string) => {
    setSelectedHoleId(holeId);
    setFocusHoleId(holeId);
    setResetDirection(false);
    setViewKey((k) => k + 1);
  }, []);
  const showAll = () => {
    setSelectedHoleId(null);
    setFocusHoleId(null);
    setResetDirection(true);
    setViewKey((k) => k + 1);
  };
  // A new stretch changes how tall the holes are: frame them again, from where the camera is.
  const changeStretch = (next: number) => {
    setStretch(next);
    setResetDirection(false);
    setViewKey((k) => k + 1);
  };

  // Hover: the sample under the pointer, with the tooltip moved directly so
  // pointer moves don't re-render the scene.
  const stageRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<GradeSegment | null>(null);
  const onHover = useCallback((segment: GradeSegment | null, event?: PointerEvent) => {
    setHovered((current) => (current?.sampleId === segment?.sampleId ? current : segment));
    const tip = tipRef.current;
    const stage = stageRef.current;
    if (!tip || !stage || !segment || !event) return;
    const box = stage.getBoundingClientRect();
    const x = Math.min(event.clientX - box.left + 14, box.width - 220);
    tip.style.transform = `translate(${x}px, ${event.clientY - box.top + 14}px)`;
  }, []);

  if (holes.length === 0) {
    return (
      <section className="admin-card">
        <p className="admin-hint">
          No holes in this project yet. They appear here once a phone on the team syncs them.
        </p>
      </section>
    );
  }

  const holeById = new Map(layout.holes.map((h) => [h.id, h]));
  const selected = selectedHoleId ? holeById.get(selectedHoleId) : undefined;
  const hoveredHole = hovered ? holeById.get(hovered.drillholeId) : undefined;
  const cell = layout.bounds ? gridCellMetres(layout.bounds) : null;

  return (
    <>
      {layout.holes.length === 0 ? (
        <section className="admin-card">
          <p className="admin-hint">
            No collar recorded yet, so there is nothing to place. Collars come from the phone when a
            hole is set up; the holes are listed below.
          </p>
        </section>
      ) : (
        <section className="pv" aria-label="3D view of the project's holes">
          <div className="pv-toolbar">
            {analytes.length > 0 ? (
              <span className="pv-control">
                Colour by
                <span className="pv-seg" role="group" aria-label="Element">
                  {analytes.map((a) => (
                    <button
                      key={a.key}
                      type="button"
                      aria-pressed={a.key === analyte?.key}
                      onClick={() => setAnalyteKey(a.key)}
                    >
                      {a.label}
                      {a.unit ? ` ${a.unit}` : ""}
                    </button>
                  ))}
                </span>
              </span>
            ) : (
              <span className="pv-control">
                No laboratory results yet: samples are grey until the laboratory returns them.
              </span>
            )}
            <span className="pv-control">
              Depth stretch
              <span className="pv-seg" role="group" aria-label="Depth stretch">
                {stretches.options.map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={s === stretch}
                    onClick={() => changeStretch(s)}
                  >
                    {s}×
                  </button>
                ))}
              </span>
            </span>
            <span className="pv-spacer" />
            <button type="button" className="admin-button" onClick={showAll}>
              Show all holes
            </button>
          </div>

          <div className="pv-stage">
            <div className="pv-canvas" ref={stageRef}>
              <ProjectScene
                layout={layout}
                segments={segments}
                scale={scale}
                stretch={stretch}
                selectedHoleId={selectedHoleId}
                focusHoleId={focusHoleId}
                viewKey={viewKey}
                resetDirection={resetDirection}
                reduceMotion={reduceMotion}
                onHover={onHover}
                onSelectHole={selectHole}
              />
              <div className="pv-tip" ref={tipRef} hidden={!hovered} role="status">
                {hovered ? (
                  <>
                    <b>{hovered.sampleNumber}</b> · {hoveredHole?.holeId}
                    <br />
                    {hovered.fromM}–{hovered.toM} m
                    <br />
                    {describeGrade(hovered, analyte?.label ?? "", sampleStatus.get(hovered.sampleId))}
                  </>
                ) : null}
              </div>
              <p className="pv-caveat">
                Traces follow each hole&apos;s planned azimuth and dip; there is no downhole survey.
                Depths are below the collar{stretch > 1 ? `, stretched ${stretch}×` : ""}. Dashed
                traces run to the planned depth.{cell ? ` Grid squares are ${cell} m.` : ""}
              </p>
            </div>

            <aside className="pv-panel" aria-label={selected ? `Hole ${selected.holeId}` : "Holes"}>
              {selected ? (
                <HolePanel
                  hole={selected}
                  segments={segments.filter((s) => s.drillholeId === selected.id)}
                  analyteLabel={analyte?.label ?? null}
                  maxValue={scale?.high ?? null}
                  sampleStatus={sampleStatus}
                  onBack={showAll}
                />
              ) : (
                <>
                  <h2 className="pv-panel-title">Holes</h2>
                  <p className="pv-panel-meta">Choose a hole, or click one in the view.</p>
                  <ul className="pv-hole-list">
                    {layout.holes.map((hole) => {
                      const own = segments.filter((s) => s.drillholeId === hole.id);
                      const back = own.filter(
                        (s) => s.state !== "awaiting_results",
                      ).length;
                      return (
                        <li key={hole.id}>
                          <button type="button" onClick={() => selectHole(hole.id)}>
                            <span className="pv-hole-id">{hole.holeId}</span>
                            <span className="pv-hole-sub">
                              {own.length === 0
                                ? "No samples yet"
                                : `${own.length} samples, ${back} with results`}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </aside>
          </div>

          <GradeLegend analyte={analyte} scale={scale} states={states} />
        </section>
      )}

      {layout.unlocated.length > 0 ? (
        <section className="admin-card" aria-labelledby="unlocated-title">
          <div className="admin-card-head">
            <h2 id="unlocated-title">Not in the view: no collar recorded</h2>
            <span className="admin-count">{layout.unlocated.length}</span>
          </div>
          <p className="admin-hint">
            {layout.unlocated.map((hole, i) => (
              <span key={hole.id}>
                {i > 0 ? ", " : ""}
                <Link href={`/team/holes/${hole.id}` as Route} className="admin-link">
                  {hole.holeId}
                </Link>
              </span>
            ))}
          </p>
        </section>
      ) : null}
    </>
  );
}

function describeGrade(segment: GradeSegment, label: string, status: string | undefined): string {
  switch (segment.state) {
    case "result":
      return `${label} ${formatGrade(segment.value!, segment.unit)}`;
    case "below_detection":
      return segment.value != null
        ? `${label} below detection (< ${formatGrade(segment.value, segment.unit)})`
        : `${label} below detection`;
    case "not_analysed":
      return `Not analysed for ${label}`;
    case "not_comparable":
      return `${label} result can't be plotted`;
    case "awaiting_results":
      return status === "dispatched" ? "At the laboratory" : "Not dispatched yet";
  }
}

function HolePanel({
  hole,
  segments,
  analyteLabel,
  maxValue,
  sampleStatus,
  onBack,
}: {
  hole: ProjectViewHole<SceneHoleData>;
  segments: GradeSegment[];
  analyteLabel: string | null;
  maxValue: number | null;
  sampleStatus: Map<string, string>;
  onBack: () => void;
}) {
  const waiting = segments.filter((s) => s.state === "awaiting_results").length;
  const top = Math.max(
    maxValue ?? 0,
    ...segments.filter((s) => s.state === "result").map((s) => s.value ?? 0),
  );
  const status = hole.data.status;

  return (
    <>
      <button type="button" className="admin-link" onClick={onBack}>
        ← All holes
      </button>
      <h2 className="pv-panel-title">
        {hole.holeId}{" "}
        <span className={STATUS_PILL_CLASS[status] ?? "status-pill is-muted"}>
          {STATUS_LABELS[status] ?? status}
        </span>
      </h2>
      <p className="pv-panel-meta">
        {segments.length === 0
          ? "No samples yet"
          : `${segments.length} samples${waiting ? `, ${waiting} waiting for results` : ", all with results"}`}
      </p>
      <dl className="pv-facts">
        <dt>Azimuth</dt>
        <dd>{hole.azimuthDeg != null ? `${hole.azimuthDeg}°` : "Not recorded"}</dd>
        <dt>Dip</dt>
        <dd>{hole.inclinationDeg != null ? `${hole.inclinationDeg}°` : "Not recorded"}</dd>
        <dt>{hole.depthIsFinal ? "Final depth" : "Planned depth"}</dt>
        <dd>{hole.depthM > 0 ? metres(hole.depthM) : "Not recorded"}</dd>
        <dt>Collar</dt>
        <dd>
          {hole.collar!.latitude.toFixed(5)}, {hole.collar!.longitude.toFixed(5)}
        </dd>
      </dl>
      {!hole.directionKnown ? (
        <p className="pv-warning">Direction not recorded, so the hole is drawn vertical.</p>
      ) : null}
      {segments.length > 0 ? (
        <ul className="pv-rows">
          {segments.map((s) => (
            <li key={s.sampleId}>
              <span className="pv-depth">
                {s.fromM}–{s.toM}
              </span>
              {s.state === "result" && s.value != null ? (
                <span
                  className="pv-bar"
                  style={{ width: `${Math.max(3, top > 0 ? (100 * Math.min(s.value, top)) / top : 3)}%` }}
                />
              ) : (
                <span className="pv-row-note">
                  {s.state === "below_detection"
                    ? "Below detection"
                    : describeGrade(s, analyteLabel ?? "", sampleStatus.get(s.sampleId))}
                </span>
              )}
              <Link
                href={`/team/samples/${s.sampleId}` as Route}
                className="pv-value"
                title={s.sampleNumber}
              >
                {s.state === "result" && s.value != null
                  ? formatGrade(s.value, null)
                  : s.state === "below_detection"
                    ? "< DL"
                    : "–"}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      <Link href={`/team/holes/${hole.id}` as Route} className="admin-button pv-open">
        Open hole page
      </Link>
    </>
  );
}
