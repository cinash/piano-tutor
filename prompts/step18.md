# Step 18 — Fold the finger queue away

Depends on step 15 for the reason it exists, and touches `App.tsx` and `FallingNotes` only.
One branch, `step-18-fold-queue`, off `main`.

## Goal

Let the player put the finger-number queue away. Step 15 put the notation on screen, and the
staff and the queue now answer overlapping questions in a column that no longer fits a laptop
window: the score takes 320 px, the queue another 160, and the on-screen keyboard — the one
element that has to be visible while the hands are on the real one — has been pushed below the
fold. The player asked for this directly after seeing the staff land.

This is a visibility control, not a change to what the queue shows.

## Confirmed decision — fold the queue, not the fingerings on the staff

"The hands with numbers below the notes" reads two ways, and the player confirmed which: it is
the strip of colour-coded finger circles that `FallingNotes` renders below the staff, not the
fingering digits OSMD engraves on the score itself. The engraved fingerings stay exactly as
they are, and no OSMD option is touched by this step.

## Confirmed decision — the queue is hidden, not unmounted from the engine

Folding is a display choice and must not change what the engine waits for, what the position
readout says, or what an attempt records. The engine has never known the queue exists — step 4
built it as a pure view of `score.events` — so keeping it that way is the cheap option as well
as the correct one. A folded queue that quietly stopped an attempt being recorded, or that
behaved differently from an unfolded one on a wrong note, is the failure this decision rules
out.

Whether "hidden" means not rendered at all or rendered with `hidden` is an implementation
detail with one constraint, in the gate below.

## In scope

- A control next to the queue that folds and unfolds it, labelled so it says which state it is
  in. Match `LoopPicker`'s existing checkbox idiom rather than inventing a disclosure widget;
  a `data-testid` on it, as every other control in `App.tsx` carries.
- The fold state lives in `App.tsx` beside `keyboardPreset` and `hands`, which are the two
  existing pieces of view-only state, and is passed down. It is not engine state and does not
  belong in `PracticeViewState`.
- **Remembering the choice across a reload.** A player who folds the queue means it, and having
  it come back on every refresh is the thing that makes such a control not worth using.
  `localStorage`, alongside the attempt history, and reading it must tolerate a missing or
  corrupt value the way `attemptStore.ts` already does — that file is the pattern to copy, not
  a new one to invent.
- Whatever `DECISIONS.md` needs so that a later reader does not "simplify" the fold into the
  engine.

## Out of scope

- **A fold for anything else.** Not the staff — `step15.md` put a control to hide it out of
  scope and nothing since has changed that — not the keyboard, not the history. One control,
  one thing folded. If the screen is still too tall afterwards, that is the next step's
  evidence, gathered honestly.
- Animating the fold. A transition is a nicety that buys a `prefers-reduced-motion` question
  and a flaky screenshot, and nobody asked for one.
- Re-laying-out the page, moving elements, or reclaiming the space for something else. The
  elements below simply move up.
- Any change to what the queue draws when it is visible: the five finger colours, the wrong-note
  treatment and the loop-boundary behaviour are all step 4's and step 5's, and are pinned by
  committed screenshots.

## Decisions to record in `DECISIONS.md`

- That the fold is view state in `App.tsx` and never reaches the engine, with the reason:
  practice must be identical folded and unfolded.
- That the choice persists in `localStorage`, and what a missing or unreadable value does.

## Gate

- Layer 2: fold the queue and assert it is gone from the page; unfold it and assert it is back.
  Then the one that matters — **with the queue folded, play the opening measure through the
  virtual keyboard and assert the engine advanced exactly as it does unfolded.** That is the
  assertion that pins the decision above, and it is worth more than the two visibility ones.
- Layer 2: a second mount reads the stored choice back.
- **Layer 3 carries a trap.** `falling-notes-*.png` and `piano-keyboard-*.png` are element
  screenshots, and the queue's top row of pixels contains a sliver of whatever sits immediately
  above it — `step15.md` and the entry it left in `DECISIONS.md` record how that was found and
  what it cost. So a fold control placed between the loop picker and the queue will fail those
  snapshots even though nothing about the queue changed. Put the control where it does not
  disturb them, confirm by running the suite, and **do not re-bless the snapshots to get past
  it** — they are step 4's and step 13's record, and this step has no business changing what
  the queue or the keyboard look like.
- No new committed screenshot. A folded queue is an absence, and `toBeVisible()` says it better
  than a picture of nothing.
- `npm run ci` green proves the wiring; that the screen is actually more usable with the queue
  folded is the manual check.

## Manual

Extend item 11 rather than adding a twelfth: with the real piano connected, fold the queue and
confirm the staff and the on-screen keyboard are both visible at once without scrolling, that
playing the piece still behaves exactly as it did unfolded, and that the choice survives closing
and reopening the tab.
