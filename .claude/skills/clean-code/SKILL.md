---
name: clean-code
description: Enforce Clean Code, simplicity, and surgical changes in this TypeScript/React codebase.
---

# Clean Code and Simplicity

When working on this repository, strictly adhere to these principles:

1. **Keep it Simple**: Write the simplest code that works. Avoid over-engineering.
2. **Small Functions**: Each function, hook and component should do exactly one thing. Extract
   nested logic and complex operations into smaller helpers.
3. **Avoid Deep Nesting**: Use early returns instead of nested `if` statements to keep the code
   flat. The same applies to JSX — prefer an early `return null` over a pyramid of ternaries.
4. **Descriptive Names**: Variable, function, component and test names should clearly describe
   their intent. A test name states the behaviour it pins down, not the function it calls.
5. **DRY (Don't Repeat Yourself)**: Extract duplicated logic — render helpers, fake MIDI setup,
   Playwright page fixtures — into reusable functions or fixtures rather than copying blocks
   between tests.
6. **Surgical Changes**: When editing existing code, make localized and surgical changes.
   Refactor precisely without rewriting the entire file.

## This repository in particular

- **Let the toolchain do the work.** ESLint and Prettier are configured and run in `npm run ci`.
  Do not hand-format, do not add rule-disabling comments to get past a lint error, and do not
  reformat code the change did not touch.
- **Types over runtime guards.** If TypeScript already makes a state unreachable, a runtime check
  for it is dead defensive code, not safety.
- **Exact versions.** Every dependency is pinned exactly and the dev container image is pinned by
  digest. A caret or tilde in `package.json` is a defect.
