# CLAUDE.md

Public examples repo for [Dazzle](https://dazzle.fm). Each directory is a standalone, runnable example that demonstrates live streaming patterns -- from cinematic motion graphics to real-time AI coding visualizations. These get linked from documentation and are the first thing people see. They must be correct, visually stunning, and easy to run.

## Code Quality

- **TypeScript where applicable.** Examples that use a build step (like `remotion-stream`) use TypeScript with strict mode, zero `any` types, no semicolons, single quotes, trailing commas.
- **No type safety bypasses.** Never use `as any`, `as unknown`, type assertions, `// @ts-ignore`, or `// @ts-expect-error`. Fix the root cause.
- **Plain HTML examples are fine.** `hello-world` and `claude-code-stream` are single `index.html` files with no build step. That's a feature -- it proves the pipeline needs nothing more than a browser.
- **Examples must be self-contained.** Each example directory is independently runnable. No shared dependencies across examples.
- **Minimal dependencies.** Only import what the example actually needs. No kitchen-sink installs.

## Breaking Changes

- **Just break it.** No backwards compatibility. No fallbacks. No legacy support. When something changes, update it everywhere in one pass.
- **No quick fixes that defer the real fix.** If the architecture needs a change, make that change.

## Communication

- **Link to everything.** Always include file paths when referencing files. Use absolute paths.
- **Always give clickable links.** When creating PRs, deploying, or touching anything with a URL -- include the link.

## Work Style

- **Delegate to subagents aggressively.** Main thread is coordination + user communication ONLY. All coding, file reading, screenshots, and evaluation goes to subagents. The main thread should NEVER read files, take screenshots, or grep code — spawn an agent for it.
- **ALWAYS run agents in background.** Every Agent call must use `run_in_background: true`.
- **Parallelize aggressively.** Independent parts get multiple simultaneous agents.
- **NEVER use `&` to background shell processes.** Use the Bash tool's `run_in_background: true` parameter instead.
- **Always use latest model IDs.** Before hardcoding any model string, search the web for the current latest. What's in your training data is stale.
- **Never dismiss errors as "pre-existing."** Every error you encounter is your responsibility.
- **Stage isolation is critical.** Every `dazzle` command MUST include `--stage <name>` explicitly. NEVER rely on the default stage. The stage-to-content mapping is: `hello-world` syncs from `hello-world/dist/`, `remotion-stream` syncs from `remotion-stream/dist/`, `claude-code-stream` syncs from `claude-code-stream/dist/`. Syncing the wrong directory to the wrong stage overwrites a live stream. Agents CAN and SHOULD use dazzle freely (sync, screenshot, refresh, broadcast) — just always pass `--stage`.

## Documentation Philosophy

- **Examples ARE the documentation.** The code itself should be clear enough to learn from. Comments explain WHY, not WHAT.
- **No implementation docs.** Implementation lives in code -- types, function signatures, inline comments.
- **Every example needs a README** with: what it demonstrates, how to run it, what you should see.
- **No inventory docs.** The filesystem IS the inventory.

## Examples Structure

- Each example lives in its own directory at the repo root
- Plain HTML examples (`hello-world`, `claude-code-stream`): just `index.html` and `README.md`, runnable by syncing the directory to a Dazzle stage
- Build-step examples (`remotion-stream`): `package.json`, `tsconfig.json`, source files, `README.md` -- runnable with `npm install && npm start`, deployable by building and syncing `dist/`
- Each is independently runnable -- no monorepo tooling needed
- API keys come from environment variables, never hardcoded
- CLI commands always use full unabbreviated names: `dazzle stage create`, `dazzle stage broadcast start`, `dazzle stage screenshot --out`
