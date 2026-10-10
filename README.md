# CampusBiz Autopilot

CampusBiz Autopilot is a local Next.js app that turns a student's micro-business goal into a structured business plan with deterministic finance results, a feasibility verdict, demand scenarios, launch content and an operations checklist. Order management and the dashboard UI are in progress.

## Tech stack

- Next.js 16, React 19, TypeScript
- Tailwind CSS 4
- SQLite with `better-sqlite3`
- Zod 4 for validation
- Vitest and ESLint
- CodeBuddy CLI package `@tencent-ai/codebuddy-code` for WorkBuddy execution

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

## Tests

```bash
npm test
```

Live WorkBuddy smoke test:

```bash
RUN_WORKBUDDY_SMOKE=1 npx vitest run smoke
```

## WorkBuddy integration

The app calls the CodeBuddy CLI headlessly from `src/lib/workbuddy/adapter.ts` using `-p --output-format json --json-schema`. It reuses the user's local `codebuddy` `/login` session and does not require an API key in the current implementation.

Install and sign in:

```bash
npm install -g @tencent-ai/codebuddy-code
codebuddy
/login
```

The adapter submits structured prompts, unwraps occasional `{ "data": ... }` output, and validates results with Zod before saving or rendering them. Terminal execution statuses are `COMPLETED`, `FAILED`, and `UNAVAILABLE`; when WorkBuddy is unavailable, the plan status becomes `MANUAL_REQUIRED`.

## Verified capabilities

- Structured output through `--json-schema`, validated by Zod.
- Parallel specialist runs for demand, growth, and operations.
- Finance calculations are computed in application code, not by WorkBuddy.

## Known limitations

- WorkBuddy runs as a local CLI process, so it works on a local machine and not on serverless hosting.
- This is not WorkBuddy's own Expert Group feature; specialists are separate CLI calls orchestrated by the app.
- CLI structured output is occasionally wrapped as `{ "data": ... }`; the adapter unwraps that exact shape.
- A growth call can take about 90-110 seconds.
