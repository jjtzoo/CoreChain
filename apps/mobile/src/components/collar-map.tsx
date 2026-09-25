import {
  collarMapLayout,
  describeFromHere,
  formatDistance,
  hereIsOnMap,
  loggingProgress,
  nearestPad,
  scaleBarMetres,
  toLocalMetres,
  type CollarMapHole,
  type CollarPad,
  type FieldDrillhole,
  type LatLon,
} from '@corechain/domain';
import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';

import { PrimaryButton } from '@/components/form/primary-button';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Icon, type IconName } from '@/components/ui/icon';
import { ProgressBar } from '@/components/ui/progress-bar';
import { StatusPill } from '@/components/ui/status-pill';
import { Fonts, MinTap, Radius, Spacing, type ThemeColor } from '@/constants/theme';
import type { Terrain } from '@/data/terrainFiles';
import { useTheme } from '@/hooks/use-theme';
import { statusLabel, statusTone } from '@/utils/status';

// E15-1: the project's collars on a plain grid, with each angled hole's trace
// seen from above, drawn with ordinary views (no map library, no map tiles),
// so it works with no signal and needs no new native code. See packages/domain/src/collarMap.ts for the geometry and
// docs/product/mockups/collar-map.html for the design.

const MAP_HEIGHT = 340;
/** Space kept clear around the collars when fitting them in. */
const FIT_PADDING = 48;
/** A lone collar (or a tight pad) is shown this many metres across. */
const MIN_SPAN_M = 150;
// The column of map buttons on the right. Fitting leaves it clear, so no
// collar sits behind a button.
const TOOLS_STRIP = MinTap + 2 * Spacing.two;
const MIN_SCALE = 0.002; // pixels per metre: about 170 km across
const MAX_SCALE = 20; // about 17 m across
const DOT = 18;
/** Half the length of the bar across the end of a hole's trace. */
const END_TICK = 6;
/** The usual colour of a "you are here" dot on any map. */
const HERE_COLOR = '#2F6FD6';

type HoleData = { hole: FieldDrillhole; progress: number };
type View2D = { scale: number; cx: number; cy: number };

const STATUS_DOT: Record<FieldDrillhole['status'], ThemeColor> = {
  planned: 'muted',
  drilling: 'text',
  complete: 'warning',
  logged: 'success',
};

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

/** The view that fits every collar in a map of this size. */
function fitBounds(
  bounds: { minX: number; minY: number; maxX: number; maxY: number } | null,
  width: number,
  height: number,
): View2D {
  const box = bounds ?? { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  const spanX = Math.max(box.maxX - box.minX, MIN_SPAN_M);
  const spanY = Math.max(box.maxY - box.minY, MIN_SPAN_M);
  const scale = clamp(
    Math.min((width - TOOLS_STRIP - 2 * FIT_PADDING) / spanX, (height - 2 * FIT_PADDING) / spanY),
    MIN_SCALE,
    MAX_SCALE,
  );
  return {
    scale,
    // Centred in the space left of the buttons.
    cx: (box.minX + box.maxX) / 2 + TOOLS_STRIP / 2 / scale,
    cy: (box.minY + box.maxY) / 2,
  };
}

function touchDistance(event: GestureResponderEvent): number | null {
  const touches = event.nativeEvent.touches;
  if (touches.length < 2) return null;
  return Math.hypot(
    touches[0]!.pageX - touches[1]!.pageX,
    touches[0]!.pageY - touches[1]!.pageY,
  );
}

function depthText(hole: FieldDrillhole, progress: number): string {
  const depth = `${hole.actualFinalDepthM ?? hole.plannedDepthM} m${
    hole.actualFinalDepthM == null ? ' planned' : ' final'
  }`;
  return `${depth} · ${Math.round(progress * 100)}% logged`;
}

function directionText(hole: FieldDrillhole): string | null {
  const parts = [
    hole.plannedAzimuthDeg != null ? `Azimuth ${hole.plannedAzimuthDeg}°` : null,
    hole.plannedInclinationDeg != null ? `dip ${hole.plannedInclinationDeg}°` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
}

/** A straight line between two points on the map, as a rotated bar. */
function Segment({
  from,
  to,
  color,
  thickness,
}: {
  from: { left: number; top: number };
  to: { left: number; top: number };
  color: string;
  thickness: number;
}) {
  const length = Math.hypot(to.left - from.left, to.top - from.top);
  const angle = Math.atan2(to.top - from.top, to.left - from.left);
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: (from.left + to.left) / 2 - length / 2,
        top: (from.top + to.top) / 2 - thickness / 2,
        width: length,
        height: thickness,
        borderRadius: thickness / 2,
        backgroundColor: color,
        transform: [{ rotate: `${angle}rad` }],
      }}
    />
  );
}

