"use client";

// E18-2: the 3D scene. Loaded on the project page only (next/dynamic, no
// server render), so three.js never reaches any other page.
//
// Scene axes: x is east, z is south (-north), y is up; depth below the
// collar is drawn downwards, times the depth stretch. Rendering is on demand:
// a frame is drawn only when something changes.

import {
  gradeFraction,
  holePointAt,
  type GradeScale,
  type GradeSegment,
  type ProjectViewHole,
  type ProjectViewLayout,
  type ViewPoint,
} from "@corechain/domain";
import { Line, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { AWAITING_COLOR, BELOW_DETECTION_COLOR, VIEWPORT_BG, rampColor } from "./colors";
import { gridCellMetres, viewSpan } from "./view-frame";

export type SceneHoleData = { status: string };

export type SceneProps = {
  layout: ProjectViewLayout<SceneHoleData>;
  segments: readonly GradeSegment[];
  scale: GradeScale | null;
  /** Depth stretch. */
  stretch: number;
  selectedHoleId: string | null;
  /** The hole to fly to, or null for the whole project. */
  focusHoleId: string | null;
  /** A new value starts a flight to the focus. */
  viewKey: number;
  /** Whether that flight turns the camera back to the south-west view. */
  resetDirection: boolean;
  reduceMotion: boolean;
  onHover: (segment: GradeSegment | null, event?: PointerEvent) => void;
  onSelectHole: (holeId: string) => void;
};

/** The whole-project view looks from the south-west, from above. */
const HOME_DIRECTION = new THREE.Vector3(-250, 210, 300).normalize();

const toScene = (p: ViewPoint, stretch: number) =>
  new THREE.Vector3(p.x, -p.down * stretch, -p.y);

/** A point `depthM` along a hole, in scene units. */
function alongHole(hole: ProjectViewHole<SceneHoleData>, depthM: number, stretch: number) {
  const tip = holePointAt(hole, depthM);
  return toScene(
    { x: hole.origin.x + tip.x, y: hole.origin.y + tip.y, down: tip.down },
    stretch,
  );
}

type Frame = {
  centre: THREE.Vector3;
  /** Widest horizontal extent, metres. */
  span: number;
  /** Grid square, metres. */
  cell: number;
  /** Half-width of the grid, metres. */
  half: number;
  /** Cylinder radius, metres. */
  radius: number;
};

function frameFor(layout: ProjectViewLayout<SceneHoleData>): Frame {
  const b = layout.bounds!;
  const span = viewSpan(b);
  const cell = gridCellMetres(b);
  const half = Math.ceil((span * 0.7) / cell) * cell;
  return {
    centre: new THREE.Vector3((b.minX + b.maxX) / 2, 0, -(b.minY + b.maxY) / 2),
    span,
    cell,
    half,
    radius: Math.min(25, Math.max(0.6, span * 0.011)),
  };
}

type ControlsLike = { target: THREE.Vector3; update: () => void };

type View = { key: number; target: THREE.Vector3; distance: number; resetDirection: boolean };

/**
 * Flies the orbit target to `view.target` and the camera to `view.distance`
 * from it, keeping the current viewing direction unless asked to turn back to
 * the south-west view ("Show all holes", and the first view of all). A new `view.key` starts a flight; the first one,
 * or any with reduced motion, is placed at once. A change of depth stretch
 * moves the target up or down and carries the camera with it.
 */
function CameraRig({ view, reduceMotion }: { view: View; reduceMotion: boolean }) {
  const controls = useThree((s) => s.controls) as unknown as ControlsLike | null;
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const goal = useRef<{ target: THREE.Vector3; position: THREE.Vector3 } | null>(null);
  const placed = useRef(false);
  // The target height last applied, so a stretch change moves by the difference only.
  const appliedY = useRef(view.target.y);

  useEffect(() => {
    if (!controls) return;
    const target = view.target.clone();
    // The first placement has no viewing direction worth keeping.
    const direction = view.resetDirection || !placed.current
      ? HOME_DIRECTION.clone()
      : camera.position.clone().sub(controls.target).normalize();
    const position = target.clone().addScaledVector(direction, view.distance);
    appliedY.current = target.y;
    if (reduceMotion || !placed.current) {
      placed.current = true;
      controls.target.copy(target);
      camera.position.copy(position);
      controls.update();
      goal.current = null;
    } else {
      goal.current = { target, position };
    }
    invalidate();
    // Only a new request moves the camera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controls, view.key]);

  // A stretch change is applied on the next frame, to the camera and to any
  // flight under way.
  const shift = useRef(0);
  const targetY = view.target.y;
  useEffect(() => {
    if (!placed.current) return;
    shift.current += targetY - appliedY.current;
    appliedY.current = targetY;
    invalidate();
  }, [targetY, invalidate]);

  useFrame((_, delta) => {
    if (!controls) return;
    if (shift.current) {
      const up = new THREE.Vector3(0, shift.current, 0);
      shift.current = 0;
      controls.target.add(up);
      camera.position.add(up);
      goal.current?.target.add(up);
      goal.current?.position.add(up);
      controls.update();
    }
    const g = goal.current;
    if (!g) return;
    const k = 1 - Math.exp(-delta * 5);
    controls.target.lerp(g.target, k);
    camera.position.lerp(g.position, k);
    controls.update();
    const close = g.target.distanceTo(controls.target) + g.position.distanceTo(camera.position);
    if (close < 0.05) goal.current = null;
    else invalidate();
  });

  return null;
}

/** Fits a sphere of `radius` into the camera's narrower field of view. */
function useFitDistance() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  return (radius: number) => {
    const halfV = THREE.MathUtils.degToRad(camera.fov / 2);
    // Before the canvas is measured its size is 0; assume a landscape box.
    const aspect = size.width > 0 && size.height > 0 ? size.width / size.height : 1.5;
    const halfH = Math.atan(Math.tan(halfV) * aspect);
    return (radius * 1.08) / Math.sin(Math.min(halfV, halfH));
  };
}

const UP = new THREE.Vector3(0, 1, 0);
const scratch = {
  matrix: new THREE.Matrix4(),
  quaternion: new THREE.Quaternion(),
  scale: new THREE.Vector3(),
  colour: new THREE.Color(),
};

type Placed = { segment: GradeSegment; a: THREE.Vector3; b: THREE.Vector3; radius: number; colour: string };

/**
 * Every sample of one kind as one instanced mesh of unit cylinders, each
 * stretched from its from-depth to its to-depth along the hole. Hover and
 * click report the instance's sample.
 */
function SampleCylinders({
  items,
  outline,
  onHover,
  onSelectHole,
}: {
  items: Placed[];
  outline: boolean;
  onHover: SceneProps["onHover"];
  onSelectHole: SceneProps["onSelectHole"];
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const invalidate = useThree((s) => s.invalidate);
  const geometry = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, 14, 1), []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    items.forEach((item, i) => {
      const axis = item.b.clone().sub(item.a);
      // A small gap between samples so each one reads on its own.
      const length = Math.max(axis.length() - item.radius * 0.35, item.radius * 0.2);
      scratch.quaternion.setFromUnitVectors(UP, axis.normalize());
      scratch.scale.set(item.radius, length, item.radius);
      scratch.matrix.compose(item.a.clone().add(item.b).multiplyScalar(0.5), scratch.quaternion, scratch.scale);
      m.setMatrixAt(i, scratch.matrix);
      m.setColorAt(i, scratch.colour.set(item.colour));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
    invalidate();
  }, [items, invalidate]);

  if (items.length === 0) return null;
  const at = (e: ThreeEvent<PointerEvent | MouseEvent>) =>
    e.instanceId === undefined ? undefined : items[e.instanceId];

  return (
    <instancedMesh
      key={items.length}
      ref={mesh}
      args={[geometry, undefined, items.length]}
      onPointerMove={(e) => {
        e.stopPropagation();
        onHover(at(e)?.segment ?? null, e.nativeEvent);
      }}
      onPointerOut={() => onHover(null)}
      onClick={(e) => {
        e.stopPropagation();
        const item = at(e);
        if (item) onSelectHole(item.segment.drillholeId);
      }}
    >
      {outline ? (
        <meshBasicMaterial wireframe transparent opacity={0.55} />
      ) : (
        <meshBasicMaterial />
      )}
    </instancedMesh>
  );
}

function Ground({ frame }: { frame: Frame }) {
  const { centre, half, cell } = frame;
  const size = half * 2;
  // North arrow in the grid's south-west corner.
  const x0 = centre.x - half + cell * 0.5;
  const z0 = centre.z + half - cell * 0.5;
  const arrow = cell * 1.2;
  return (
    <group>
      <gridHelper args={[size, size / cell, "#2a3a37", "#1b2624"]} position={[centre.x, 0, centre.z]} />
      <Line
        points={[
          [x0, 0.05, z0],
          [x0, 0.05, z0 - arrow],
        ]}
        color="#d8d3c6"
        lineWidth={1.5}
      />
      <mesh position={[x0, 0.05, z0 - arrow]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[cell * 0.12, cell * 0.3, 3]} />
        <meshBasicMaterial color="#d8d3c6" />
      </mesh>
    </group>
  );
}

function HoleTrace({
  hole,
  stretch,
  selected,
  radius,
}: {
  hole: ProjectViewHole<SceneHoleData>;
  stretch: number;
  selected: boolean;
  radius: number;
}) {
  const top = toScene(hole.origin, stretch);
  const end = alongHole(hole, hole.depthM, stretch);
  return (
    <group>
      <mesh position={[top.x, 0.08, top.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius * 0.9, radius * 1.5, 32]} />
        <meshBasicMaterial color={selected ? "#eeeae1" : "#8b948f"} side={THREE.DoubleSide} />
      </mesh>
      {hole.depthM > 0 ? (
        <Line
          points={[top, end]}
          color={selected ? "#eeeae1" : "#6b736e"}
          lineWidth={selected ? 2 : 1.2}
          dashed={!hole.depthIsFinal}
          dashSize={radius * 2}
          gapSize={radius * 1.4}
          transparent
          opacity={selected ? 0.95 : 0.6}
        />
      ) : null}
    </group>
  );
}

type Label = { id: string; at: THREE.Vector3; className: string; content: ReactNode };

const projected = new THREE.Vector3();

/**
 * Plain DOM labels pinned to points in the scene: each frame projects the
 * anchors to the screen and moves the elements. (drei's <Html> makes a React
 * root per label, which fails to unmount cleanly under React 19 StrictMode.)
 */
function LabelProjector({
  labels,
  nodes,
}: {
  labels: Label[];
  nodes: React.RefObject<Map<string, HTMLDivElement>>;
}) {
  useFrame(({ camera, size }) => {
    for (const label of labels) {
      const el = nodes.current.get(label.id);
      if (!el) continue;
      projected.copy(label.at).project(camera);
      const x = (projected.x * 0.5 + 0.5) * size.width;
      const y = (-projected.y * 0.5 + 0.5) * size.height;
      el.style.transform = `translate(${x}px, ${y}px)`;
      el.style.visibility = projected.z > 1 ? "hidden" : "visible";
    }
  });
  return null;
}

function SceneContents(props: SceneProps & { labels: Label[]; labelNodes: React.RefObject<Map<string, HTMLDivElement>>; frame: Frame }) {
  const { layout, segments, scale, stretch, selectedHoleId, focusHoleId, viewKey, frame } = props;
  const fit = useFitDistance();
  const holeById = useMemo(() => new Map(layout.holes.map((h) => [h.id, h])), [layout.holes]);

  const [solid, outline] = useMemo(() => {
    const solidItems: Placed[] = [];
    const outlineItems: Placed[] = [];
    for (const segment of segments) {
      const hole = holeById.get(segment.drillholeId);
      if (!hole) continue;
      const radius = frame.radius * (segment.drillholeId === selectedHoleId ? 1.3 : 1);
      const a = alongHole(hole, segment.fromM, stretch);
      const b = alongHole(hole, segment.toM, stretch);
      if (segment.state === "result" && segment.value != null) {
        const t = scale ? gradeFraction(scale, segment.value) : 0.5;
        solidItems.push({ segment, a, b, radius, colour: rampColor(t) });
      } else if (segment.state === "awaiting_results") {
        solidItems.push({ segment, a, b, radius: radius * 0.8, colour: AWAITING_COLOR });
      } else if (segment.state === "below_detection") {
        outlineItems.push({ segment, a, b, radius, colour: BELOW_DETECTION_COLOR });
      }
      // Not analysed for this element, or not comparable: the trace shows through.
    }
    return [solidItems, outlineItems];
  }, [segments, holeById, frame.radius, selectedHoleId, stretch, scale]);

  const b = layout.bounds!;
  const focused = focusHoleId ? holeById.get(focusHoleId) : undefined;
  const view: View = useMemo(() => {
    if (focused && focused.depthM > 0) {
      const top = toScene(focused.origin, stretch);
      const end = alongHole(focused, focused.depthM, stretch);
      return {
        key: viewKey,
        target: top.clone().add(end).multiplyScalar(0.5),
        distance: fit(Math.max(top.distanceTo(end) * 0.6, frame.cell)),
        resetDirection: false,
      };
    }
    const depth = b.maxDown * stretch;
    const radius = Math.hypot(b.maxX - b.minX, b.maxY - b.minY, depth) / 2;
    return {
      key: viewKey,
      target: new THREE.Vector3(frame.centre.x, -depth / 2, frame.centre.z),
      distance: fit(Math.max(radius, frame.cell)),
      resetDirection: props.resetDirection,
    };
    // The distance is worked out when a flight starts; later resizes don't move the camera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewKey, focused, stretch, b, frame]);

  return (
    <>
      <color attach="background" args={[VIEWPORT_BG]} />
      <Ground frame={frame} />
      {layout.holes.map((hole) => (
        <HoleTrace
          key={hole.id}
          hole={hole}
          stretch={stretch}
          selected={hole.id === selectedHoleId}
          radius={frame.radius}
        />
      ))}
      <SampleCylinders items={solid} outline={false} onHover={props.onHover} onSelectHole={props.onSelectHole} />
      <SampleCylinders items={outline} outline onHover={props.onHover} onSelectHole={props.onSelectHole} />
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.12}
        minDistance={frame.radius * 6}
        maxDistance={frame.span * 6}
        maxPolarAngle={Math.PI * 0.62}
      />
      <CameraRig view={view} reduceMotion={props.reduceMotion} />
      <LabelProjector labels={props.labels} nodes={props.labelNodes} />
    </>
  );
}

export default function ProjectScene(props: SceneProps) {
  const { layout, stretch, selectedHoleId, onSelectHole } = props;
  const labelNodes = useRef(new Map<string, HTMLDivElement>());
  const frame = useMemo(() => frameFor(layout), [layout]);

  const labels: Label[] = [
    ...layout.holes.map((hole) => ({
      id: hole.id,
      at: toScene(hole.origin, stretch).setY(frame.radius * 1.5),
      className: hole.id === selectedHoleId ? "pv-label is-selected" : "pv-label",
      content: (
        <button type="button" tabIndex={-1} onClick={() => onSelectHole(hole.id)}>
          {hole.holeId}
        </button>
      ),
    })),
    {
      id: "north",
      at: new THREE.Vector3(
        frame.centre.x - frame.half + frame.cell * 0.5,
        0,
        frame.centre.z + frame.half - frame.cell * 0.5 - frame.cell * 1.75,
      ),
      className: "pv-note",
      content: "N",
    },
  ];
  const selected = layout.holes.find((h) => h.id === selectedHoleId);
  if (selected && selected.depthM > 0) {
    labels.push({
      id: "end-of-hole",
      at: alongHole(selected, selected.depthM, stretch),
      className: "pv-note is-end",
      content: `${selected.depthIsFinal ? "End of hole" : "Planned depth"} ${selected.depthM.toFixed(1)} m`,
    });
  }

  const far = frame.span * 40;
  return (
    <>
      <Canvas
        frameloop="demand"
        dpr={[1, 2]}
        camera={{ position: [0, frame.span, frame.span], fov: 40, near: Math.max(0.1, frame.span / 2000), far }}
        gl={{ antialias: true, powerPreference: "low-power" }}
        onPointerMissed={() => props.onHover(null)}
        fallback={<p className="pv-fallback">This browser can&apos;t draw the 3D view (WebGL is off or not supported).</p>}
      >
        <SceneContents {...props} frame={frame} labels={labels} labelNodes={labelNodes} />
      </Canvas>
      <div className="pv-labels" aria-hidden="true">
        {labels.map((label) => (
          <div
            key={label.id}
            className={label.className}
            ref={(el) => {
              if (el) labelNodes.current.set(label.id, el);
              else labelNodes.current.delete(label.id);
            }}
          >
            {label.content}
          </div>
        ))}
      </div>
    </>
  );
}
