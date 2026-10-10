# Team plan

Two people, one repo. **Person A** owns the agent pipeline and all backend. **Person B** owns the product UI.
Source of truth for scope is `instruction.md`; this file says who does what, in what order, and how we check it.

## Branches

`main` (stable, demo-ready) <- `develop` (integration) <- `feat/agent` (A), `feat/ui` (B).
Merge into `develop` at least every few hours. Merge `develop` into `main` only when the demo path (section 7) passes.
`feat/agent` currently has everything in section 2 marked DONE. A merges it into `develop` first (task A1) so B can start from it.

## The contract

`src/lib/schemas/plan.ts` is shared. Change it only after both of you agree, in its own small commit.
`src/lib/schemas/sample.ts` is a `[SAMPLE]` plan so the UI can be built before real data exists. It must always be labelled in the UI.
Money is integer sen. Every shown value carries a provenance label (`[USER_INPUT] [CALCULATED] [ESTIMATED] [SIMULATED] [GENERATED] [VERIFIED] [UNVERIFIED]`).

## Tooling rule: everything happens on Tencent WorkBuddy

The challenge requires the solution, the presentation slides and the project documentation to be built **exclusively on Tencent WorkBuddy**.
From now on all code, slides and docs are produced in WorkBuddy sessions. Claude Code is no longer used. The ready-made WorkBuddy setup is in `CODEBUDDY.md` (project memory) and `.codebuddy/agents/` (sub-agents); kickoff prompts are in `docs/WORKBUDDY.md`.
Honest note for the submission: the first foundation (stack init, adapter, finance engine, pipeline, orders backend, this plan) was built before this rule was noticed, using Claude Code driving WorkBuddy's models through the CodeBuddy CLI. Say so in the documentation and ask the organisers whether that is acceptable; do not hide it.

## Who writes the code (AI model roles inside WorkBuddy)

The main WorkBuddy session orchestrates. Sub-agents are defined in `.codebuddy/agents/`.

| Work | Sub-agent / model | Rule |
|---|---|---|
| Backend implementation (Person A tasks) | `backend-dev`, model `hy4-preview` (benchmark winner over `glm-5.3`, section 8; `glm-5.3` is the fallback) | Works in its own git worktree and branch. Never commits or merges. |
| Frontend implementation (Person B tasks) | `frontend-dev`, model `kimi-k3` | Same: own worktree and branch, never commits or merges. |
| Code review | `code-reviewer`, model `gpt-5.6-sol` | **Read-only**: tools limited to `Read, Grep, Glob`. Must not edit or write files. Returns findings only. |
| Orchestration, integration, slides, documentation | the main WorkBuddy session | Runs the checks itself; a model's report is never trusted on its own. |

Rules for every delegated job: one task per worktree, explicit file allow-list, no git commands for the sub-agent, the human or the main session commits.
A job is accepted only after `npm test`, `npm run typecheck` and `npx eslint src` pass in the integrated branch.

## 1. Interfaces (the seam between A and B)

| Endpoint | Owner | Behaviour |
|---|---|---|
| `POST /api/analyze` | A, DONE | 202 `{id,status,workbuddyConfigured}`; runs in background |
| `GET /api/analysis/:id` | A, DONE | the `BusinessPlan`; 404 if unknown. Poll every ~3 s until `COMPLETED`, `FAILED` or `MANUAL_REQUIRED` |
| `GET/POST /api/analysis/:id/manual` | A, DONE | prompt pack to run by hand in WorkBuddy; POST `{role,result}` validates and stores a pasted result |
| `GET /api/health` | A, A3 | `{db, workbuddy:{configured, reason?}}` for setup banners |
| `GET /api/analysis` | A, A5 | list recent plans (id, goal, status, feasibility, createdAt) |
| `GET/POST /api/orders`, `PATCH /api/orders/:id` | A, A2 | POST needs `planId` plus `CreateOrderRequest`; 201 / 400 / 404 plan / 422 unknown product. GET `{orders,summary}`, `?status=`, `?format=csv`. PATCH `{status}` 200 / 400 / 404 / 409 |
| `GET /api/artifacts`, `/api/artifacts/:id`, `/api/artifacts/:id/download` | A, A4 | stored artifacts for a plan |
| `GET /api/plans/:id/prep` | A, A6 | deterministic daily preparation numbers from real orders |
| `POST /api/analysis/:id/recalculate` | A, A7 | edit inputs, recompute finance and feasibility (no WorkBuddy call) |

If B needs an endpoint or a field that is not here, B opens a one-line request to A before building around a guess.

## 2. Status snapshot (what exists today on `feat/agent`)

DONE: shared schema contract; WorkBuddy adapter (`src/lib/workbuddy`, live-verified); deterministic finance engine and feasibility rules (`src/lib/finance`);
SQLite plans and agent runs (`src/lib/db`); orchestrated analysis (goal -> finance -> demand/growth/operations in parallel) with truthful run status;
`POST /api/analyze`, `GET /api/analysis/:id`; manual WorkBuddy import fallback; agent prompts with injection guard; README.

