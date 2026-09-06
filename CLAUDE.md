# CLAUDE.md

Working agreement for AI-assisted changes in the `piano-tutor` repository.

## The project in one paragraph

A TypeScript / React / Vite web app that reads a USB piano over the Web MIDI API, developed inside
a VS Code dev container and tested with Vitest and Playwright. `README.md` is the reference for how
to run it; the two constraints that catch people out are that **Web MIDI only works on the host at
`http://localhost:5173`** (a secure context — a LAN or tailnet address silently has no
`navigator.requestMIDIAccess`), and that **the container never talks to the piano** — Playwright
drives a fake MIDI source, so a green e2e run says nothing about real hardware.

## How to implement: think first, then cut surgically

These are the standing expectations for writing the code, not advice for large changes only. They
follow Andrej Karpathy's list of recurring LLM coding mistakes.

### Think before coding

Say what you are assuming before you build on it. If the request reads two ways, put both and ask —
do not pick one silently and find out at review time that it was the other. If a simpler approach
than the one requested exists, say so _before_ implementing the complicated one; pushing back early
is cheap and a rewrite is not. If something is genuinely unclear, stop and name what is confusing
rather than writing code that papers over it.

### Simplicity first

Write the minimum code that solves the problem, and nothing speculative. No feature beyond what was
asked. No abstraction with a single use. No configurability nobody requested, and no error handling
for a state that cannot occur — TypeScript already rules most of those out, and a runtime guard on
an unreachable state is dead defensive code rather than safety. If what you wrote runs to 200 lines
and it could be 50, rewrite it before showing it to anyone.

The test to apply is the one `clean-code-reviewer` will apply afterwards: would a senior developer
seeing this cold call it overcomplicated? If yes, simplify now rather than spending a review round
on it.

### Surgical changes

Touch only what the request requires. Do not improve adjacent code, reword nearby comments, or
reformat lines the change did not need — a diff that also reformats a file is a diff nobody can
review. Match the surrounding style even where you would have written it differently. If you
notice unrelated dead code, say so in the report and leave it where it is.

Clean up your own mess, and only your own. An import, variable, helper or test fixture that _your_
change made unused goes with the change; pre-existing dead code stays until someone asks for it.
The test is that every changed line traces back to the request.

Size the change so that one reviewer can hold all of it at once. A branch that ports a whole
subsystem in a single commit does not get reviewed once and finished — it gets reviewed over and
over, because a thousand-line diff gives a cold reader a thousand lines of surface to find
something on, and each round of fixes hands them a fresh one. Where the request decomposes into
pieces that each stand on their own and each pass `npm run ci`, split them up before you start and
review them one at a time. A change that genuinely cannot be split is fine; a change that was not split because
splitting it was extra work is the one that never converges.

### Goal-driven execution

Turn the task into something that can be checked, and keep going until the check passes. "Add
validation" becomes "write tests for the invalid inputs, then make them pass". "Fix the bug"
becomes "write a test that reproduces it, then make it pass". "Refactor X" becomes "the suite
passes before and after, unchanged". For a multi-step task, state the plan as steps that each carry
their own check, and work down it.

Strong criteria are what let you finish without coming back for clarification; "make it work" is
not one. A green `npm run ci` is not by itself evidence that the requested behaviour exists — say
which check establishes that.

## Every change goes through `npm run ci`

`npm run ci` is the single gate: version lockstep check, ESLint, Prettier in check mode,
`tsc -b` and build, Vitest, Playwright — stopping at the first failure. Run it before you call work
finished. Anything a CI service would eventually run belongs in it, so pointing one at this
repository later stays a small change.

Formatting is deliberately _checked_ rather than applied, so a reformatting commit is always a
decision someone made rather than a side effect of running the tests. Do not run `npm run format`
across the repository to get past `format:check` — format the files you touched.

## Always review with two subagents

When you finish a piece of work — a story, a bug fix, a refactor — launch **two review subagents in
parallel** before you commit the work as done or open a pull request. Launch both in a single
message so they run concurrently, and give each one the original request and the diff under review.

- `functionality-reviewer` — does the change do what was requested?
- `clean-code-reviewer` — is it as simple as it could be?

