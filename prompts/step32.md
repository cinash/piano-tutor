# Step 32 — Timed mode for wait-only pieces

Step 30 accepts rhythm that Timed mode cannot keep time through (6/8, 2/2, 3/8, 9/8, 12/8, sixteenths, triplets, 32nds, time-signature changes). Such a
piece is marked as working only in Wait mode, and Timed is not offered for it (`prompts/step30.md`, check 6 and Wait-only pieces). The owner's
words: "for the timed mode not supporting, just mark it as it works only in wait mode, and maybe later we support more."

This brief is deferred. It is the "later" the owner named. Its purpose is to extend Timed mode so that a wait-only piece can become a timed one, one
rhythm at a time, and to remove the wait-only mark as each is supported.

## Why it is not in step 30

Step 30 marks; it does not change Timed mode. Timed mode is defined in step 29 (`prompts/step29.md`), and that definition covers quarter-note
time signatures and events at least half a beat apart. Extending it is a change to the timing model, and it should be done one rhythm at a time, with
a test for each, not all at once.

## What it would need to answer first

1. **Which rhythm comes first.** The owner's arrangements decide that. Candidates: 6/8, which the owner's lullabies likely use; triplets, which the staff
   cursor needs the tolerance from step 30 for; then 2/2, 3/8, 9/8 and 12/8, and sixteenths.
2. **How each rhythm is timed.** Each time signature has its own beat, and the timing rule in step 29 counts quarter notes. A dotted-quarter beat in 6/8 is
   a different beat from a quarter in 4/4.
3. **Whether the wait-only mark disappears by itself.** The mark is derived on each load (`prompts/step30.md`), so a piece lifts out of wait-only as soon as
   the rule accepts it. No stored state needs changing.
4. **What a child sees when a rhythm is not yet supported.** The mark and the disabled Timed option, as in step 30.

## Gate, when started

- Data: one fixture per rhythm that is newly supported, checked by the timed rule in `pieceRules.ts`; the wait-only mark disappears for it and stays for the rest.
- Component: the Timed option is enabled for a newly supported piece and still disabled for the others.
- Bundled pieces: the change must not alter the timed behaviour of any bundled piece that already plays in Timed mode (`pieces.test.ts`).
- Manual: the owner plays one newly supported arrangement in Timed mode on the piano and confirms the beat counts with the child.