## 3. Person A: agent pipeline and backend

Implemented by the `backend-dev` sub-agent (`hy4-preview`), reviewed by `code-reviewer` (`gpt-5.6-sol`), integrated by the main WorkBuddy session.

| # | Task | Acceptance |
|---|---|---|
| A1 | Merge `feat/agent` into `develop`; tell B | `npm test`, typecheck, lint green on `develop` |
| A2 | DONE (see section 8). **Orders backend**: `src/lib/db/orders.ts` and `/api/orders` routes (create with server-side price and subtotal, list, status transitions from `ORDER_TRANSITIONS`, summary, CSV with formula-injection guard) | Passes the hidden acceptance suite used in section 8; unknown plan 404, unknown product 422, bad transition 409 |
| A3 | `GET /api/health`: DB reachable, `checkConfiguration()` result, actionable setup reason | B can render the "WorkBuddy not configured" banner from it |
| A4 | **Artifacts backend**: build from a completed plan and store in the `artifacts` table: landing page (static HTML from a fixed template, every model string HTML-escaped, no scripts), marketing kit (Markdown), operations checklist (Markdown), QR code for a real URL. Routes `/api/artifacts*`; downloads served by id, never by path | An injection string in a product name is escaped in the HTML; invalid ids rejected; no filesystem path in any response |
| A5 | `GET /api/analysis` list and "latest" for the dashboard; mark plans stuck in `RUNNING` after a server restart as `FAILED` | Restarting mid-run leaves no plan `RUNNING` forever |
| A6 | Daily preparation plan from real orders: confirmed orders vs forecast vs capacity, clamped to `dailyCapacityUnits`; `GET /api/plans/:id/prep` | Never recommends more than capacity; forecast labelled `[ESTIMATED]`, confirmed orders `[USER_INPUT]` |
| A7 | Editable assumptions with recalculation: `POST /api/analysis/:id/recalculate` | Demo numbers change correctly when price is edited; no WorkBuddy call |
| A8 | Sales history CSV import and analysis (P1) | Imported rows are `HISTORICAL`; rejects malformed files |
| A9 | Optional funding and compliance specialist (only after all else): checklist labelled `UNVERIFIED — REQUIRES CHECKING` | No invented programmes, deadlines or eligibility |
| A10 | Hardening: minimal admin-token guard on order list and status updates, cap on catalogue price, per-role retry limits, timeouts, redaction audit, request size limits, rate limit on `/api/analyze` | A security review pass reports no open issues |
| A11 | WorkBuddy section of README: verified capabilities and limits, manual fallback, demo script | A new machine can follow it |

## 4. Person B: product and UI

Implemented by the `frontend-dev` sub-agent (`kimi-k3`), reviewed by `code-reviewer` (`gpt-5.6-sol`), integrated by the main WorkBuddy session. B works against `sample.ts` until A's endpoints land.

| # | Task | Acceptance |
|---|---|---|
| B1 | App shell and design system: layout, minimal navigation (Dashboard, Analysis, Launch studio, Orders), responsive, readable numbers | Works at 375 px and 1280 px; no horizontal scroll |
| B2 | Shared UI: provenance label chip, status badges (feasibility, run status), money formatter (sen to `RM12.34`), loading, empty and error components | Every number on screen carries a label; one place formats money |
| B3 | **Analysis page**: goal text plus optional structured inputs, submit, poll `GET /api/analysis/:id` every ~3 s, per-role run status with real durations, finance cards, feasibility with reasons, demand scenarios (labelled `[SIMULATED]`), risks and next actions | Shows `QUEUED/RUNNING/COMPLETED/FAILED/MANUAL_REQUIRED` exactly as returned; no fake progress |
| B4 | **Manual WorkBuddy fallback UI**: when `MANUAL_REQUIRED`, show the prompt pack with copy buttons and a paste box per role with validation errors shown | A pasted valid JSON completes the plan; labelled `MANUAL WORKBUDDY EXECUTION` |
| B5 | **Dashboard**: latest plan, feasibility, revenue and profit projection, required daily sales, recent orders, next actions | Reads real data; `[SAMPLE]` banner when showing `sample.ts` |
| B6 | **Launch studio**: landing page preview in a sandboxed iframe (`sandbox`, no scripts) from the stored artifact, marketing kit, operations checklist, downloads, QR code with a note when it only works on the local network | Preview matches the downloaded file; no raw model HTML ever rendered |
| B7 | **Order management**: public-style order form (product list from the plan, quantity, collection or delivery, time, notes), tracker table, status buttons showing only allowed transitions, summary, CSV export button | Order appears in the tracker after submit; refresh keeps it; invalid transitions are not offered |
| B8 | Setup banners from `/api/health`: WorkBuddy not configured, not signed in, DB error, with the fix text | Matches A3's `reason` text |
| B9 | Accessibility and responsive pass: focus order, labels, contrast, tap targets | Keyboard-only can place and update an order |
| B10 | Demo rehearsal and polish: run section 7 end to end on desktop and a phone-sized viewport, fix rough edges | Zero dead buttons |