They are separate on purpose. One asks whether the change is **right**; the other asks whether it
is **simple**. Those two questions pull against each other, and a single reviewer holding both will
quietly trade one away. Do not merge the briefs, do not run only one, and do not skip the pass
because the diff looks small.

Their full briefs live in `.claude/agents/`; the principles the second one applies live in
`.claude/skills/clean-code/SKILL.md`, which is the standing style guide for writing the code in the
first place, not only for reviewing it.

### Run both reviewers on Opus

Both reviewers run on **Opus**, always. Do not quietly substitute a faster or cheaper model to save
time or budget. The reviewers exist to catch what the implementing agent missed, and a weaker
reviewer does not simply find less — it produces confident findings that are wrong, which cost more
to unpick than they save.

Drop to a lower model only when Opus is genuinely unavailable: a rate or session limit, an outage.
When that happens, treat it as a caveat rather than a detail — say in the report which round ran on
which model, verify the reviewer's central claims by experiment before acting on them, and re-run
the round on Opus once capacity returns — including when the weaker round came back clean, which is
the case most likely to be wrong. That re-do is the same round run again, so it does not count
against the cap below, and the change waits for it rather than shipping on the weaker round.

The verification clause is not optional politeness. A lower-tier reviewer arguing from
documentation rather than from a run of the code can be right about a real bug and wrong about its
cause in the same finding, and acting on the wrong half redesigns something that already worked.

## Acting on the findings

Fix what the reviewers confirm **before** you commit the work as done or open a pull request — but
sort what came back first, because the two kinds cost very different amounts and only one of them
should hold the work up. Each reviewer labels its findings **blocking** or **non-blocking**, and
its brief in `.claude/agents/` defines where that line sits for it.

Fix the blocking findings now. Take a non-blocking one only where the fix is genuinely a line or
two; otherwise write it down and leave it. Say which bucket each finding went into. Without that
distinction every finding reads as an obligation and the change is never finished.

Where you disagree with a finding, say so in the commit message or pull request description with
the reasoning, rather than dropping it silently — a rejected finding that is written down can be
argued with; one that vanished cannot. The same goes for the non-blocking findings you chose not to
take.

If a reviewer returns nothing, say that plainly. An empty review is a real result and is more
useful than an invented one.

## Re-running the reviewers, and stopping

Applying a round of findings is itself a change that nobody has reviewed, so a round of real fixes
earns another pass. **Re-run when the last round produced a blocking finding and you fixed it**,
launching both reviewers again as before. A round with no blocking findings ends the loop.

**Three rounds is the cap.** If a third round still returns blocking findings, fix them and hand
the change back to whoever asked for it instead of reviewing again — say which findings prompted
that and what you did about them. Do not commit it as done, and do not restart the count by
splitting the work yourself; that call is theirs.

On a re-run, tell the reviewers it is a re-review and point them at the fix commit, but give them
the whole change as it will ship rather than only the delta. Ask them to judge the current state on
its own terms: whether the fixes are correct, whether they introduced anything new, and — for the
clean-code reviewer — whether a simplification genuinely simplified or merely relocated the
complexity. Do not hand over the previous findings as a checklist to confirm; a reviewer told what
the last one concluded stops looking.

## House rules for the code itself

- **Exact versions everywhere.** Dependencies are pinned exactly, the base image by digest. When
  bumping Playwright, change both `package.json` and `PLAYWRIGHT_VERSION` in
  `.devcontainer/Dockerfile`; when bumping Claude Code, change both `CLAUDE_CODE_VERSION` in
  `.devcontainer/Dockerfile` and the pinned extension in `.devcontainer/devcontainer.json` —
  `scripts/check-version-lockstep.mjs` fails the build otherwise. TypeScript stays on the 6.x
  line until `typescript-eslint` supports 7.
- **Prefer tests that exercise real wiring** over unit tests built from heavy mocking. Where a
  behaviour can be pinned down through the rendered component or the running app, do that instead
  of asserting on a mock.
- **Do not give the container access to the piano.** No `/dev/snd`, no ALSA bridge. Hardware is
  verified by hand on the host, and the report should say so rather than implying the suite covered
  it.
