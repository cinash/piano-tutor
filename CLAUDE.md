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
should hold the work up. Each code reviewer labels its findings **blocking** or **non-blocking**,
and its brief in `.claude/agents/` defines where that line sits for it.

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

## Planning documents go through a different gate

Everything above is the gate for **code**. A **planning document** — a `prompts/stepN.md` brief, a
planned section of `prompts/README.md`, any document that commits the project to building
something — goes through this one instead.

Not because the code reviewers cannot read prose. The record shows they can: they have been run on
briefs repeatedly, four rounds on the steps 9-14 plan, and what they found there were real defects
— a gate that would have passed on the very bug its step existed to prevent among them. What they
have never produced is the thing a plan needs most, which is a consolidated list of the questions
that are the **owner's** to answer. Worse, a reviewer whose bias is simplicity will quietly take
those questions away: review round 1 on step 9 stripped a configurable keyboard width as
"configurability nobody asked for", the owner asked directly answered "preferably configurable",
and the step had to be rewritten (`9ff142f`). That episode is what this gate exists for.

### Which gate applies

- **Decides what will be built** — a brief in `prompts/` or `.claude/prompts/`, a planned section
  of `prompts/README.md`, a `DECISIONS.md` entry that commits the project forward rather than
  recording a choice already made: **this gate**.
- **Changes how the work is done** — this file, a reviewer brief in `.claude/agents/`, a skill in
  `.claude/skills/`: **this gate**. A rule commits the project as surely as a plan does.
- **Describes what already exists** — `README.md`'s instructions, a `DECISIONS.md` entry that only
  records, the wording of `MANUAL-CHECKS.md`: no gate of its own. It rides along in the code gate
  when it ships with code, and is an ordinary edit when it does not.
- **Code**: the sections above, unchanged.

Gate the brief **before** the code it plans is written; that is the whole of its value. A single
change carrying both a brief and its implementation is one that should have been split, and the
plan gate cannot do its job on it — an **ask** it returns is a question the code has already
answered. Where one arrives anyway, run the code gate and say in the report that the plan went
ungated.

There is a floor: a typo, a link, a formatting fix, or moving a step from Planned to Shipped
decides nothing and earns no round. Formatting needs no step of its own either, since `npm run ci`
runs `prettier --check .` across the repository and these files are in it. Two things no tool
checks — that every link in `prompts/README.md` resolves, and that its table matches what has
actually shipped. Both are by hand, and the second is worth a script the day someone tires of it.

### The two plan reviewers

Launch **both in parallel, in a single message**, before the brief is handed to an implementing
agent, and give each the original request and the document. `plan-tradeoff-reviewer` asks whether
this is the right thing to build; `plan-gap-reviewer` asks what the document does not say and whose
question that is. **The Opus rule above applies unchanged.** Their briefs live in `.claude/agents/`
and both apply `.claude/skills/planning-docs/SKILL.md`, which is the standard for **writing** a
brief in the first place, not only for reviewing one.

### Findings: blocking, non-blocking, and ask

The two labels above carry over unchanged, so one vocabulary covers both gates. Plan reviewers add
a third, and it is the one they exist for.

**ask** — the choice belongs to the owner: taste, priorities, what they are willing to live with,
what music or hardware they will supply. **Do not answer it yourself**, and do not settle it with a
sensible default and a footnote. Put the asks to them as **one numbered list, five at most across
both reviewers together**, merged and ranked by what a wrong answer would cost; the ones that do
not fit go into the brief as open questions rather than being dropped. `SKILL.md` says how to
phrase them.

### Finishing: a plan may ship with a question open

This replaces "green CI" as the finishing condition, and it is narrower than it first looks. A
brief is finished when every **ask** has been answered — or, where the answer would not change what
the document instructs, is recorded in it as a named precondition saying what happens under each
answer. `step22.md` is the worked example: it cannot start until a second piece exists, and it says
what happens whether the owner authors one or the project transcribes public-domain material.

That escape is only for a question of that shape. An **ask** whose answer would rewrite the step —
step 9's keyboard width was one — is not made finished by writing it down; it waits. A brief
carrying an unanswered ask of either kind does not go to an implementing agent until it has been
recorded or answered.

### Re-running, and stopping

Re-run both when a round produced **blocking** findings you acted on, or when the owner's answer
changed the document — an answered ask can rewrite a brief, and a rewritten brief is unreviewed. A
round with no blocking findings and no unrecorded **ask** ends the loop. A brief amended once
implementation is under way re-enters the gate for the amendment, and the implementer keeps going
on the parts it does not touch.

**Three rounds, as for code**, and for the same reason: the steps 9-14 plan needed four, and its
last two rounds found defects rather than disagreement, so a lower cap would have shipped them. A
round the owner's answer caused does not count against the cap, exactly as an Opus re-do does not.

An empty plan review is a weaker result than an empty code review: say which futures were played
forward and which alternatives were weighed, or the emptiness means nothing.

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
