---
name: planning-docs
description: How to write a planning document in prompts/ — what a brief must contain, and how to weigh a choice in writing before any code exists.
---

# Planning documents

A brief in `prompts/` is the document that decides what gets built, before anything is built. It
is handed to an implementing agent, and it outlives the work as the record of what was actually
asked — alongside `DECISIONS.md` for the non-obvious choices and `MANUAL-CHECKS.md` for what only
a real piano can confirm.

A brief fails differently from code. Code fails by crashing, and the suite catches it. A brief
fails by getting the right thing built that nobody wanted, or by leaving a choice to be invented
at the keyboard that the owner would have made differently — and nothing catches that except
someone reading it and arguing. That is what the planning gate in `CLAUDE.md` is for, and what
this document is the standard for.

## What a brief contains

Not every part applies to every step, but a part left out should be left out on purpose. And a
document that governs the work rather than the app — a change to `CLAUDE.md`, a reviewer brief, a
skill — goes through the same gate but not this anatomy, which is a step brief's: take the parts
that fit, usually the goal, the choice and what it rejects, what this makes harder later, and the
open questions, and leave the rest.

1. **A head paragraph.** What the step does, which files it touches, whether it adds a dependency,
   and the branch it goes on. A reader should be able to size it from this alone.
2. **The goal.** One or two sentences: the complaint this answers, in the player's words where
   there are any.
3. **The choice, and what it rejects.** For every non-obvious decision, the alternative that was
   not taken and why. A choice with no alternative written down reads as the only option, and the
   next reader cannot tell whether it was weighed or assumed.
4. **The traps.** What will not fall out of the change on its own — the effect that never re-runs,
   the state deliberately kept across a restart, the thing two steps away that breaks quietly.
5. **In scope, and out of scope.** Both explicit, both with reasons. An exclusion without its
   reason cannot be told apart from an oversight.
6. **What this makes harder later.** Play the plan forward against a couple of futures this
   project plausibly has, and say which choices would have to be undone to reach them. Flag
   anything genuinely one-way — a persisted format, an exported JSON shape, a file committed to
   the repository — because those want the owner's explicit yes.
7. **Open questions for the owner.** What the brief could not settle alone, each with the options,
   the answer you would pick, and what it costs if that pick is wrong. The recommendation makes the
   question cheap to answer; it does not stand in for the answer. Where the answer would not change
   what the brief instructs — an external dependency, like a second piece of music that only the
   owner can supply — record it as a named precondition saying what happens under each answer, and
   the brief is finished. Where the answer would rewrite the step, it waits.
8. **Decisions to record in `DECISIONS.md`.** The ones a future reader would otherwise
   re-litigate.
9. **The gate.** Layered — the data, the component, the running app — and honest about what it
   cannot prove. Name the check that would fail if the feature were absent.
10. **Manual.** What only the real piano can confirm, as an extension of an existing
    `MANUAL-CHECKS.md` item where one fits.
11. **Finally.** The bookkeeping: add the step to `prompts/README.md`, and move it to Shipped when
    it lands. This part is for numbered steps in `prompts/`; the briefs in `.claude/prompts/` are
    about the container and the tooling rather than the app, and that table does not list them.

## How to write it

- **Say why, not just what.** The what is a sentence; the why is what survives to the next reader
  and what lets an implementer make the small decisions the brief did not reach.
- **Name things precisely.** Files, symbols, line numbers. A brief that says "the score module"
  where it could say `src/score/cichaNoc.ts` costs the implementer a search, and a citation is a
  claim someone can check.
- **Prose where the reasoning matters.** Bullets are for lists of things, not for arguments.
- **One sitting.** A brief a reviewer cannot hold in their head at once describes a step that
  should have been split.
- **No `Status:` line.** The shipped-versus-planned split lives in the table in
  `prompts/README.md` and nowhere else, so it cannot disagree with itself.
- **A deferred ask becomes a numbered brief.** When a request is put off rather than dropped, it
  gets its own file in `prompts/` — a line in a report is not a plan and will not be found again.

## This repository in particular

- **The UI reference is flowkey** — notation, a keyboard showing the next keys, hand colours,
  wait-mode. Not a Synthesia-style falling-bar game. A brief proposing something the reference
  point does not do should say that is what it is doing.
- **Check the hardware before planning around it.** Anything that depends on what the Yamaha P-145
  can actually do — its MIDI implementation, its ports, its sounds — gets checked against its
  documentation while the plan is being written, not discovered by the owner at the piano
  afterwards.
- **The container never talks to the piano.** Playwright drives a fake MIDI source, so a gate that
  claims to cover real hardware is wrong. Put it under Manual.
- **Web MIDI needs `localhost` on the host.** Any plan that moves the app off it removes
  `navigator.requestMIDIAccess` silently.
- **Reopen a closed decision in the open.** `prompts/README.md` lists what is deliberately not
  planned — tempo control most of all. Wanting one back is a decision to reverse deliberately, in
  writing, not a gap to fill quietly inside another step.
