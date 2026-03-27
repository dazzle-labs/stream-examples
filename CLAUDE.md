# CLAUDE.md

## Critical Rules

1. **Use `mv`/`cp`/`rm` for file ops.** Preserves git history, fewer tokens.
2. **Never use em dashes in prose.** Use commas, periods, colons, semicolons, or parentheses.
3. **Just break it.** No backwards compatibility, no fallbacks, no legacy support. One pass, complete.
4. **No quick fixes that defer the real fix.** If the architecture needs a change, make that change.
5. **NEVER use `&` to background shell processes.** Use the Bash tool's `run_in_background: true` parameter instead.

## About This Repo

Public examples repo for [Dazzle](https://dazzle.fm). Each directory is a standalone, runnable example that demonstrates live streaming patterns. These get linked from documentation and are the first thing people see. They must be correct, visually stunning, and easy to run.

## Code Quality

- **TypeScript everywhere.** Strict mode, zero `any` types, no semicolons, single quotes, trailing commas.
- **No type safety bypasses.** Never use `as any`, `as unknown`, type assertions, `// @ts-ignore`, or `// @ts-expect-error`. Fix the root cause.
- **Examples must be self-contained.** Each example directory is independently runnable. No shared dependencies across examples.
- **Minimal dependencies.** Only import what the example actually needs.

## Work Style

- **Delegate to subagents aggressively.** Main thread is coordination + user communication ONLY.
- **ALWAYS run agents in background.** Every Agent call must use `run_in_background: true`.
- **Parallelize aggressively.** Independent parts get multiple simultaneous agents.
- **Always use latest model IDs.** Search the web for current latest before hardcoding any model string.
- **Stage isolation is critical.** Every `dazzle` command MUST include `--stage <name>` explicitly. Never rely on the default stage.

## Communication

- **Link to everything.** Always include file paths. Use absolute paths.
- **Always give clickable links.** When creating PRs, deploying, or touching anything with a URL.

## Content Authoring

Follow the Dazzle content authoring guide: https://dazzle.fm/guide.md

## Examples Structure

- Each example lives in its own directory at the repo root
- Each is independently runnable
- API keys come from environment variables, never hardcoded
- CLI commands always use full unabbreviated names: `dazzle stage create`, `dazzle stage up`, `dazzle stage screenshot --out`
