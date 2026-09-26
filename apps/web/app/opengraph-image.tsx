import { ImageResponse } from "next/og";

// The picture shown when a CoreChain link is pasted into a message or a post
// (WhatsApp, Messenger, Facebook, LinkedIn, X, Slack, Teams). Next.js serves it
// at /opengraph-image and adds the og:image and twitter:image tags for every
// page. 1200 x 630 is the size all of them crop to without cutting the text.

export const alt =
  "CoreChain: core logging, sampling and chain of custody for exploration teams";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#182321";
const TEXT = "#3a4642";
const CANVAS = "#eeeae1";
const COPPER = "#a66a43";
const LINE = "#d6cfc0";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: CANVAS,
          color: INK,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <svg width="84" height="84" viewBox="0 0 512 512">
            <g fill={INK}>
              <path d="M176 72h280v88H190c-57 0-86 36-86 96s29 96 86 96h266v88H176C74 440 32 366 32 256S74 72 176 72Z" />
              <path d="M176 192h104v128H176c-39 0-56-25-56-64s17-64 56-64Z" />
              <path d="M304 192h88c40 0 56 25 56 64s-16 64-56 64h-88V192Z" />
            </g>
            <path
              d="M140 235c50 2 82 13 121 28 42 16 70 9 105 25 25 11 47 13 66 13"
              fill="none"
              stroke={COPPER}
              strokeWidth="11"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div style={{ fontSize: 52, fontWeight: 700, letterSpacing: "-0.02em" }}>
            CoreChain
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
          <div
            style={{
              fontSize: 70,
              fontWeight: 700,
              lineHeight: 1.08,
              letterSpacing: "-0.03em",
              maxWidth: 980,
            }}
          >
            One workflow, from the rig to the result.
          </div>
          <div style={{ fontSize: 32, lineHeight: 1.35, color: TEXT, maxWidth: 960 }}>
            Core logging, sampling and chain of custody for exploration teams.
            Hole, depth and sample number entered once and carried forward
            to the laboratory and QA/QC.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: 26,
            borderTop: `2px solid ${LINE}`,
            fontSize: 26,
            color: TEXT,
          }}
        >
          <div style={{ display: "flex" }}>Field app and team workspace</div>
          <div style={{ display: "flex", color: COPPER, fontWeight: 700 }}>
            Pilot access by request
          </div>
        </div>
      </div>
    ),
    size,
  );
}