function MapButton({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.mapButton,
        {
          backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement,
          borderColor: theme.border,
        },
      ]}>
      <Icon name={icon} size={24} />
    </Pressable>
  );
}

export function CollarMap({
  drillholes,
  loggedMetres,
  onOpenHole,
  onGestureActive,
  terrain,
}: {
  drillholes: readonly FieldDrillhole[];
  /** Shaded relief and contours under the collars, when downloaded (E15-2). */
  terrain?: Terrain | null;
  loggedMetres: ReadonlyMap<string, number>;
  onOpenHole: (id: string) => void;
  /** True while a finger is on the map, so the screen can stop scrolling. */
  onGestureActive?: (active: boolean) => void;
}) {
  const theme = useTheme();

  const layout = useMemo(
    () =>
      collarMapLayout<HoleData>(
        drillholes.map((hole) => ({
          id: hole.id,
          holeId: hole.holeId,
          collar: hole.collar,
          plan: {
            azimuthDeg: hole.plannedAzimuthDeg,
            inclinationDeg: hole.plannedInclinationDeg,
            depthM: hole.actualFinalDepthM ?? hole.plannedDepthM,
          },
          data: { hole, progress: loggingProgress(loggedMetres.get(hole.id) ?? 0, hole) },
        })),
      ),
    [drillholes, loggedMetres],
  );

  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  // The geologist's own pan and zoom, kept for as long as the collars stay the
  // same (coming back from a hole keeps it). Otherwise the map fits them all.
  const boundsKey = JSON.stringify(layout.bounds);
  const [moved, setMoved] = useState<{ key: string; view: View2D } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [here, setHere] = useState<{ position: LatLon; accuracyM: number | null } | null>(null);
  const [locating, setLocating] = useState<'idle' | 'busy' | 'denied' | 'failed'>('idle');
  // Where the current drag or pinch started: the view then, and the finger
  // spread and offsets it is measured from.
  const [start, setStart] = useState<{
    view: View2D;
    pinch: number | null;
    dx: number;
    dy: number;
  } | null>(null);

  const fitted = size ? fitBounds(layout.bounds, size.width, size.height) : null;
  const view = moved && moved.key === boundsKey ? moved.view : fitted;
  const changeView = (update: (current: View2D) => View2D) => {
    if (!view) return;
    setMoved((current) => ({
      key: boundsKey,
      view: update(current && current.key === boundsKey ? current.view : view),
    }));
  };

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (!size || size.width !== width || size.height !== height) setSize({ width, height });
  };

  const locate = useCallback(async (ask: boolean) => {
    try {
      const permission = ask
        ? await Location.requestForegroundPermissionsAsync()
        : await Location.getForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setLocating(ask ? 'denied' : 'idle');
        return null;
      }
      setLocating('busy');
      const last = await Location.getLastKnownPositionAsync();
      if (last) {
        setHere({
          position: { latitude: last.coords.latitude, longitude: last.coords.longitude },
          accuracyM: last.coords.accuracy ?? null,
        });
      }
      const fix = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const found = {
        position: { latitude: fix.coords.latitude, longitude: fix.coords.longitude },
        accuracyM: fix.coords.accuracy ?? null,
      };
      setHere(found);
      setLocating('idle');
      return found;
    } catch {
      setLocating('failed');
      return null;
    }
  }, []);

  // Show "you are here" straight away if the app may already use the GPS;
  // otherwise wait for the geologist to press the button.
  useEffect(() => {
    void Location.getForegroundPermissionsAsync().then((permission) => {
      if (permission.status === 'granted') void locate(false);
    });
  }, [locate]);

  // Pan with one finger, pinch with two, measured from where the gesture
  // started (a second finger landing or lifting starts afresh). Taps fall
  // through to the collars.
  const responder = PanResponder.create({
    onMoveShouldSetPanResponder: (event, state) =>
      event.nativeEvent.touches.length > 1 || Math.abs(state.dx) > 6 || Math.abs(state.dy) > 6,
    onPanResponderGrant: (event, state) => {
      if (view) setStart({ view, pinch: touchDistance(event), dx: state.dx, dy: state.dy });
    },
    onPanResponderMove: (event, state) => {
      if (!start || !view) return;
      const distance = touchDistance(event);
      if ((distance == null) !== (start.pinch == null)) {
        setStart({ view, pinch: distance, dx: state.dx, dy: state.dy });
        return;
      }
      const factor = distance != null && start.pinch ? distance / start.pinch : 1;
      const scale = clamp(start.view.scale * factor, MIN_SCALE, MAX_SCALE);
      setMoved({
        key: boundsKey,
        view: {
          scale,
          cx: start.view.cx - (state.dx - start.dx) / scale,
          cy: start.view.cy + (state.dy - start.dy) / scale,
        },
      });
    },
    onPanResponderRelease: () => setStart(null),
    onPanResponderTerminate: () => setStart(null),
    onPanResponderTerminationRequest: () => false,
  });

  const zoom = (factor: number) =>
    changeView((current) => ({
      ...current,
      scale: clamp(current.scale * factor, MIN_SCALE, MAX_SCALE),
    }));

  const hereLocal =
    here && layout.centre && hereIsOnMap(here.position, layout)
      ? toLocalMetres(layout.centre, here.position)
      : null;

  const centreOnMe = async () => {
    const found = here ?? (await locate(true));
    if (!found || !layout.centre || !size) return;
    if (!hereIsOnMap(found.position, layout)) return;
    const point = toLocalMetres(layout.centre, found.position);
    changeView((current) => ({ ...current, cx: point.x, cy: point.y }));
    void locate(true);
  };

  const project = (x: number, y: number) =>
    size && view
      ? {
          left: size.width / 2 + (x - view.cx) * view.scale,
          top: size.height / 2 - (y - view.cy) * view.scale,
        }
      : null;

  // Grid lines every round number of metres, with a scale bar of the same length.
  const gridMetres = size && view ? scaleBarMetres((size.width * 0.28) / view.scale) : null;
  const gridLines = (() => {
    if (!size || !view || !gridMetres) {
      return { vertical: [] as number[], horizontal: [] as number[], step: 0 };
    }
    const step = gridMetres * view.scale;
    const firstX = Math.ceil((view.cx - size.width / 2 / view.scale) / gridMetres) * gridMetres;
    const firstY = Math.ceil((view.cy - size.height / 2 / view.scale) / gridMetres) * gridMetres;
    const vertical: number[] = [];
    const horizontal: number[] = [];
    for (let i = 0; i < 40; i += 1) {
      const left = size.width / 2 + (firstX + i * gridMetres - view.cx) * view.scale;
      if (left > size.width) break;
      vertical.push(left);
    }
    for (let i = 0; i < 40; i += 1) {
      const top = size.height / 2 - (firstY + i * gridMetres - view.cy) * view.scale;
      if (top < 0) break;
      horizontal.push(top);
    }
    return { vertical, horizontal, step };
  })();

  const holesById = new Map(
    layout.pads.flatMap((pad) => pad.holes.map((h) => [h.id, h.data.hole] as const)),
  );

  const selectedPad: CollarPad<HoleData> | undefined = layout.pads.find(
    (pad) => pad.key === selected,
  );
  const nearest = here ? nearestPad(here.position, layout) : null;

  if (layout.pads.length === 0) {
    return (
      <View style={styles.stack}>
        <Card style={styles.emptyMap}>
          <Icon name="map-marker-off-outline" size={32} themeColor="accent" />
          <ThemedText type="heading">No collar positions yet</ThemedText>
          <ThemedText type="default" themeColor="textSecondary">
            A hole appears on the map once its collar is recorded, by GPS or
            typed in, on the hole&apos;s screen.
          </ThemedText>
        </Card>
        <UnlocatedStrip holes={layout.unlocated} onOpenHole={onOpenHole} />
      </View>
    );
  }

  return (
    <View style={styles.stack}>
      <View
        style={[styles.map, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
        onLayout={onLayout}
        onTouchStart={() => onGestureActive?.(true)}
        onTouchEnd={() => onGestureActive?.(false)}
        onTouchCancel={() => onGestureActive?.(false)}
        {...responder.panHandlers}>
        {terrain && layout.centre
          ? (() => {
              const { south, west, north, east } = terrain.bounds;
              const nw = toLocalMetres(layout.centre, { latitude: north, longitude: west });
              const se = toLocalMetres(layout.centre, { latitude: south, longitude: east });
              const topLeft = project(nw.x, nw.y);
              const bottomRight = project(se.x, se.y);
              if (!topLeft || !bottomRight) return null;
              return (
                <Image
                  source={{ uri: terrain.uri }}
                  accessibilityIgnoresInvertColors
                  style={{
                    position: 'absolute',
                    left: topLeft.left,
                    top: topLeft.top,
                    width: bottomRight.left - topLeft.left,
                    height: bottomRight.top - topLeft.top,
                  }}
                  resizeMode="stretch"
                />
              );
            })()
          : null}

        {gridLines.vertical.map((left, i) => (
          <View
            key={`v${i}`}
            pointerEvents="none"
            style={[styles.gridV, { left, backgroundColor: theme.backgroundSelected }]}
          />
        ))}
        {gridLines.horizontal.map((top, i) => (
          <View
            key={`h${i}`}
            pointerEvents="none"
            style={[styles.gridH, { top, backgroundColor: theme.backgroundSelected }]}
          />
        ))}

        {layout.traces.map((trace) => {
          const from = project(trace.from.x, trace.from.y);
          const to = project(trace.to.x, trace.to.y);
          const hole = holesById.get(trace.id);
          if (!from || !to || !hole) return null;
          const color = theme[STATUS_DOT[hole.status]];
          // The tapped hole's trace stands out; the others step back.
          const onSelected = selectedPad?.holes.some((h) => h.id === trace.id) ?? false;
          const thickness = onSelected ? 5 : 3;
          const opacity = selectedPad && !onSelected ? 0.4 : 1;
          // A short bar across the end of the hole, as on a drill plan.
          const along = Math.hypot(to.left - from.left, to.top - from.top) || 1;
          const nx = -(to.top - from.top) / along;
          const ny = (to.left - from.left) / along;
          return (
            <View key={trace.id} pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity }]}>
              <Segment from={from} to={to} color={color} thickness={thickness} />
              <Segment
                from={{ left: to.left - nx * END_TICK, top: to.top - ny * END_TICK }}
                to={{ left: to.left + nx * END_TICK, top: to.top + ny * END_TICK }}
                color={color}
                thickness={thickness}
              />
            </View>
          );
        })}

        {hereLocal && here && view
          ? (() => {
              const at = project(hereLocal.x, hereLocal.y);
              if (!at) return null;
              const halo = Math.max(
                DOT,
                Math.min(160, 2 * (here.accuracyM ?? 0) * view.scale),
              );
              return (
                <View pointerEvents="none" style={[styles.hereWrap, { left: at.left, top: at.top }]}>
                  <View
                    style={[
                      styles.hereHalo,
                      {
                        width: halo,
                        height: halo,
                        borderRadius: halo / 2,
                        marginLeft: -halo / 2,
                        marginTop: -halo / 2,
                      },
                    ]}
                  />
                  <View style={[styles.hereDot, { borderColor: theme.backgroundElement }]} />
                </View>
              );
            })()
          : null}

        {layout.pads.map((pad) => {
          const at = project(pad.x, pad.y);
          if (!at) return null;
          const first = pad.holes[0]!.data.hole;
          const urgent = pad.holes.some((h) => h.data.hole.priority === 'urgent');
          const isSelected = pad.key === selected;
          const label =
            pad.holes.length > 1 ? `${first.holeId} +${pad.holes.length - 1}` : first.holeId;
          return (
            <Pressable
              key={pad.key}
              onPress={() => setSelected(isSelected ? null : pad.key)}
              accessibilityRole="button"
              accessibilityLabel={
                pad.holes.length > 1
                  ? `Pad with ${pad.holes.map((h) => h.holeId).join(', ')}`
                  : `Hole ${first.holeId}, ${statusLabel(first.status)}`
              }
              hitSlop={8}
              style={[styles.pad, { left: at.left - MinTap / 2, top: at.top - MinTap / 2 }]}>
              <View
                style={[
                  styles.dot,
                  isSelected && styles.dotSelected,
                  {
                    backgroundColor: theme[STATUS_DOT[first.status]],
                    borderColor: theme.backgroundElement,
                    outlineColor: urgent ? theme.danger : theme.text,
                  },
                  urgent && styles.dotUrgent,
                ]}>
                {pad.holes.length > 1 ? (
                  <View style={[styles.count, { backgroundColor: theme.text }]}>
                    <ThemedText style={[styles.countText, { color: theme.background }]}>
                      {pad.holes.length}
                    </ThemedText>
                  </View>
                ) : null}
              </View>
              <View
                style={[
                  styles.label,
                  { backgroundColor: isSelected ? theme.text : theme.backgroundElement },
                ]}>
                <ThemedText
                  numberOfLines={1}
                  style={[styles.labelText, { color: isSelected ? theme.background : theme.text }]}>
                  {label}
                </ThemedText>
              </View>
            </Pressable>
          );
        })}

        <View pointerEvents="none" style={styles.north}>
          <Icon name="navigation" size={18} />
          <ThemedText type="caption">N</ThemedText>
        </View>

        {gridMetres && gridLines.step ? (
          <View pointerEvents="none" style={styles.scale}>
            <View style={[styles.scaleBar, { width: gridLines.step, borderColor: theme.text }]} />
            <ThemedText type="caption" themeColor="textSecondary">
              {formatDistance(gridMetres)}
            </ThemedText>
          </View>
        ) : null}

        <View style={styles.tools}>
          <MapButton icon="fit-to-screen-outline" label="Fit all collars" onPress={() => setMoved(null)} />
          <MapButton icon="crosshairs-gps" label="Show where I am" onPress={() => void centreOnMe()} />
          <MapButton icon="plus" label="Zoom in" onPress={() => zoom(2)} />
          <MapButton icon="minus" label="Zoom out" onPress={() => zoom(0.5)} />
        </View>
      </View>

      <View style={styles.legend}>
        {(['planned', 'drilling', 'complete', 'logged'] as const).map((status) => (
          <View key={status} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: theme[STATUS_DOT[status]] }]} />
            <ThemedText type="small" themeColor="textSecondary">
              {statusLabel(status)}
            </ThemedText>
          </View>
        ))}
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: HERE_COLOR }]} />
          <ThemedText type="small" themeColor="textSecondary">
            You
          </ThemedText>
        </View>
        {terrain ? (
          <View style={styles.legendItem}>
            <View style={[styles.legendLine, { backgroundColor: theme.muted }]} />
            <ThemedText type="small" themeColor="textSecondary">
              Contours every 20 m
            </ThemedText>
          </View>
        ) : null}
        {layout.traces.length > 0 ? (
          <View style={styles.legendItem}>
            <View style={[styles.legendLine, { backgroundColor: theme.textSecondary }]} />
            <ThemedText type="small" themeColor="textSecondary">
              Planned direction, seen from above
            </ThemedText>
          </View>
        ) : null}
      </View>

      {terrain ? (
        <ThemedText type="caption" themeColor="textSecondary">
          Terrain: Copernicus DEM GLO-30 © DLR e.V. 2010–2014 and © Airbus Defence
          and Space GmbH 2014–2018, provided under COPERNICUS by the European Union
          and ESA.
        </ThemedText>
      ) : null}

      <ThemedText type="small" themeColor="textSecondary">
        {locating === 'busy' && !here
          ? 'Finding your position…'
          : locating === 'denied'
            ? 'Location is off for CoreChain, so your position isn’t shown. Allow it in the phone’s settings to see it.'
            : locating === 'failed' && !here
              ? 'Your position couldn’t be found. Try again in the open.'
              : nearest && here
                ? hereLocal
                  ? `Nearest collar: ${nearest.pad.holes[0]!.holeId}${
                      nearest.pad.holes.length > 1 ? ' pad' : ''
                    }, ${describeFromHere(here.position, nearest.pad.holes[0]!.collar!)}${
                      here.accuracyM != null ? ` (GPS ± ${Math.round(here.accuracyM)} m)` : ''
                    }`
                  : `You are ${formatDistance(nearest.metres)} from the nearest collar, too far to show on this map.`
                : 'Tap “Show where I am” to see your position. It needs GPS, not signal.'}
      </ThemedText>

      {selectedPad ? (
        <SelectedPad
          pad={selectedPad}
          here={here?.position ?? null}
          onOpenHole={onOpenHole}
        />
      ) : null}

      <UnlocatedStrip holes={layout.unlocated} onOpenHole={onOpenHole} />
    </View>
  );
}

