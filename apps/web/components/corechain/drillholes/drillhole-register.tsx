"use client";

import Link from "next/link";
import type { Route } from "next";
import { ArrowUpRight, Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import type { DrillholeRegisterRow } from "@/lib/demo/drillhole-register";

type DrillholeRegisterProps = {
  projectId: string;
  records: readonly DrillholeRegisterRow[];
};

function displayValue(value: string | null) {
  return value ?? "Not recorded";
}

function displayMeasurement(value: number | null, suffix: string) {
  return value === null ? "Not recorded" : `${value.toFixed(1)}${suffix}`;
}

function drillholeHref(projectId: string, drillholeId: string): Route {
  return `/projects/${projectId}/drillholes/${drillholeId}` as Route;
}

export function DrillholeRegister({
  projectId,
  records,
}: DrillholeRegisterProps) {
  const [query, setQuery] = useState("");
  const [completenessFilter, setCompletenessFilter] = useState("all");

  const filteredRecords = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return records.filter((record) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        record.name.toLowerCase().includes(normalizedQuery) ||
        record.drillType?.toLowerCase().includes(normalizedQuery);
      const matchesCompleteness =
        completenessFilter === "all" ||
        record.completenessLabel === completenessFilter;

      return matchesQuery && matchesCompleteness;
    });
  }, [completenessFilter, query, records]);

  return (
    <section
      className="register-section"
      aria-labelledby="drillhole-register-title"
    >
      <div className="register-toolbar">
        <div>
          <p className="page-kicker">Drillhole register</p>
          <h1 id="drillhole-register-title">
            Review source records before interpretation.
          </h1>
          <p>
            Each record keeps its source reference. Missing source values stay
            visible as Not recorded.
          </p>
        </div>
        <div className="register-source-label">Public source data</div>
      </div>

      <div className="register-controls" aria-label="Drillhole filters">
        <label className="search-control">
          <Search aria-hidden="true" size={17} strokeWidth={1.5} />
          <span className="visually-hidden">Search drillholes</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search hole name or drill type"
            type="search"
          />
        </label>
        <label className="select-control">
          <SlidersHorizontal aria-hidden="true" size={16} strokeWidth={1.5} />
          <span className="visually-hidden">Filter by source completeness</span>
          <select
            value={completenessFilter}
            onChange={(event) => setCompletenessFilter(event.target.value)}
          >
            <option value="all">All source records</option>
            <option value="Source fields incomplete">
              Source fields incomplete
            </option>
            <option value="Source fields complete">
              Source fields complete
            </option>
          </select>
        </label>
        <p className="register-result-count" aria-live="polite">
          {filteredRecords.length} of {records.length} records
        </p>
      </div>

      {filteredRecords.length > 0 ? (
        <div className="register-table-wrap" tabIndex={0}>
          <table className="register-table">
            <thead>
              <tr>
                <th scope="col">Drillhole</th>
                <th scope="col">Drilling</th>
                <th scope="col">Final depth</th>
                <th scope="col">Reported orientation</th>
                <th scope="col">Linked evidence</th>
                <th scope="col">Source completeness</th>
                <th scope="col">
                  <span className="visually-hidden">Open record</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record) => (
                <tr key={record.id}>
                  <th scope="row">
                    <Link
                      className="record-link"
                      href={drillholeHref(projectId, record.id)}
                    >
                      {record.name}
                    </Link>
                    <span className="source-id">
                      AGS {record.provenance.sourceId}
                    </span>
                  </th>
                  <td>
                    <strong>{displayValue(record.drillType)}</strong>
                    <span>{displayValue(record.drillDate)}</span>
                  </td>
                  <td className="numeric-cell">
                    {displayMeasurement(record.finalDepthM, " m")}
                  </td>
                  <td>
                    <strong>
                      {displayMeasurement(
                        record.reportedAzimuthDeg,
                        " degrees",
                      )}
                    </strong>
                    <span>
                      {displayMeasurement(
                        record.reportedInclinationDeg,
                        " degrees",
                      )}
                    </span>
                  </td>
                  <td className="evidence-cell">
                    <strong>{record.intervalCount} intervals</strong>
                    <span>{record.assayCount} assay records</span>
                  </td>
                  <td>
                    <span className="completeness-status">
                      {record.completenessLabel}
                    </span>
                    <span>
                      {record.knownFieldCount} of {record.trackedFieldCount}{" "}
                      fields recorded
                    </span>
                  </td>
                  <td>
                    <Link
                      className="row-action"
                      href={drillholeHref(projectId, record.id)}
                      aria-label={`Open drillhole ${record.name}`}
                    >
                      <ArrowUpRight
                        aria-hidden="true"
                        size={17}
                        strokeWidth={1.5}
                      />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="register-empty" role="status">
          <h2>No drillholes match this view.</h2>
          <p>
            Clear the search or select all source records to see the import.
          </p>
        </div>
      )}
    </section>
  );
}
