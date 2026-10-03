# Step 31 — Replacing and removing an uploaded piece

The owner's words, deferred from step 30: "those will be features in the future, but not now". Step 30 lets the owner upload a piece in the
browser. It cannot replace an upload with a corrected file, and it cannot remove one. A correction today is a new piece under a new title,
with its own history, and the old upload stays in "Yours" (`prompts/step30.md`, Identity).

This brief is deferred. It is written so the owner can say when to start, and so the questions it raises are on record before anyone builds it.

## Why it is not in step 30

Replacing and removing both reach into the history. Each raises a question step 30 has no answer to: how a replacement is matched to the piece it
replaces, whether a removed piece's history stays readable, and whether a removed piece's title can come back. The owner chose to defer that
rather than answer it now.

## What it would need to answer first

1. **How a replacement is matched.** By the piece's id, chosen by the owner from a list, or by title. Step 30 refuses a same-title upload, so matching by
   title needs a rule for the replacement case.
2. **What removal does to history.** Keep a tombstone so history still names the piece, drop the record and let history show a bare id, or keep the record
   and hide it. Each is a different trade for the child's history.
3. **Whether a removed title can come back, and under which id.** A re-upload could revive the old id, get a new id, or be refused.
4. **How removal is confirmed.** A Remove button on the selected upload, or a list with a button on each upload, and whether it asks first. A child can click it.
5. **Whether a replacement keeps its history.** Replace-by-id keeps history with the piece; a fresh upload with the corrected file does not.

## Open questions for the owner

These are for the owner to answer when the step is started, not now. Each has a recommendation, and the first two are the ones that matter most.

- Matching a replacement: by id, chosen from a list (recommended), or by title.
- Removal and history: keep a tombstone so history still names the piece (recommended), or show a bare id.
- A removed title coming back: revive the old id (recommended), or a new id.
- Removal control: a button on the selected upload with a confirmation (recommended), or a list with a button on each upload.

## Gate, when started

- Data: the replacement and removal rules in `src/score/uploads.test.ts`, including a tombstone case if the answer keeps one.
- Component: the Replace and Remove controls, the confirmation, and the Piece column after each.
- E2E: a replacement keeps history on a fixture; a removal does not leave the child on a missing piece.
- Manual: the owner removes an upload they made by mistake and confirms the child's list and history look as the owner expects.
