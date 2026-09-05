# CLAUDE.md

Working agreement for AI-assisted changes in the `piano-tutor` repository.

## The project in one paragraph

A TypeScript / React / Vite web app that reads a USB piano over the Web MIDI API, developed inside
a VS Code dev container and tested with Vitest and Playwright. `README.md` is the reference for how
to run it; the two constraints that catch people out are that **Web MIDI only works on the host at
`http://localhost:5173`** (a secure context — a LAN or tailnet address silently has no
`navigator.requestMIDIAccess`), and that **the container never talks to the piano** — Playwright
drives a fake MIDI source, so a green e2e run says nothing about real hardware.

## Every change goes through `npm run ci`

`npm run ci` is the single gate: Playwright lockstep check, ESLint, Prettier in check mode,
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
the round on Opus once capacity returns if it found anything significant.

The verification clause is not optional politeness. A lower-tier reviewer arguing from
documentation rather than from a run of the code can be right about a real bug and wrong about its
cause in the same finding, and acting on the wrong half redesigns something that already worked.

## Acting on the findings

Fix what the reviewers confirm **before** you commit the work as done or open a pull request. Where
you disagree with a finding, say so in the commit message or pull request description with the
reasoning, rather than dropping it silently — a rejected finding that is written down can be argued
with; one that vanished cannot.

If a reviewer returns nothing, say that plainly. An empty review is a real result and is more
useful than an invented one.

## Re-run the reviewers when the fixes were significant

Applying a round of findings is itself a change, and often a large one — deleting configuration,
altering control flow, changing a default, rewriting tests. That new code has been reviewed by
nobody. **When the fixes were significant, launch both reviewers again on the updated branch**, and
keep going until a round produces no significant changes.

Judge significance by what actually changed, not by how the work was labelled. These count:

- behaviour or control flow (an error path that now retries instead of giving up)
- a default value, a component's props, a function signature, or anything else callers can see
- configuration added or removed — `vite.config.ts`, `playwright.config.ts`, the ESLint config,
  the dev container, `package.json`
- tests added, rewritten, or deleted

A typo, a reworded comment or a doc tidy does not. When you skip the re-run, say which of these you
checked and why none applied — an unexamined "it was only small" is how an unreviewed change ships.

On a re-run, tell the reviewers it is a re-review and point them at the fix commit, but give them
the whole change as it will ship rather than only the delta. Ask them to judge the current state on
its own terms: whether the fixes are correct, whether they introduced anything new, and — for the
clean-code reviewer — whether a simplification genuinely simplified or merely relocated the
complexity. Do not hand over the previous findings as a checklist to confirm; a reviewer told what
the last one concluded stops looking.

## House rules for the code itself

- **Exact versions everywhere.** Dependencies are pinned exactly, the base image by digest. When
  bumping Playwright, change both `package.json` and `PLAYWRIGHT_VERSION` in
  `.devcontainer/Dockerfile` — `scripts/check-playwright-lockstep.mjs` fails the build otherwise.
  TypeScript stays on the 6.x line until `typescript-eslint` supports 7.
- **Prefer tests that exercise real wiring** over unit tests built from heavy mocking. Where a
  behaviour can be pinned down through the rendered component or the running app, do that instead
  of asserting on a mock.
- **Do not give the container access to the piano.** No `/dev/snd`, no ALSA bridge. Hardware is
  verified by hand on the host, and the report should say so rather than implying the suite covered
  it.