function SelectedPad({
  pad,
  here,
  onOpenHole,
}: {
  pad: CollarPad<HoleData>;
  here: LatLon | null;
  onOpenHole: (id: string) => void;
}) {
  const theme = useTheme();
  const collar = pad.holes[0]!.collar!;
  const away = here ? describeFromHere(here, collar) : null;

  if (pad.holes.length === 1) {
    const { hole, progress } = pad.holes[0]!.data;
    return (
      <Card style={styles.selected}>
        <View style={styles.selectedTop}>
          <View style={styles.selectedTitle}>
            <ThemedText type="heading">{hole.holeId}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {depthText(hole, progress)}
            </ThemedText>
          </View>
          <View style={styles.pills}>
            {hole.priority === 'urgent' ? <StatusPill label="Urgent" tone="danger" /> : null}
            <StatusPill label={statusLabel(hole.status)} tone={statusTone(hole.status)} />
          </View>
        </View>
        <ProgressBar value={progress} label={`${hole.holeId} logging progress`} />
        {directionText(hole) ? (
          <ThemedText type="small" themeColor="textSecondary">
            {directionText(hole)}
          </ThemedText>
        ) : null}
        {hole.priority === 'urgent' && hole.priorityNote ? (
          <ThemedText type="small" themeColor="danger">
            {hole.priorityNote}
          </ThemedText>
        ) : null}
        <ThemedText type="small" themeColor="textSecondary">
          {[
            away,
            hole.collar
              ? `${hole.collar.source === 'gps' ? 'GPS' : 'Typed'} collar${
                  hole.collar.accuracyM != null ? ` ± ${Math.round(hole.collar.accuracyM)} m` : ''
                }`
              : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </ThemedText>
        <PrimaryButton label={`Open ${hole.holeId}`} onPress={() => onOpenHole(hole.id)} />
      </Card>
    );
  }

  return (
    <Card style={styles.selected}>
      <ThemedText type="caption" themeColor="textSecondary">
        {`PAD OF ${pad.holes.length} HOLES${away ? ` · ${away.toUpperCase()}` : ''}`}
      </ThemedText>
      {pad.holes.map(({ id, data: { hole, progress } }, index) => (
        <Pressable
          key={id}
          onPress={() => onOpenHole(id)}
          accessibilityRole="button"
          accessibilityLabel={`Open hole ${hole.holeId}`}
          style={({ pressed }) => [
            styles.padRow,
            index > 0 && { borderTopWidth: 1, borderTopColor: theme.border },
            pressed && { backgroundColor: theme.backgroundSelected },
          ]}>
          <View style={styles.selectedTitle}>
            <ThemedText type="smallBold" style={{ fontFamily: Fonts.mono }}>
              {hole.holeId}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {depthText(hole, progress)}
            </ThemedText>
          </View>
          {hole.priority === 'urgent' ? <StatusPill label="Urgent" tone="danger" /> : null}
          <StatusPill label={statusLabel(hole.status)} tone={statusTone(hole.status)} />
          <Icon name="chevron-right" size={22} themeColor="textSecondary" />
        </Pressable>
      ))}
    </Card>
  );
}

function UnlocatedStrip({
  holes,
  onOpenHole,
}: {
  holes: readonly CollarMapHole<HoleData>[];
  onOpenHole: (id: string) => void;
}) {
  const theme = useTheme();
  if (holes.length === 0) return null;
  return (
    <View style={styles.unlocated}>
      <ThemedText type="caption" themeColor="textSecondary">
        NO LOCATION YET · {holes.length}
      </ThemedText>
      <View style={styles.chips}>
        {holes.map((hole) => (
          <Pressable
            key={hole.id}
            onPress={() => onOpenHole(hole.id)}
            accessibilityRole="button"
            accessibilityLabel={`Open hole ${hole.holeId}, no collar position yet`}
            style={({ pressed }) => [
              styles.chip,
              {
                borderColor: theme.border,
                backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement,
              },
            ]}>
            <ThemedText type="smallBold" style={{ fontFamily: Fonts.mono }}>
              {hole.holeId}
            </ThemedText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: Spacing.two + 2,
  },
  map: {
    height: MAP_HEIGHT,
    borderWidth: 1,
    borderRadius: Radius.card,
    overflow: 'hidden',
  },
  gridV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
  },
  gridH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
  },
  pad: {
    position: 'absolute',
    width: MinTap,
    height: MinTap,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: 3,
    outlineWidth: 1.5,
    outlineStyle: 'solid',
  },
  dotSelected: {
    width: DOT + 6,
    height: DOT + 6,
    borderRadius: (DOT + 6) / 2,
  },
  dotUrgent: {
    outlineWidth: 3,
    outlineOffset: 2,
  },
  count: {
    position: 'absolute',
    top: -10,
    right: -14,
    minWidth: 18,
    paddingHorizontal: 4,
    borderRadius: Radius.pill,
    alignItems: 'center',
  },
  countText: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: 700,
  },
  label: {
    position: 'absolute',
    top: MinTap / 2 + DOT / 2 + 2,
    paddingHorizontal: 4,
    borderRadius: 4,
    maxWidth: 120,
  },
  labelText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: 700,
  },
  hereWrap: {
    position: 'absolute',
    width: 0,
    height: 0,
  },
  hereHalo: {
    position: 'absolute',
    backgroundColor: 'rgba(47, 111, 214, 0.18)',
  },
  hereDot: {
    position: 'absolute',
    width: 16,
    height: 16,
    marginLeft: -8,
    marginTop: -8,
    borderRadius: 8,
    borderWidth: 3,
    backgroundColor: HERE_COLOR,
  },
  north: {
    position: 'absolute',
    top: Spacing.two,
    left: Spacing.two + 2,
    alignItems: 'center',
  },
  scale: {
    position: 'absolute',
    left: Spacing.three,
    bottom: Spacing.two,
    gap: 2,
  },
  scaleBar: {
    height: 6,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderBottomWidth: 2,
  },
  tools: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
    gap: Spacing.two,
  },
  mapButton: {
    width: MinTap,
    height: MinTap,
    borderRadius: Radius.control,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: Spacing.three,
    rowGap: Spacing.one,
  },
  legendLine: {
    width: 16,
    height: 3,
    borderRadius: 1.5,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  selected: {
    gap: Spacing.two + 2,
  },
  selectedTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  selectedTitle: {
    flex: 1,
    gap: Spacing.half,
  },
  pills: {
    alignItems: 'flex-end',
    gap: Spacing.one,
  },
  padRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: MinTap + 8,
    paddingVertical: Spacing.two,
  },
  unlocated: {
    gap: Spacing.two,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    minHeight: MinTap,
    minWidth: MinTap,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: Radius.pill,
  },
  emptyMap: {
    gap: Spacing.two,
    paddingVertical: Spacing.four,
  },
});
