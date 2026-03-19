# CLAUDE.md

Public examples repo. Each directory is a standalone, runnable example that demonstrates streaming patterns with the Anthropic SDK. These get linked from documentation — they must be correct, minimal, and easy to follow.

## Code Quality

- **Everything in TypeScript.** Strict mode, zero `any` types. No semicolons, single quotes, trailing commas.
- **No type safety bypasses.** Never use `as any`, `as unknown`, type assertions, `// @ts-ignore`, or `// @ts-expect-error`. Fix the root cause.
- **Examples must be self-contained.** Each example directory should have its own `package.json` and be runnable with `npm install && npm start` (or equivalent). No shared dependencies across examples.
- **Minimal dependencies.** Only import what the example actually needs. No kitchen-sink installs.

## Breaking Changes

- **Just break it.** No backwards compatibility. No fallbacks. No legacy support. When something changes, update it everywhere in one pass.
- **No quick fixes that defer the real fix.** If the architecture needs a change, make that change.

## Communication

- **Link to everything.** Always include file paths when referencing files. Use absolute paths.
- **Always give clickable links.** When creating PRs, deploying, or touching anything with a URL — include the link.

## Work Style

- **Delegate to subagents aggressively.** Main thread is coordination + user communication. Coding goes to subagents.
- **ALWAYS run agents in background.** Every Agent call must use `run_in_background: true`.
- **Parallelize aggressively.** Independent parts get multiple simultaneous agents.
- **NEVER use `&` to background shell processes.** Use the Bash tool's `run_in_background: true` parameter instead.
- **Always use latest model IDs.** Before hardcoding any model string, search the web for the current latest. What's in your training data is stale.
- **Never dismiss errors as "pre-existing."** Every error you encounter is your responsibility.

## Documentation Philosophy

- **Examples ARE the documentation.** The code itself should be clear enough to learn from. Comments explain WHY, not WHAT.
- **No implementation docs.** Implementation lives in code — types, function signatures, inline comments.
- **Every example needs a README** with: what it demonstrates, how to run it, what you should see.
- **No inventory docs.** The filesystem IS the inventory.

## Examples Structure

- Each example lives in its own directory at the repo root
- Each has: `package.json`, `tsconfig.json`, source files, `README.md`
- Each is independently runnable — no monorepo tooling needed
- API keys come from environment variables, never hardcoded
