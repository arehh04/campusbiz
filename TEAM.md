# Team split

Branches: `main` (stable, demo-ready) <- `develop` (integration) <- `feat/agent`, `feat/ui`.
Merge into `develop` often. Only merge `develop` into `main` when the demo path works.

## Contract
`src/lib/schemas/plan.ts` is shared. Change it only after both of you agree, in its own small commit.
`src/lib/schemas/sample.ts` is a labelled `[SAMPLE]` plan so the UI can be built before the agent side exists.

## Person A: agent and backend (`feat/agent`)
- Orchestrator + Demand / Growth / Operations prompts, using `submitStructured` in `src/lib/workbuddy`
- Parallel specialist runs, validate-and-retry, `agent_runs` records
- Finance engine (integer sen, `FinanceResult`) + feasibility rules, with unit tests
- `POST /api/analyze`, `GET /api/analysis/:id`

## Person B: product and UI (`feat/ui`)
- SQLite setup (`better-sqlite3`), orders API with `ORDER_TRANSITIONS`, server-side subtotal
- Dashboard, analysis page, launch studio, order management
- Safe landing-page preview from `GrowthOutput.landingPage` (no raw HTML from the model)
- Marketing kit / checklist downloads, QR code, CSV export
- Loading, error and missing-config states

## Rules
- Never commit `.env`. Never log keys.
- Anything shown without real data must carry a visible label ([SAMPLE], [SIMULATED], ...).
