# Step 25 — The staff keeps its marker a third of the way in

Changes how the staff pane follows its cursor: instead of scrolling only when the marker reaches
the right edge, it glides so the marker sits about one third of the way across the pane. Touches
`src/score/StaffView.tsx`, `src/score/StaffView.css`, the OSMD stub in `src/testSetup.ts`,
`e2e/staff-cursor.spec.ts`, the "The cursor
scrolls its own pane, not the page" entry in `DECISIONS.md` and item 11 of `MANUAL-CHECKS.md`. No
dependency. Independent of steps 24 and 26. One branch, `step-25-staff-scroll`, off `main`.

## Goal

The player's report: "the scrolling is happening too late. It should rather keep the cursor
somewhere in the middle instead of scrolling when it reaches the right point." Today the marker
walks to the right edge of the pane, and each scroll brings it just back into view, so there is
never more than a note or two visible ahead of it.

## This replaces a recorded decision

`DECISIONS.md`'s "The cursor scrolls its own pane, not the page" chose
`scrollIntoView({ block: 'nearest' })` (`src/score/StaffView.tsx:77`) because it "scrolls the pane
only as far as it must". Minimal scrolling is exactly what the player does not want. The other
half of that entry, that the page never moves, still stands and is kept.

## Confirmed decisions — one third from the left, gliding

The owner chose **about one third from the left** over the centre: more of the music ahead of the
marker than behind it, which is how flowkey keeps its cursor. They chose a **smooth glide** over
an instant jump.

On every cursor move, after `cursor.show()`, set the pane's `scrollLeft` so that the cursor
element's left edge is one third of the pane's `clientWidth` from the pane's left edge: its
current offset from the pane (from the two `getBoundingClientRect()`s) plus `scrollLeft`, minus
`clientWidth / 3`. The browser clamps the value, so at the start of the piece the pane stays at 0
and the marker sits to the left of the third, and at the end it stops at the last bar. There is
no special case for either. Only `scrollLeft` is set, so the page itself can no longer be moved
at all, where `block: 'nearest'` could still nudge it vertically.

The one third is a named constant in `StaffView.tsx`, not a player preset in `src/config.ts`:
the owner picked a value, not a control.

The glide comes from CSS, not from `scrollTo({ behavior: 'smooth' })`: `scroll-behavior: smooth`
on `.staff-view`, inside `@media (prefers-reduced-motion: no-preference)`. That is one rule, and it
turns the glide off for anyone whose system asks for less motion, which the script option would
not do without a second check. Setting `scrollLeft` is then smooth or instant by the stylesheet.

Alternatives weighed:

- **Keep `scrollIntoView` and pass `inline: 'center'`.** Rejected. It centres rather than holding
  a third, and like today's call it can scroll ancestors of the pane, which setting `scrollLeft`
  cannot.
- **Keep `scrollIntoView` with `inline: 'start'` and `scroll-padding-inline-start: 33.333%` on
  the pane.** Roughly equal: no rect arithmetic, and the third sits in CSS beside the glide. Not
  taken, because it keeps the ancestor scrolling this step otherwise removes.
- **Scroll only once the marker passes the third, and never back.** Rejected. Restart and the loop
  wrap move the marker backwards, and "never back" would leave it off-screen; and telling
  backwards from forwards means remembering where it was, which the "reset and re-scan, never
  tracked" entry exists to avoid. Setting the position from scratch on every move needs neither.
- **Jump on backward moves, glide on forward ones.** Rejected for the same reason: it needs the
  previous position. A Restart glides back across the piece, which is short.

## Traps

- **The demo moves the cursor too** (step 20). At 150% a step can be about 303 ms, which is close
  to how long Chromium's smooth scroll takes. A new `scrollLeft` retargets a running glide rather
  than queueing behind it, so the pane may trail the marker slightly in a fast run but does not
  fall further behind. Say in the manual check whether that is visible.
- **The e2e checks run under `page.clock`.** Chromium's smooth scroll is driven by the compositor,
  not by the page's timers, so poll for the settled position with `expect.poll` rather than
  asserting it once.
- **jsdom has no layout**, and OSMD is stubbed there (`DECISIONS.md`, "OSMD is stubbed in jsdom").
  The position is proved in Playwright, not in `StaffView.test.tsx`. The stub's cursor
  (`src/testSetup.ts:18`) has only `cursorElement: { scrollIntoView }`, and it still reaches the
  scroll line, so every jsdom test rendering `<App />` throws until the stub gains a
  `getBoundingClientRect`.
- **The marker moves twice on each note.** OSMD redraws it at the next note at once, then the pane
  glides it back to the third, so in wait-mode it hops right and slides back left. flowkey's
  cursor stays still while the music moves. An instant jump would pin it; the owner chose the
  glide, and it is one CSS rule to change, so the manual check asks.

Two comments go stale and change with the code: the one above the scroll call at `src/score/StaffView.tsx:74-76`, which explains `'nearest'`, and `e2e/staff-cursor.spec.ts:34-35` ("a mark past the pane's right edge has to bring the pane with it"), along with that test's name.

## In scope

The scroll target in `StaffView.tsx`, the one CSS rule, the e2e check, and the amended decision.

## Out of scope

- **A player setting for the position or the glide.** The owner chose one of each.
- **Scrolling anything but the staff pane.** The finger queue does not scroll, and the keyboard is
  fixed.
- **The staff's vertical layout**, which does not change.

## What this makes harder later

Nothing is persisted. A second piece (step 22) is scrolled by the same code. If a wrapped,
multi-line staff ever came back, this horizontal rule would not apply and would be replaced, as
the single-line decision would be.

## Decisions to record in `DECISIONS.md`

Rewrite "The cursor scrolls its own pane, not the page": the pane still scrolls alone, but it now
holds the cursor a third of the way in by setting `scrollLeft` on every move, and glides via a
reduced-motion-aware CSS rule. Say why minimal scrolling was replaced (the player saw too little
ahead of the marker) and why the target is recomputed rather than tracked.

## Gate

- **Layer 3, in `e2e/staff-cursor.spec.ts`. This is the check that fails without the step.** After
  the existing test has let the demo run some fifteen bars, poll until the cursor's left edge,
  measured from the pane's left edge, is within 10% of the pane's width of one third. Under
  `block: 'nearest'` it sits near the right edge, so this fails today. Measure only while
  `scrollLeft < scrollWidth - clientWidth`: near the end of the piece the browser clamps the
  scroll and the marker legitimately sits right of the third. Assert that condition first, and
  if fifteen bars is too close to the end at the test viewport, run the demo for less.
- Add: press Stop (`listen-to-piece`), and the pane polls back to `scrollLeft` 0, since the
  cursor returns to m1 b1, where practice was waiting. Not Restart: it does not stop the demo, and
  the cursor goes on following it.
- Keep the existing `scrollLeft > 0` and `toBeInViewport` assertions, and assert that
  `window.scrollY` has not changed across the run.
- `npm run ci` green proves where the pane settles. It does not prove the glide feels right.

## Manual

In item 11, replace "the pane should scroll right on its own as the cursor reaches its edge" with:
the cursor should settle about a third of the way across and the music should glide past it, with
several notes always visible ahead; say whether the marker's hop-then-slide on each note reads
well or whether an instant jump would be calmer, and whether the glide trails the cursor visibly
when Listen plays at 150%.

## Finally

Add the step to the Planned table in `prompts/README.md` (done with this brief); move it to
Shipped when it lands.
