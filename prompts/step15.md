# Step 15 — The staff on screen

Depends on nothing in steps 9–14; it reads the MusicXML directly and touches no engine state.
One branch, `step-15-staff`, off `main`.

## Goal

Put the notation on screen. flowkey's central pane is the score, and the app has never had one —
the player has said plainly that the finger-number circles cannot be read on their own, and that
they keep the printed music open beside the app. Step 10 answers _which key_; the staff answers
_what is written_, and connects the screen to the sheet music the player already owns.

This step draws the score and stops there; step 16 makes it follow the player.

## Confirmed decision — render from the MusicXML, not from `Score`

`Score` is lossy on purpose. Rests are dropped, ties are collapsed into one event, `<type>` and
`<dot>` are never consulted (`DECISIONS.md` says why), and MusicXML's note spelling is discarded
at parse time (`step13.md` says why). Notation cannot be reconstructed from it and was never
going to be.

It does not have to be. `src/score/cichaNoc.ts` already imports `cicha-noc.musicxml` with
Vite's `?raw`, so the renderer's input is a string that is in the bundle today. Feed OSMD that
same string. The two representations stay independent: `Score` is what the engine waits on,
the XML is what gets drawn, and neither is derived from the other.

## Confirmed decision — OpenSheetMusicDisplay, not VexFlow directly

VexFlow draws noteheads and beams from instructions; it does not read MusicXML. Using it
directly means writing a second MusicXML parser — one that keeps everything `parseScore.ts`
deliberately throws away — and then a layout pass on top. OSMD is that parser and that layout
pass, over VexFlow. Take it.

## The bundle question

The built bundle is **227 KB** today (`dist/assets/index-*.js`). `opensheetmusicdisplay@2.1.3`
ships a single prebuilt `build/opensheetmusicdisplay.min.js` of **1.33 MB** as its only entry,
with no `module` field, so there is nothing for Vite to tree-shake. Expect the bundle to grow
several times over.

Record `dist/assets/*.js` before and after, in the report and in `DECISIONS.md`. Do not reach
for a lazy boundary or any other mitigation — the number is for whoever reads the report to
react to.

## In scope

- `opensheetmusicdisplay` pinned exactly at `2.1.3` in `dependencies`, per the house rule.
- `src/score/cichaNoc.ts` imports the raw XML but keeps it module-local; export it, since the
  renderer needs the string and the parsed score is no use to it.
- `src/score/StaffView.tsx`: a `<div>` and a `useRef`/`useEffect` pair that constructs
  `OpenSheetMusicDisplay` against it, loads that string and renders.
- **One effect, three lifecycle traps, all the cleanup function's job.** `main.tsx` wraps
  `<App />` in `<StrictMode>`, so in development the effect runs, cleans up and runs again.
  Without a cleanup that empties the container, the second run appends a second copy of the
  score. `osmd.load()` is a promise that `render()` must follow, so a continuation resolving
  after unmount must not render into a detached container. And OSMD's `autoResize` default
  attaches a window `resize` listener that **2.1.3 never removes** — there is no
  `removeEventListener("resize"` anywhere in the shipped bundle and no public dispose — so a
  discarded instance re-renders into the container the cleanup just emptied, on the next
  resize. Construct with `autoResize: false` and own the lifecycle, or leave it on knowingly;
  either way decide it rather than inheriting it.
- Placement in `App.tsx` above the queue, and sizing that holds up next to the existing layout.
- One `data-testid` on the wrapper, which is all Layer 3 needs to count what is inside it.

## Out of scope

- **Every connection to the engine.** No cursor, no highlight, no current-position marker, no
  reaction to Restart or to the loop. Step 16 is that step, and none of it is smuggled in here.
- Loading any score but `cicha-noc.musicxml`. There is still exactly one piece and no way to
  load another; a file picker is a different feature.
- Zoom, transpose, printing, page turning, or a control to hide the staff. Nobody asked, and the
  staff's whole point is to be visible.
- Replacing the queue or the keyboard. This is a third cue beside them, not a substitute —
  step 10's "a second cue, not a replacement" reasoning applies unchanged.

## Decisions to record in `DECISIONS.md`

- The staff renders from the raw MusicXML, never from `Score`, and the two are independent
  representations of the same piece. This is the entry that stops a later refactor from
  "unifying" them.
- OSMD over VexFlow, because the parser is the expensive half.
- The measured bundle before and after, and whatever was decided about it.

## Gate

- **Layer 2 is deliberately thin, and that is the honest answer rather than a gap.** OSMD
  measures glyphs to lay out, and jsdom implements no SVG text metrics, so mounting it in Vitest
  either fails or needs the kind of heavy mocking `CLAUDE.md` asks to avoid. Assert in jsdom only
  that the wrapper renders; put the real check in a real browser.
- Layer 3 is where this step is actually proved: assert the staff container holds an `<svg>`,
  that it contains more than one staff line, and that the piece's title text appears. OSMD tags
  each staff line group `class="staffline"`, which is its own handle — count by that, not by
  VexFlow's `vf-`-prefixed classes, which are a private API and will move under a version bump.
- No committed screenshot: OSMD's SVG shifts with its version, its fonts and the platform, so a
  snapshot would fail for reasons that have nothing to do with this app. Step 13's keyboard
  snapshot stands; do not add a second one here.
- A green `npm run ci` does not establish that the notation is _correct_ — only that something
  rendered. Correctness is the manual check below, read against the printed score.

## Manual

A new item 11 in `MANUAL-CHECKS.md` — the first genuinely new item since the list settled, and
it earns its place because nothing automated can read music: open the app beside the printed
copy of Cicha Noc and confirm the staff shows the same piece, in the same key and time
signature, with both hands' staves and the same notes in the same bars.