## 5. Shared tasks (both)

- S1 Agree any change to `plan.ts` before merging it.
- S2 Weekly-style sync at each merge into `develop`: 10 minutes, list blockers.
- S3 Final README, known limitations, and the final report required by `instruction.md` section 21.
- S4 Demo video or script; decide who presents which part.
- S5 **Presentation slides, made in WorkBuddy** (required by the challenge). Outline: problem, one-prompt-to-outcome journey, architecture (WorkBuddy orchestrator and specialists, deterministic finance, SQLite), live demo screenshots, truthfulness and validation, limits, what is next. Every claim on a slide must match something that actually ran.
- S6 **Project documentation, written in WorkBuddy**: README, WorkBuddy setup and verified capabilities, known limitations, the disclosure note above, test results.
- S7 Move the work into WorkBuddy: follow `docs/WORKBUDDY.md` section 1 and record evidence (screenshots of WorkBuddy sessions doing each task) for the submission.

## 6. Review protocol (gpt-5.6-sol, read-only)

1. After a sub-agent finishes a task, the main session runs the tests itself.
2. Review prompt is sent to `gpt-5.6-sol` with `--tools "Read,Glob,Grep"` only (no Edit, Write or Bash). The reviewer receives the task brief and the diff paths and must return: correctness bugs, security issues, missing tests, and anything that violates `instruction.md` section 2.4 (truthful execution). Findings only, ranked.
3. The main session verifies each finding against the code before acting on it, then the implementing sub-agent (or the main session) fixes it.
4. Merge only after tests, typecheck and lint pass on the merged branch.

## 7. Demo scenario (acceptance for the whole project)

Homemade cookies on campus: RM5 price, RM2 variable cost, RM100 fixed, RM800 target, RM300 capital, 40 per day, 22 days.
Expected `[CALCULATED]`: contribution RM3, 300 units a month, 14 a day, revenue RM1,500, profit RM800, capacity 880, verdict `AT_RISK` (setup costs unknown, no demand evidence).
Steps: submit goal -> watch real WorkBuddy run status -> plan appears -> landing page, marketing kit, checklist -> place an order -> see it in the tracker -> change its status -> show the preparation plan staying under capacity.

## 8. Backend model benchmark (hy4-preview vs glm-5.3)

Same task, same brief, same hidden acceptance suite (20 tests), five runs per model, each in its own worktree, all ten run at once.
Task: the orders backend (A2). Scored by the orchestrating session running everything itself: hidden tests, typecheck, lint, wall time, size.

| | hy4-preview | glm-5.3 |
|---|---|---|
| Runs that load and pass 19/20 acceptance tests* | 4 of 5 | 4 of 5 |
| Clean (also typecheck and lint pass) | 3 of 5 | 3 of 5 |
| Wall time, mean (range) | 319 s (249-365) | 336 s (293-376) |
| Lines of new code in clean runs, mean | ~402 | ~448 |
| Failures | 1 syntax error in production code (hy4-3), 1 type error in its own test (hy4-5) | 1 required route file omitted (glm-2), 1 syntax error in its own test file (glm-3) |

*One acceptance test (quoted `filename="orders.csv"` header) fails in all ten runs. That is a harness fault, not a model fault: PowerShell 5.1 strips embedded double quotes from a prompt passed as a command-line argument, so every model saw `filename=orders.csv`. Excluded from scoring. Pass long prompts through stdin (`Get-Content brief.md -Raw | codebuddy -p ...`), never as an argument.

**Verdict: a statistical tie at n=5.** hy4-preview was slightly faster and wrote slightly less code; glm-5.3 failures were omissions and test-file slips, hy4's included one parse error in production code. Neither difference is meaningful.
**Decision:** use `hy4-preview` as the default backend writer (smaller, faster, and the best single run, hy4-1, was the one integrated), `glm-5.3` as the fallback. Both are only accepted after `npm test`, typecheck and lint pass on the integrated branch; never trust a model's own "tests pass" claim (one run shipped code that does not parse).
A2 outcome: hy4-1 integrated, then reviewed read-only by `gpt-5.6-sol` (5 findings): 3 fixed (atomic status update, tab/CR formula injection, CR test), 2 open below.

Open items from that review (added to Person A hardening, A10):
- **No authentication**: anyone can list orders and PATCH their status. Spec says avoid complex auth; decide a minimal guard (shared admin token in `.env` for GET list and PATCH) before the demo, and B sends it from the orders screen.
- **Unbounded catalogue price**: `priceSen` has no upper bound in `plan.ts`, so a model-generated price near `Number.MAX_SAFE_INTEGER` times quantity would overflow. Add a sane `.max()` to `GrowthOutput.products[].priceSen` (a contract change, agree with B).

## Rules

- Never commit `.env`. Never log keys. WorkBuddy runs on the local machine through the CodeBuddy CLI.
- Anything shown without real data must carry a visible label ([SAMPLE], [SIMULATED], ...).
- No claim that something was sent, published or verified unless it actually was.
