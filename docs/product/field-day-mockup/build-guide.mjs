// Builds the "A day in the field" test guide (HTML, then PDF through Chrome).
//
// Every table is drawn from packages/domain/src/fixtures/mb-ddh-001.json,
// the same data packages/domain/src/field-day.test.ts checks against the
// app's own rules, so the guide cannot ask a tester to type something the app
// would refuse.
//
// Run:  node docs/product/field-day-mockup/build-guide.mjs

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const day = JSON.parse(
  readFileSync(join(here, '../../../packages/domain/src/fixtures/mb-ddh-001.json'), 'utf8'),
);
const { project, hole, runs, boxes, intervals, photos, samples } = day;

// --- small helpers ---------------------------------------------------------

const esc = (text) =>
  String(text ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
const r1 = (n) => Math.round(n * 10) / 10;
const dash = (value) => (value === '' || value == null ? '–' : esc(value));
const cb = '<span class="cb"></span>';

const table = (head, rows, { cls = '' } = {}) => `
  <table class="${cls}">
    <thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>${rows.join('')}</tbody>
  </table>`;
const row = (cells, cls = '') =>
  `<tr class="${cls}">${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`;
const groupRow = (span, text) => `<tr class="group"><td colspan="${span}">${esc(text)}</td></tr>`;

const should = (html) => `<div class="see"><b>You should see</b>${html}</div>`;
const tip = (html) => `<div class="tip"><b>Tip</b>${html}</div>`;
const step = (n, html) => `<div class="step">${cb}<div><b>${n}</b> ${html}</div></div>`;

// --- numbers the guide quotes (all re-checked by field-day.test.ts) ---------

const drilled = runs.reduce((n, r) => n + (r.toM - r.fromM), 0);
const recovered = runs.reduce((n, r) => n + r.recoveredM, 0);
const overallRecovery = r1((recovered / drilled) * 100);
const primaries = samples.filter((s) => s.type === 'primary');

// --- content ---------------------------------------------------------------

const cover = `
<section class="cover">
  <div class="kicker">CoreChain Field · Official test script</div>
  <h1>A day in the field</h1>
  <p class="lede">One drillhole, from setting up the project to exporting the data. Follow it
  step by step on your phone. Every value to type is here, and so is what the app should show
  when you get it right.</p>

  <div class="facts">
    <div><span>Project</span><b>${esc(project.name)}</b></div>
    <div><span>Hole</span><b>${esc(hole.holeId)}</b></div>
    <div><span>Final depth</span><b>${hole.finalDepthM} m</b></div>
    <div><span>Time</span><b>about one working day</b></div>
  </div>

  <div class="cols">
    <div class="box">
      <h3>What this is</h3>
      <p>A realistic day for a field geologist working alone: the drillers have finished a
      ${hole.finalDepthM} m core hole, and you log it and sample it. It is fictional data for testing,
      so nothing here is a real result and no real coordinates are used.</p>
      <p>It is also our official demo of the app. If the app can do this whole day smoothly, with no
      signal, it is ready for a real hole.</p>
    </div>
    <div class="box">
      <h3>What you need</h3>
      <ul>
        <li>The CoreChain Field app on an Android phone, charged</li>
        <li>Camera and location allowed when the app asks</li>
        <li>Something to photograph as "core boxes": a table, a shelf, real boxes if you have them</li>
        <li>A computer with Excel or Google Sheets for Part 8</li>
        <li>This guide printed, or open on a second screen</li>
      </ul>
    </div>
    <div class="box">
      <h3>How to use it</h3>
      <ul>
        <li>Do the parts in order. Tick each step as you go.</li>
        <li>Turn on <b>airplane mode</b> before you start. The app must work with no signal.</li>
        <li>Green <b>You should see</b> boxes are checkpoints. If the app shows something
        different, take a screenshot and write the step number on the sign-off sheet.</li>
        <li>Anything that confused you counts, even if it "worked".</li>
      </ul>
    </div>
  </div>
</section>`;

const glance = `
<section class="page">
  <h2>The day at a glance</h2>
  <p>Target times are what a practised user should manage. Note your own on the sign-off sheet.</p>
  ${table(
    ['Part', 'What you do', 'What you record', 'Target time'],
    [
      row(['1', 'Set up the project and the hole', '1 project, 1 hole', '10 min']),
      row(['2', 'Core reception: enter the drillers\u2019 runs and the core boxes', `${runs.length} runs, ${boxes.length} boxes`, '45 min']),
      row(['3', 'Photograph the core', `${photos.length} photos`, '25 min']),
      row(['4', 'Log the core', `${intervals.length} intervals`, '60 min']),
      row(['5', 'Sample the core, with QC', `${samples.length} samples (${primaries.length} primary + 3 QC)`, '75 min']),
      row(['6', 'Close out the hole', 'Status "Logged"', '5 min']),
      row(['7', 'Trace samples back to the core', '4 samples checked', '10 min']),
      row(['8', 'Export the data and check it in Excel', '5 CSV files', '15 min']),
      row(['9', 'Try to break it', 'A scratch hole, 16 steps', '20 min']),
      row(['<b>Total</b>', '', '', '<b>about 4 h 25 min</b>'], 'total'),
    ],
  )}

  <h3>At the end of the day you should have</h3>
  <div class="numbers">
    <div><b>${runs.length}</b><span>core runs</span></div>
    <div><b>${overallRecovery}%</b><span>core recovery</span></div>
    <div><b>${boxes.length}</b><span>core boxes</span></div>
    <div><b>${photos.length}</b><span>photos</span></div>
    <div><b>${intervals.length}</b><span>logged intervals</span></div>
    <div><b>${hole.finalDepthM} of ${hole.finalDepthM} m</b><span>core logged</span></div>
    <div><b>${samples.length}</b><span>samples</span></div>
    <div><b>1 / 1 / 1</b><span>standard / blank / duplicate</span></div>
  </div>

  <h3>The story of the hole, in one look</h3>
  <table class="story">
    <thead><tr><th>Depth (m)</th><th>What the core is</th><th>Why it matters for the test</th></tr></thead>
    <tbody>
      ${row(['0–3', 'Soft, clay-rich saprolite', 'Poor recovery (60%). Tests low recovery and box 1 notes.'])}
      ${row(['3–14', 'Altered andesite', 'Weathering changes from highly to moderately weathered.'])}
      ${row(['18–21', 'Fault breccia', 'Recovery 90%, RQD 53%. Photographed close up. Structure code FLT.'])}
      ${row(['21–33', 'Silicified diorite with a quartz stockwork', 'The mineralised zone: sampled every metre.'])}
      ${row(['27–28.2', 'Quartz vein with visible gold', 'The sample that gets a duplicate. Traced back in Part 7.'])}
      ${row(['33–45.3', 'Fresh granodiorite', 'Sampled to 40 m, then no more. End of hole at 45.3 m.'])}
    </tbody>
  </table>
</section>`;

const part1 = `
<section class="page">
  <h2><span class="num">1</span>Set up the project and the hole</h2>
  <p class="meta">About 10 minutes. Airplane mode on.</p>

  ${step('1.1', 'Open CoreChain. On the home screen tap <b>New project</b> and fill in:')}
  ${table(['Field', 'Enter'], [
    row(['Project name', `<code>${esc(project.name)}</code>`]),
    row(['Coordinate system', `Tap the <b>${esc(project.coordinateSystem)}</b> chip`]),
    row(['Commodity', `<code>${esc(project.commodity)}</code>`]),
    row(['Location', `<code>${esc(project.location)}</code>`]),
    row(['Sample ID prefix', `<code>${esc(project.samplePrefix)}</code>`]),
  ], { cls: 'entry' })}
  <p>Tap <b>Create project</b>.</p>

  ${step('1.2', 'Open the project and tap <b>Settings</b>. Look, but do not change anything.')}
  ${should(`<ul>
    <li>Sample ID prefix <b>${esc(project.samplePrefix)}</b>, Next sample number <b>${project.nextSampleNumber}</b></li>
    <li>Standard, Blank and Field duplicate: every <b>${project.qcEveryN}</b> samples</li>
    <li>Largest photo size <b>${project.photoMaxMb} MB</b></li>
  </ul>`)}

  ${step('1.3', 'Back on the project screen, tap <b>New drillhole</b> and fill in:')}
  ${table(['Field', 'Enter'], [
    row(['Hole ID', `<code>${esc(hole.holeId)}</code>`]),
    row(['Planned depth (m)', `<code>${hole.plannedDepthM}</code>`]),
    row(['Planned azimuth (0-360°)', `<code>${hole.plannedAzimuthDeg}</code>`]),
    row(['Planned inclination / dip (-90 to 90°)', `<code>${hole.plannedInclinationDeg}</code>`]),
    row(['Collar', `Outdoors: tap <b>Use GPS</b> and wait for the fix.<br>Indoors: type Latitude <code>${hole.collar.latitude}</code> and Longitude <code>${hole.collar.longitude}</code>`]),
  ], { cls: 'entry' })}
  <p>Tap <b>Create drillhole</b>, then open it from the list.</p>

  ${step('1.4', 'The drillers finished yesterday, so you already know the final depth. On the hole screen:')}
  <ul class="plain">
    <li>Tap the <b>Complete</b> status chip.</li>
    <li>In <b>Actual details</b>: tap <b>Started</b> and pick the date <b>${hole.startedDaysAgo} days ago</b> in the calendar. Tap <b>Completed</b> and pick <b>yesterday</b>.</li>
    <li><b>Actual final depth (m)</b>: <code>${hole.finalDepthM}</code>. Tap <b>Save actual details</b>.</li>
  </ul>

  ${should(`<ul>
    <li>Title <b>${esc(hole.holeId)}</b> with a <b>Complete</b> pill</li>
    <li>"${esc(project.name)} · ${hole.finalDepthM} m final · azimuth ${hole.plannedAzimuthDeg}° · dip ${hole.plannedInclinationDeg}°"</li>
    <li>A collar line (GPS or the coordinates you typed)</li>
    <li>Core logged <b>0 of ${hole.finalDepthM} m</b>, and the big button says <b>Add first core box</b></li>
  </ul>`)}
</section>`;

const runRows = runs.map((r, i) => {
  const d = r.toM - r.fromM;
  return row([
    i + 1,
    r.fromM.toFixed(1),
    r.toM.toFixed(1),
    r.recoveredM.toFixed(2),
    r.rqdPiecesM.toFixed(2),
    `${r1((r.recoveredM / d) * 100)}%`,
    `${r1((r.rqdPiecesM / d) * 100)}%`,
  ], i % 2 ? 'alt' : '');
});
const boxRows = boxes.map((b, i) =>
  row([b.boxNumber, b.fromM.toFixed(1), b.toM.toFixed(1), dash(b.note)], i % 2 ? 'alt' : ''),
);

const part2 = `
<section class="page">
  <h2><span class="num">2</span>Core reception</h2>
  <p class="meta">About 45 minutes. The rig has sent up the core in runs of 3 m; you enter what the driller wrote on each block, then the boxes.</p>

  ${step('2.1', 'On the hole screen tap the <b>Core runs</b> tile, then <b>Add run</b>. Enter the runs in order. The from-depth fills in for you after the first one. Under the depths, the <b>3 m</b> chip sets the to-depth for you, and <b>Full recovery</b> fills in the recovered length.')}
  ${table(
    ['Run', 'From (m)', 'To (m)', 'Recovered length (m)', 'Pieces ≥ 10 cm, total length (m)', 'Recovery', 'RQD'],
    runRows,
    { cls: 'data' },
  )}
  <p class="small">The last two columns are worked out by the app. <b>Do not type them.</b> Use them to check your entries.</p>

  ${should(`<ul>
    <li>Run 1 shows recovery <b>60%</b>, RQD <b>13.3%</b>. Run 7 shows <b>90%</b> and <b>53.3%</b>.</li>
    <li>No amber gap or overlap warnings while entering any run.</li>
    <li>On the hole screen the Core runs tile says <b>${runs.length} runs · ${overallRecovery}% recovery</b>.</li>
  </ul>`)}
</section>

<section class="page">
  ${step('2.2', 'Back on the hole screen tap <b>Core boxes</b>, then <b>Add box</b>. The box number and from-depth fill in for you, and the <b>5 m</b> chip sets the to-depth.')}
  ${table(['Box number', 'From (m)', 'To (m)', 'Note (optional)'], boxRows, { cls: 'data' })}

  ${should(`<ul>
    <li>The Core boxes tile says <b>${boxes.length} boxes</b>.</li>
    <li>No "Gap in core boxes" warning on the hole screen.</li>
    <li>The last box ends at <b>${hole.finalDepthM} m</b>, the same depth as the last run.</li>
  </ul>`)}
  ${tip('If you make a mistake in a run or a box, delete it and add it again. Editing an existing entry is not built yet.')}
</section>`;

const photoRows = [
  ...boxes.map((b, i) =>
    row([
      cb,
      `Box ${b.boxNumber}`,
      `${b.fromM}–${b.toM} m`,
      'Core boxes → <b>Photos (0)</b> under the box → <b>Take photo</b>',
      b.boxNumber === 4
        ? 'Include the gouge at 19.2 to 19.5 m'
        : b.boxNumber === 6
          ? 'Include the quartz vein at 27.0 to 28.2 m'
          : 'Lid open, core wet, label in view',
    ], i % 2 ? 'alt' : ''),
  ),
  ...photos
    .filter((p) => p.subject === 'interval')
    .map((p, i) =>
      row([
        cb,
        'Interval',
        `${p.fromM}–${p.toM} m`,
        'Core log → <b>Photos (0)</b> on the interval → <b>Take photo</b> (after Part 4)',
        p.fromM === 18 ? 'Close-up of the fault breccia' : 'Close-up of the vein and the gold',
      ], (boxes.length + i) % 2 ? 'alt' : ''),
    ),
];

const part3 = `
<section class="page">
  <h2><span class="num">3</span>Photograph the core</h2>
  <p class="meta">About 25 minutes. The first time you take a photo, the phone asks for camera permission: choose <b>While using the app</b>.</p>
  <p>Each photo is filed automatically against the box or interval you took it from, with the hole ID, box number, depth range and time. You do not name anything. Photos are shrunk to under ${project.photoMaxMb} MB on the phone.</p>

  ${table(['Done', 'Photo of', 'Depth', 'Where to tap', 'What to include'], photoRows, { cls: 'data' })}

  ${should(`<ul>
    <li>The camera screen shows the label at the top, for example <b>${esc(hole.holeId)} · Box 6 · 25–30 m</b>.</li>
    <li>After the shutter, you go back to the photo list with a thumbnail, the time, the size (well under ${project.photoMaxMb} MB) and <b>Delete</b>.</li>
    <li>Every box now says <b>Photos (1)</b>.</li>
  </ul>`)}
  ${tip('Hold the phone flat above the box. Photograph the whole box, not just one row. If you get a bad photo, tap Delete and take it again.')}
</section>`;

const logRows = intervals.map((i, n) =>
  row([
    n + 1,
    i.fromM,
    i.toM,
    dash(i.lithology),
    dash(i.alterationType),
    dash(i.alterationIntensity),
    dash(i.mineral),
    dash(i.mineralStyle),
    i.mineralPercent == null ? '–' : i.mineralPercent,
    dash(i.weathering),
    dash(i.structureType),
    dash(i.notes),
  ], n % 2 ? 'alt' : ''),
);

const part4 = `
<section class="wide">
  <h2><span class="num">4</span>Log the core</h2>
  <p class="meta">About 60 minutes. Core log → <b>Add interval</b>. The from-depth fills in with the end of the last interval. Tap a code chip, or type the code. The <b>1 m</b>, <b>2 m</b>, <b>3 m</b>, <b>5 m</b> chips set the to-depth.</p>

  ${table(
    ['#', 'From', 'To', 'Lithology', 'Alteration type', 'Alteration intensity', 'Mineralisation: mineral', 'Mineralisation: style', 'Mineral content (%)', 'Weathering', 'Structure type', 'Structure notes and comments'],
    logRows,
    { cls: 'data small-text' },
  )}

  <div class="cols two">
    ${tip(`Intervals <b>4</b> and <b>12</b> are almost the same as the one before. Tap <b>Copy previous interval</b>, then change only what differs: interval 4 (intensity 3, style VNL, 3%, weathering SW, new note); interval 12 (intensity 1, no structure, new note).`)}
    ${tip('Take a call in the middle of an interval? Close the form. Your half-typed interval is saved, and comes back when you open <b>Add interval</b> again.')}
  </div>

  ${should(`<ul>
    <li>After the last interval the hole screen says <b>Core logged ${hole.finalDepthM} of ${hole.finalDepthM} m</b> and the progress bar is full.</li>
    <li>The depth strip is solid dark: no amber gaps, no red overlaps. The Core log tile says <b>${intervals.length} intervals</b>.</li>
    <li>No amber warning row on the hole screen at all.</li>
  </ul>`)}
  <p>Now go back to Part 3 and take the two interval photos (18–21 m and 27–28.2 m).</p>
</section>`;

const sampleRows = [];
samples.forEach((s, i) => {
  if (i === 0) sampleRows.push(groupRow(7, 'A. Primary samples, in order (samples 1 to 20)'));
  if (i === 20) sampleRows.push(groupRow(7, `B. Stop. Open the Samples register: three amber reminders appear. Insert the controls (samples 21 to 23)`));
  if (i === 23) sampleRows.push(groupRow(7, 'C. Back to the primaries (samples 24 and 25)'));
  const depth = s.type === 'primary' ? `${s.fromM}–${s.toM}` : s.type === 'duplicate' ? 'copied' : 'none';
  const extra =
    s.type === 'standard'
      ? `Reference material ID: <code>${esc(s.standardRef)}</code>`
      : s.type === 'duplicate'
        ? `Duplicate of: <code>${esc(s.duplicateOf)}</code>`
        : '';
  sampleRows.push(
    row([
      i + 1,
      `<b>${esc(s.number)}</b>`,
      s.type === 'primary' ? 'Primary' : s.type === 'standard' ? '<b>Standard</b>' : s.type === 'blank' ? '<b>Blank</b>' : '<b>Duplicate</b>',
      depth,
      extra,
      dash(s.note),
      cb,
    ], i % 2 ? 'alt' : ''),
  );
});

const part5 = `
<section class="wide">
  <h2><span class="num">5</span>Sample the core</h2>
  <p class="meta">About 75 minutes. Samples → <b>New sample</b>. Choose the hole chip <b>${esc(hole.holeId)}</b> and the type chip. The <b>Sample number</b> is filled in for you and should match the table. For a primary sample the <b>From depth</b> is filled in with where your last sample ended, so you only set the to-depth (type it, or tap the <b>1 m</b> or <b>2 m</b> chip). Check that it matches the table.</p>

  ${table(['#', 'Sample number', 'Type', 'Depth (m)', 'Also enter', 'Note (optional)', 'Done'], sampleRows, { cls: 'data' })}

  <div class="cols two">
    <div>
      ${should(`<ul>
        <li>After sample 20 the register shows three amber cards: <b>A standard is due</b>, <b>A blank is due</b>, <b>A field duplicate is due</b>, each with "20 samples since the last one (target: every ${project.qcEveryN})". Before sample 20 none are shown.</li>
        <li>Tap <b>Insert standard</b> (and the others) to jump to a new-sample form with the type already chosen. Once all three are saved the amber cards disappear.</li>
      </ul>`)}
    </div>
    <div>
      ${should(`<ul>
        <li>The register lists <b>${samples.length} samples</b>. Filter <b>Type</b> = Standard shows one.</li>
        <li>QC insertion rate: <b>Standards: 1 (1 per ${primaries.length} samples, target 1 per ${project.qcEveryN})</b>, and the same for blanks and field duplicates.</li>
        <li>The hole screen Samples tile says <b>${samples.length} samples</b>.</li>
      </ul>`)}
    </div>
  </div>
  ${tip('In real life the lab wants the standard hidden among the batch. This test only checks the reminder rule, so we insert them in one go after sample 20.')}
</section>`;

const part6 = `
<section class="page">
  <h2><span class="num">6</span>Close out the hole</h2>
  <p class="meta">About 5 minutes.</p>
  ${step('6.1', 'On the hole screen tap the <b>Logged</b> status chip.')}
  ${step('6.2', 'Look at the whole hole screen, top to bottom.')}
  ${should(`<ul>
    <li>Pill: <b>Logged</b>. Core logged <b>${hole.finalDepthM} of ${hole.finalDepthM} m</b>, no warnings.</li>
    <li>Tiles: <b>${boxes.length} boxes</b>, <b>${runs.length} runs · ${overallRecovery}% recovery</b>, <b>${intervals.length} intervals</b>, <b>${samples.length} samples</b>.</li>
    <li>Actual details: Started and Completed show the dates you picked, final depth <b>${hole.finalDepthM}</b>.</li>
  </ul>`)}
  ${step('6.3', 'Go back to the home screen.')}
  ${should(`<ul>
    <li><b>Continue where you left off</b> shows <b>${esc(hole.holeId)}</b> in <b>${esc(project.name)}</b>, 100% logged.</li>
    <li>Your project card shows <b>1 hole · Gold · 100% logged</b>.</li>
  </ul>`)}
  ${step('6.4', 'Force-close the app (recent apps, swipe it away), then open it again. Everything is still there. This is the "battery died at the rig" test.')}

  <h2 style="margin-top:22px"><span class="num">7</span>Trace samples back to the core</h2>
  <p class="meta">About 10 minutes. Samples → tap a sample. The screen shows where it has been, from the hole to the assay.</p>
  ${table(['Open sample', 'Chain you should see'], [
    row(['<b>MB-00012</b><br>the quartz vein', `Hole ${esc(hole.holeId)}, GPS or typed collar<br><b>Box 6 · 27–28.2 m</b>, 1 photo<br>Logged interval <b>QV · SIL</b><br>Sample created<br>Bagged (next step) → Dispatched → Assay result`]),
    row(['<b>MB-00003</b><br>in the fault zone', `<b>Box 4 · 18–19 m</b>, 1 photo<br>Logged interval <b>BX · PHY</b>`]),
    row(['<b>MB-00025</b><br>crosses two intervals', `<b>Box 8 · 38–40 m</b>, 1 photo<br>Logged interval <b>GRD · PROP (+1 more)</b>`]),
    row(['<b>MB-00021</b><br>the standard', `Starts at the hole (no core to trace)<br>Sample created: <b>Reference material OREAS 45e</b><br>Bagged → Dispatched → Assay result`]),
  ])}
  ${should(`<ul>
    <li>Every green tick is real data. No amber "missing" warning on any sample in this hole.</li>
    <li>The <b>Bagged</b> step is highlighted as next but cannot be tapped yet. Custody and dispatch come in a later update, so this is expected.</li>
  </ul>`)}
</section>`;

const part8 = `
<section class="page">
  <h2><span class="num">8</span>Export the data and check it</h2>
  <p class="meta">About 15 minutes. Project screen → <b>Export</b>. Tap <b>Share</b> on each file and save it to the phone (Files or Downloads). If you are still in airplane mode, that is enough for now; switch airplane mode off afterwards and send the files to yourself (email, Drive, USB). Open them on a computer.</p>

  ${table(['File', 'Rows', 'Check in Excel'], [
    row(['<code>masbate-gold-pilot-collars.csv</code>', '1', `HOLEID ${esc(hole.holeId)}, LONGITUDE ${hole.collar.longitude}, LATITUDE ${hole.collar.latitude}, COORDINATE_SYSTEM ${esc(project.coordinateSystem)}, PLANNED_DEPTH ${hole.plannedDepthM}, FINAL_DEPTH ${hole.finalDepthM}, STATUS logged`]),
    row(['<code>masbate-gold-pilot-surveys.csv</code>', '1', `DEPTH 0, AZIMUTH ${hole.plannedAzimuthDeg}, DIP ${hole.plannedInclinationDeg} (planned values: no downhole surveys yet)`]),
    row(['<code>masbate-gold-pilot-log.csv</code>', `${intervals.length}`, 'Depths run 0 to 45.3 with no gaps. Interval 7 has MINERAL AU, MINERAL_PERCENT 0.1, STRUCTURE_TYPE VEIN.']),
    row(['<code>masbate-gold-pilot-runs.csv</code>', `${runs.length}`, `RECOVERY_PCT of run 1 is 60 and of run 7 is 90. Sum of RECOVERED_M is ${r1(recovered * 100) / 100}, sum of DRILLED_M is ${drilled.toFixed(1)}.`]),
    row(['<code>masbate-gold-pilot-samples.csv</code>', `${samples.length}`, 'SAMPLE_ID MB-00001 to MB-00025. QC column marks the three controls. MB-00023 has PARENT_SAMPLE_ID MB-00012 and the same FROM and TO.']),
  ])}
  ${should(`<ul>
    <li>All five files open as clean tables: no odd characters, one header row, numbers as numbers.</li>
    <li>HOLEID is <b>${esc(hole.holeId)}</b> on every row.</li>
    <li>The Export screen shows the file names and row counts above <b>before</b> you share.</li>
  </ul>`)}
  ${tip('Core boxes and photos are not in the export yet. They are on the phone, and they show up in the sample trace.')}
</section>`;

const breakTests = [
  ['Create a second hole with ID <code>MB-DDH-001</code> in this project.', '“A hole named "MB-DDH-001" already exists in this project.” No hole is created.', 'Project'],
  ['Create a scratch hole <code>TEST-01</code>, planned depth <code>10</code>. Use it for everything below.', 'The hole is created. The rest of the day’s data is untouched.', 'Project'],
  ['On TEST-01 add box 1 from 0 to 5, then box 2 from 6 to 10.', 'Amber “Leaves a gap of 5–6 m next to this box.” The button now says <b>Save anyway</b>. Do not save it.', 'Boxes'],
  ['Add box 2 from 4 to 8.', 'Amber “Overlaps another box at 4–5 m.” Do not save it.', 'Boxes'],
  ['Add a run from 0 to 3 with Recovered length <code>3.4</code>.', 'Amber “Recovered 3.4 m is more than the 3 m drilled. Check the entry before saving.”', 'Runs'],
  ['Add a run from 0 to 3, recovered <code>2</code>, pieces ≥ 10 cm <code>2.5</code>.', 'Red “Pieces ≥ 10 cm can’t be longer than the recovered core.” You cannot save.', 'Runs'],
  ['Add an interval from 3 to 2.', 'Red “To depth must be greater than from depth.”', 'Log'],
  ['Add an interval 0 to 2 with Mineral content <code>150</code>.', 'Red “Mineral % must be between 0 and 100.”', 'Log'],
  ['Add a primary sample from 9 to 11.', 'Red “A sample must fall inside the hole’s depth (0–10 m).”', 'Samples'],
  ['Save a primary sample 0 to 2, then try 1 to 3.', 'Red “Overlaps a primary sample at 0–2 m.”', 'Samples'],
  ['Choose type Standard and leave Reference material ID empty.', 'Red “Enter the reference material ID.”', 'Samples'],
  ['Choose type Duplicate and pick nothing under “Duplicate of”.', 'Red “Choose the primary sample this duplicates.”', 'Samples'],
  ['Type the sample number <code>MB-00001</code> on TEST-01.', 'Red “MB-00001 is already used in this project.” Numbers are never reused.', 'Samples'],
  ['Open MB-00012, tap <b>Delete sample</b> and confirm.', 'Refused: “A field duplicate points at this sample. Delete the duplicate first.” Nothing is deleted.', 'Samples'],
  ['On the MB-DDH-001 hole screen, type <code>12x</code> as Actual final depth and Save.', 'Red “Final depth must be a number above 0.” Nothing is saved.', 'Hole'],
  ['Tap <b>Completed</b> on any hole with a Started date.', 'The calendar opens on today. Days before the Started date are greyed out and cannot be chosen.', 'Hole'],
];

const part9 = `
<section class="page">
  <h2><span class="num">9</span>Try to break it</h2>
  <p class="meta">About 20 minutes. Do these on the scratch hole <b>TEST-01</b> so the day’s data stays clean. Each one checks that the app catches a mistake a tired person makes in the field.</p>
  ${table(
    ['', 'Do this', 'You should see', 'Where'],
    breakTests.map((t, i) => row([cb, `<b>${i + 1}.</b> ${t[0]}`, t[1], t[2]], i % 2 ? 'alt' : '')),
    { cls: 'data' },
  )}
</section>`;

const conditions = `
<section class="page">
  <h2><span class="num">10</span>Field conditions</h2>
  <p class="meta">These are the things a desk test cannot show. Do them once during the day and tick when done.</p>
  ${table(['', 'Check', 'What to note'], [
    row([cb, '<b>No signal all day.</b> Airplane mode was on from Part 1 to Part 9.', 'Did anything ask for the internet or fail because it was offline?']),
    row([cb, '<b>Sunlight.</b> Take the phone outside and read the hole screen and the sample trace at full brightness.', 'Can you tell a ticked step from a next step from an amber problem at a glance?']),
    row([cb, '<b>Gloves or dirty hands.</b> Enter three runs with gloves on, or with damp fingers.', 'Any button too small? Any mis-taps? Which ones?']),
    row([cb, '<b>Interruption.</b> Start an interval, switch to another app for a minute, come back.', 'Was your half-typed interval still there?']),
    row([cb, '<b>Battery.</b> Note the battery at the start and after Part 5.', 'Start: ____ %     After Part 5: ____ %']),
    row([cb, '<b>Dark and light.</b> Switch the phone between dark and light mode once.', 'Is everything readable in both? Any text that vanishes?']),
    row([cb, '<b>Speed.</b> Does any screen feel slow (more than 2 seconds)?', 'Which screen, doing what?']),
  ])}
</section>`;

const codes = [
  ['Lithology', [['OVB', 'Overburden / soil'], ['AND', 'Andesite'], ['BX', 'Breccia'], ['DIO', 'Diorite'], ['QV', 'Quartz vein'], ['GRD', 'Granodiorite']]],
  ['Alteration type', [['ARG', 'Argillic'], ['PHY', 'Phyllic (sericitic)'], ['SIL', 'Silicic'], ['PROP', 'Propylitic']]],
  ['Alteration intensity', [['1', 'Weak'], ['2', 'Moderate'], ['3', 'Strong'], ['4', 'Pervasive / intense']]],
  ['Mineralisation: mineral', [['PY', 'Pyrite'], ['AU', 'Visible gold']]],
  ['Mineralisation: style', [['DISS', 'Disseminated'], ['VNL', 'Veinlets'], ['STK', 'Stockwork'], ['BXH', 'Breccia-hosted']]],
  ['Weathering', [['FR', 'Fresh'], ['SW', 'Slightly weathered'], ['MW', 'Moderately weathered'], ['HW', 'Highly weathered'], ['CW', 'Completely weathered']]],
  ['Structure type', [['FLT', 'Fault'], ['FRAC', 'Fracture zone'], ['VEIN', 'Vein']]],
];

const appendix = `
<section class="page">
  <h2>Appendix: the codes used today</h2>
  <p>All of these are in the app’s starter code library. You can see and edit the library from Core log → <b>Code library</b>. These are a generic hard-rock set; tell us which codes your team really uses.</p>
  <div class="codegrid">
    ${codes
      .map(
        ([title, list]) => `<div><h4>${esc(title)}</h4>${list
          .map(([c, d]) => `<div class="code"><code>${esc(c)}</code><span>${esc(d)}</span></div>`)
          .join('')}</div>`,
      )
      .join('')}
  </div>
</section>`;

const signoffRows = [
  ['1', 'Set up project and hole', '10'],
  ['2', 'Core reception (runs and boxes)', '45'],
  ['3', 'Photograph the core', '25'],
  ['4', 'Log the core', '60'],
  ['5', 'Sample the core, with QC', '75'],
  ['6', 'Close out the hole', '5'],
  ['7', 'Trace samples', '10'],
  ['8', 'Export and check', '15'],
  ['9', 'Try to break it', '20'],
  ['10', 'Field conditions', '–'],
].map(([n, name, target], i) =>
  row([n, name, target, '', cb + ' &nbsp; ' + cb + ' &nbsp; ' + cb + ' &nbsp; ' + cb + ' &nbsp; ' + cb, ''], i % 2 ? 'alt' : ''),
);

const signoff = `
<section class="page">
  <h2>Sign-off sheet</h2>
  <div class="form">
    <div><span>Tester</span><i></i></div>
    <div><span>Date</span><i></i></div>
    <div><span>Phone model and Android version</span><i></i></div>
    <div><span>App version</span><i></i></div>
    <div><span>Started at</span><i></i></div>
    <div><span>Finished at</span><i></i></div>
  </div>
  ${table(
    ['Part', 'What', 'Target (min)', 'Your time (min)', 'How smooth? 1 (painful) to 5 (effortless)', 'Step numbers that did not match'],
    signoffRows,
  )}
  <div class="lines">
    <h3>What confused you or slowed you down?</h3><i></i><i></i><i></i>
    <h3>What did you expect the app to do that it did not?</h3><i></i><i></i><i></i>
    <h3>What would you never trust the app with in the field, and why?</h3><i></i><i></i>
  </div>
  <p class="small">Send this sheet, with screenshots of anything that did not match, to the product owner.</p>
</section>`;

// --- page --------------------------------------------------------------------

const css = `
@page { size: A4; margin: 14mm 14mm 16mm; @bottom-left { content: "CoreChain Field · A day in the field · v1"; font: 8pt 'Segoe UI', Arial, sans-serif; color: #7A828E; } @bottom-right { content: "Page " counter(page); font: 8pt 'Segoe UI', Arial, sans-serif; color: #7A828E; } }
@page wide { size: A4 landscape; margin: 12mm 12mm 14mm; }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font: 10pt/1.45 'Segoe UI', Arial, sans-serif; color: #0E1116; margin: 0; }
section.page { break-before: page; }
section.wide { break-before: page; page: wide; }
section.cover { break-after: page; }
h1 { font-size: 34pt; line-height: 1.05; margin: 6px 0 10px; letter-spacing: -0.5px; }
h2 { font-size: 17pt; margin: 0 0 4px; display: flex; align-items: center; gap: 10px; }
h3 { font-size: 11.5pt; margin: 16px 0 6px; }
h4 { font-size: 9.5pt; margin: 0 0 4px; color: #1660E8; }
p { margin: 5px 0; }
.num { display: inline-flex; width: 26px; height: 26px; border-radius: 50%; background: #1660E8; color: #fff; align-items: center; justify-content: center; font-size: 12pt; font-weight: 600; flex: none; }
.kicker { color: #1660E8; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; font-size: 9pt; margin-top: 22mm; }
.lede { font-size: 13pt; line-height: 1.45; color: #2a3038; max-width: 165mm; }
.meta { color: #525A67; margin: 0 0 10px; }
.small, .small-text { font-size: 8.5pt; }
.facts { display: flex; gap: 10px; margin: 18px 0 16px; }
.facts div { flex: 1; background: #E6EFFD; border-radius: 10px; padding: 10px 12px; }
.facts span { display: block; font-size: 8pt; color: #525A67; text-transform: uppercase; letter-spacing: .05em; }
.facts b { font-size: 12pt; }
.cols { display: flex; gap: 10px; align-items: stretch; }
.cols > * { flex: 1; }
.cols.two { margin-top: 8px; }
.box { border: 1px solid #DCE1E8; border-radius: 12px; padding: 4px 14px 10px; }
.box h3 { margin-top: 10px; }
.box ul { margin: 4px 0; padding-left: 16px; }
.box li { margin-bottom: 3px; }
table { border-collapse: collapse; width: 100%; margin: 8px 0 10px; font-size: 9.5pt; }
th { background: #E6EFFD; text-align: left; font-weight: 600; }
th, td { border: 1px solid #DCE1E8; padding: 4px 7px; vertical-align: top; }
thead { display: table-header-group; }
tr { break-inside: avoid; }
tr.alt td { background: #F7F9FC; }
tr.group td { background: #0E1116; color: #fff; font-weight: 600; }
tr.total td { background: #E6EFFD; }
table.entry td:first-child { width: 42%; color: #525A67; }
table.data td, table.data th { padding: 3.5px 6px; }
table.small-text { font-size: 8.5pt; }
code { font: 600 9.5pt Consolas, 'Courier New', monospace; background: #F1F3F6; border-radius: 4px; padding: 0 4px; }
.cb { display: inline-block; width: 12px; height: 12px; border: 1.5px solid #525A67; border-radius: 3px; vertical-align: -2px; }
.step { display: flex; gap: 9px; margin: 12px 0 4px; align-items: flex-start; }
.step .cb { margin-top: 4px; flex: none; }
.plain { margin: 4px 0 6px; padding-left: 22px; }
.see { border-left: 4px solid #0E7A55; background: #E9F6F0; border-radius: 0 8px 8px 0; padding: 7px 12px; margin: 10px 0; break-inside: avoid; }
.see b { display: block; color: #0E7A55; font-size: 8.5pt; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 2px; }
.see ul { margin: 2px 0; padding-left: 16px; }
.tip { border-left: 4px solid #1660E8; background: #EEF4FE; border-radius: 0 8px 8px 0; padding: 7px 12px; margin: 10px 0; break-inside: avoid; }
.tip b:first-child { display: block; color: #1660E8; font-size: 8.5pt; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 2px; }
.numbers { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.numbers div { background: #F4F6F8; border-radius: 10px; padding: 8px 10px; }
.numbers b { display: block; font-size: 14pt; color: #1660E8; }
.numbers span { font-size: 8.5pt; color: #525A67; }
.codegrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.code { display: flex; gap: 8px; align-items: baseline; margin-bottom: 3px; }
.code code { min-width: 44px; text-align: center; }
.form { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 10px 0; }
.form div { display: flex; gap: 8px; align-items: flex-end; }
.form span { font-size: 8.5pt; color: #525A67; white-space: nowrap; }
.form i, .lines i { flex: 1; border-bottom: 1px solid #9aa2ad; height: 18px; display: block; }
.lines i { margin: 4px 0 8px; }
.lines h3 { margin: 12px 0 2px; }
`;

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>CoreChain Field — A day in the field</title><style>${css}</style></head><body>
${cover}${glance}${part1}${part2}${part3}${part4}${part5}${part6}${part8}${part9}${conditions}${appendix}${signoff}
</body></html>`;

const htmlPath = join(here, 'CoreChain-Field-Day-Guide.html');
const pdfPath = join(here, 'CoreChain-Field-Day-Guide.pdf');
writeFileSync(htmlPath, html, 'utf8');
console.log('Wrote', htmlPath);

const chrome = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(existsSync);
if (!chrome) {
  console.log('No Chrome or Edge found; open the HTML file and print it to PDF.');
} else {
  execFileSync(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--no-pdf-header-footer',
    `--print-to-pdf=${resolve(pdfPath)}`,
    pathToFileURL(resolve(htmlPath)).href,
  ], { stdio: 'ignore' });
  console.log('Wrote', pdfPath);
}
