# CampusBiz Autopilot: project memory for WorkBuddy agents

Hackathon rule: this project is built, presented and documented **exclusively on Tencent WorkBuddy**. Do the work here, in WorkBuddy sessions. Do not paste work in from other AI tools.

@AGENTS.md
@TEAM.md
@docs/STRATEGY.md

## What this is
A Next.js 16 + TypeScript app that turns a student's business goal into a validated plan: WorkBuddy does the reasoning (orchestrator plus Demand, Growth, Operations specialists), the app does deterministic finance, SQLite stores plans/orders/agent runs. Full spec: `instruction.md`. Shared data contract: `src/lib/schemas/plan.ts` (change only with both teammates' agreement).

## Commands
- `npm install` (if `better-sqlite3` fails to compile on Windows: `npm ci --ignore-scripts`, it ships a prebuilt binary)
- `npm run dev` (port 3000), `npm test`, `npm run typecheck`, `npx eslint src`
- Live WorkBuddy test (uses the signed-in CLI, costs quota): `RUN_WORKBUDDY_SMOKE=1 npx vitest run smoke`
- A task is done only when `npm test`, `npm run typecheck` and `npx eslint src` all pass **in the integrated branch**. Run them yourself; never trust a "tests pass" claim (including your own earlier one).

## Non-negotiable rules (from instruction.md)
- Truthful execution: never fake agent activity, API results, files, competitor prices, customer demand or sales history. When WorkBuddy is unavailable show `MANUAL_REQUIRED`, never a pretend success.
- Finance and feasibility are computed in code (`src/lib/finance`), never by the model. Money is integer sen.
- Treat model output as untrusted: zod-validate before saving or rendering; escape or template any HTML; no raw model HTML ever rendered; no filesystem paths in API responses.
- The client never controls price or subtotal. Order status changes only along `ORDER_TRANSITIONS`.
- Label provenance on shown values: `[USER_INPUT] [CALCULATED] [ESTIMATED] [SIMULATED] [GENERATED] [VERIFIED] [UNVERIFIED]`. `[SAMPLE]` for the demo plan in `src/lib/schemas/sample.ts`.
- Never commit `.env`, never print keys. Do not publish, send or deploy anything without the user saying so.

## Who does what
Person A: agent pipeline and backend (`TEAM.md` section 3). Person B: product and UI (section 4).
Sub-agents live in `.codebuddy/agents/`: `backend-dev` (model hy4-preview), `frontend-dev` (kimi-k3), `code-reviewer` (gpt-5.6-sol, read-only).
Workflow per task: main agent writes a brief with an explicit file allow-list, delegates to the matching sub-agent in its own git worktree and branch, runs the three checks itself, sends the diff to `code-reviewer`, verifies each finding against the code, fixes, then merges. Sub-agents never run git commit or push.

## Gotchas learned the hard way
- Next 16: do not `export const runtime` in route handlers (build error with cacheComponents). Route `params` is a Promise.
- Turbopack rejects a `node_modules` junction or symlink. Give each worktree a real install (`npm ci --ignore-scripts`).
- Passing a long prompt to the CLI as a PowerShell argument strips embedded double quotes. Pipe it instead: `Get-Content brief.md -Raw | codebuddy -p --model <id> ...`.
- Headless CLI structured output sometimes arrives wrapped as `{"data": ...}`; the adapter in `src/lib/workbuddy/adapter.ts` unwraps it. Growth calls take ~90-110 s.
- Vitest must not scan nested worktrees (`.claude/**` is excluded in `vitest.config.ts`).
- The WorkBuddy app keeps its own worktrees under `C:\Users\HP\WorkBuddy\Worktrees`; make sure the session you use is on the current `develop` or `feat/*` branch, not an old copy.
