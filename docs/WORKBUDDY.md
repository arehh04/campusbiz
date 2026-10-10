# Working on WorkBuddy

The challenge requires the solution, slides and documentation to be built exclusively on Tencent WorkBuddy. This file is how both teammates move the work there and what to tell the agents.

## 1. One-time setup (each teammate)

1. Pull the latest `develop` (or `feat/agent` until it is merged): `git fetch && git switch develop && git pull`.
2. In the WorkBuddy app, open the project **folder** (the real checkout), not an old copy. WorkBuddy created `C:\Users\HP\WorkBuddy\Worktrees\campuzbiz\main-0c0a9b80` from the very first commit (`bc4e394`); that copy is stale. Do not work there. Either delete it from WorkBuddy or run `git merge develop` inside it first.
3. Run `npm ci --ignore-scripts` in the checkout (a real install, no `node_modules` junction).
4. Confirm WorkBuddy picked up the project: it should load `CODEBUDDY.md` (project memory) and list three sub-agents: `backend-dev`, `frontend-dev`, `code-reviewer` (`/agents` shows them). If the session cannot see them, say so; the files are `CODEBUDDY.md` and `.codebuddy/agents/*.md`.
5. Confirm the models respond in your account: `hy4-preview`, `kimi-k3`, `gpt-5.6-sol` (and `glm-5.3` as fallback).
6. Keep `.env` local. The app needs no API key; it reuses your signed-in WorkBuddy/CodeBuddy session.
7. Take screenshots of WorkBuddy sessions doing the work. They are evidence for the submission.

## 2. How a task runs (the loop)

1. Main WorkBuddy session reads the task row in `TEAM.md`.
2. It creates a git worktree and branch for that task and writes a short brief with an explicit list of files the sub-agent may create or edit.
3. It delegates to the right sub-agent (`backend-dev` for A tasks, `frontend-dev` for B tasks).
4. When the sub-agent returns, the main session runs `npm test`, `npm run typecheck`, `npx eslint src` itself and reads the diff.
5. It sends the diff paths to `code-reviewer` (read-only) and checks each finding against the code before acting.
6. Fix, rerun the three commands, then the human commits and merges.

## 3. Kickoff prompt: Person A (backend), paste into the main WorkBuddy session

```
You are the orchestrator for Person A on CampusBiz Autopilot. This project is built exclusively on Tencent WorkBuddy, so do all work in this session and its sub-agents.

First read CODEBUDDY.md, TEAM.md (sections 1, 3, 6, 8), instruction.md and src/lib/schemas/plan.ts. Do not change plan.ts.

Your job: complete the Person A tasks in TEAM.md section 3 in order A1 to A11 (A2 is already done). Work on one task at a time:
- Create a git worktree and branch named agent/<task-id> from the current feat/agent or develop branch.
- Write a brief with the exact files the sub-agent may create or edit, the behaviour, and the acceptance line from TEAM.md.
- Delegate implementation to the backend-dev sub-agent. Pass the brief through a file or stdin, never as a long command-line argument.
- When it returns, run npm test, npm run typecheck and npx eslint src yourself. Do not trust its report.
- Send the changed files to the code-reviewer sub-agent (read-only). Verify each finding against the code, fix real ones, rerun the checks.
- Report to me: what changed, check results, review findings and what you did with each. Then wait for my go-ahead before merging or committing.

Rules: truthful execution (never fake agent activity or results), finance computed in code, model output is untrusted and zod-validated, label provenance, never commit .env, no git commit or push by sub-agents. Start with A1 and A3, then A4.
```

## 4. Kickoff prompt: Person B (UI), paste into the main WorkBuddy session

```
You are the orchestrator for Person B on CampusBiz Autopilot. This project is built exclusively on Tencent WorkBuddy, so do all work in this session and its sub-agents.

First read CODEBUDDY.md, TEAM.md (sections 1, 4, 6), instruction.md sections 6, 9, 12, 13 and src/lib/schemas/plan.ts and sample.ts. Do not change plan.ts or anything in src/lib or src/app/api.

Your job: complete the Person B tasks in TEAM.md section 4 in order B1 to B10. Until Person A's endpoints exist, build against samplePlan and show a visible [SAMPLE] label. For each task:
- Create a git worktree and branch named ui/<task-id> from develop.
- Write a brief with the exact files the sub-agent may create or edit and the acceptance line from TEAM.md.
- Delegate implementation to the frontend-dev sub-agent. Pass the brief through a file or stdin.
- When it returns, run npm run typecheck and npx eslint src yourself, then start the dev server and look at the page at 375 px and 1280 px width.
- Send the changed files to the code-reviewer sub-agent (read-only). Verify each finding, fix real ones.
- Report to me with what changed and what you saw. Wait for my go-ahead before committing or merging.

Rules: no fake progress or invented agent activity, no raw model HTML rendered, every number has a provenance label, money formatted in one place, no dead buttons. Start with B1 and B2.
```

## 5. Prompt for the slides (either teammate, in WorkBuddy)

```
Create the presentation deck for CampusBiz Autopilot inside WorkBuddy. Read TEAM.md section 7 (demo scenario), docs/WORKBUDDY.md, README.md and instruction.md sections 1 and 22.
Outline: 1 problem, 2 one-prompt-to-outcome journey, 3 architecture (WorkBuddy orchestrator plus Demand, Growth, Operations specialists, deterministic finance engine, SQLite), 4 live demo with screenshots from the running app, 5 how we keep it truthful (labels, validation, manual fallback, no fake logs), 6 how we built it on WorkBuddy (sub-agents, models, read-only review, benchmark result), 7 limits and next steps.
Every number and claim on a slide must come from something that actually ran (tests, the live run, TEAM.md section 8). Do not invent metrics. Include the disclosure that the foundation was built before the tooling rule was noticed.
```

## 6. Prompt for the documentation (either teammate, in WorkBuddy)

```
Update README.md and add docs/ARCHITECTURE.md inside WorkBuddy. Cover: setup from a clean checkout, the WorkBuddy integration (CodeBuddy CLI headless, structured output, statuses, manual fallback), the data contract, API list, how to run the demo, tests and their latest real results, verified capabilities, known limitations (local-only CLI, not WorkBuddy Expert Groups, quotes and timing notes), and the disclosure about the foundation work. Run the commands you document and copy their real output; do not claim anything you did not run.
```
