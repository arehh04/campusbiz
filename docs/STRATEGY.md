# Strategy: how we win Track 2 (Agentic Solution)

Problem statement: *How can AI help students or small businesses solve real business problems and operate more effectively?*
Core judging question: *Can your AI agent use WorkBuddy to solve a real problem and actually get things done?*

## 1. Pick one user, one problem

"Students or small businesses" is an either-or, so either qualifies. The strongest pitch is one concrete user who is both: **a student running a micro-business** (home baking, thrift, print-on-demand, tutoring) who sells through WhatsApp and Instagram.

The real problems this person has today:
1. They launch without knowing if the price covers costs or if they can physically make enough. Some sell at a loss without noticing.
2. Marketing material takes days and is generic.
3. Orders live in chat threads, so orders get missed, mis-priced or double-booked.
4. Nobody tells them what to prepare tomorrow or what to change when the numbers do not work.

One-sentence pitch: *Give it your business goal once; it checks the numbers, builds the launch kit, takes real orders, and keeps telling you what to do next.*

## 2. Measurable value (measure it, do not claim it)

Only report what we measure. Plan:
- **Time to launch-ready plan:** measured by the app (our one live run took about 2 minutes: goal interpretation 15 s, then three specialists in parallel up to 89 s). Baseline comes from 3 to 5 real student sellers doing the same job by hand: ask them to time it.
- **Bad pricing caught:** run a fixed scenario set (profitable, loss-making, over capacity, missing data) and report how many the system flags correctly. The finance engine already has tests for this.
- **Order errors:** count orders captured with correct server-side price and valid status flow vs the same sellers' current chat process.
- **Honesty:** every unverified demand number stays labelled `[SIMULATED]` or `[ESTIMATED]`.

## 3. Honest gap analysis against the five criteria

| Criterion | What we have | Gap | Fix (task) |
|---|---|---|---|
| 1. Real problem and user value | A planner for "campus cookies" | User and metric are vague; no real-user evidence | Pick the user above; validate with 3-5 sellers (S8); impact harness (A18, B14) |
| 2. Agentic workflow | Orchestrator, three specialists in parallel, run records, retry once | No collaboration step, no validation agent, no adaptation, agents have no tools | Critic and auto-repair (A14), adaptive fix-it options (A15) |
| 3. Meaningful use of WorkBuddy | Real WorkBuddy calls, live-verified | **Biggest risk.** We run WorkBuddy with all tools disabled and only ask for JSON. A judge can fairly call that a chat completion | Give agents real tools through an MCP server (A12, A13), let them write real files (A17), show the real trace (B11) |
| 4. End-to-end | One goal in, plan out | Result is a screen, not finished work. Nothing happens after the plan | Daily autopilot briefing from real orders (A16, B13), real deliverable files (A17) |
| 5. Usable and verifiable | 85 tests, truthful run status, manual fallback | No measured results yet | Evidence harness (A18), `docs/EVIDENCE.md` |

## 4. The agentic loop we are building

```
ONE PROMPT (goal)
  -> Orchestrator (WorkBuddy) extracts inputs, lists what is missing        [real run]
  -> Finance: agent CALLS the calculator tool (MCP), never does maths       [real tool call]
  -> in parallel: Demand | Growth (writes files) | Operations (reads real orders via MCP)
  -> Critic (WorkBuddy) checks the pieces against each other and the calculator
       contradictions found -> offending specialist re-runs once with the findings   [adaptation]
  -> Advisor (WorkBuddy) when AT_RISK or NOT_FEASIBLE: proposes price/capacity/cost options;
       the calculator, not the model, recomputes each option                        [adaptation]
  -> Launch kit, working order page, QR
  -> OPERATE: orders arrive -> daily briefing agent reads them and drafts tomorrow's prep
       and customer messages (drafts only, never sent without the user)
```

Everything shown in the UI trace comes from real run events (tool calls, durations, statuses). No fake progress.

## 5. What to show the judges

1. A real student seller's goal typed once.
2. The trace of real WorkBuddy runs and tool calls, including a validation that caught and fixed a contradiction.
3. The numbers, labelled by origin, and the verdict with reasons.
4. A loss-making case being flagged and fixed by the advisor options.
5. An order placed, tracked, then the next-day briefing built from it.
6. Measured results from the impact harness and the real-user comparison.
7. Evidence that the build itself happened on WorkBuddy (sessions, sub-agents, read-only review).

## 6. Risks to state openly
- WorkBuddy runs through the CodeBuddy CLI on the local machine, so the demo is local, not a hosted service.
- The WorkBuddy Expert Group feature was not available to us through the CLI; our specialists are separate sessions orchestrated by the app.
- Demand numbers are scenarios until a seller supplies real sales history.
- Foundation work was done before the tooling rule was noticed (see `TEAM.md`).
- Usage quotas on the models are limited; do not burn them before the demo.
