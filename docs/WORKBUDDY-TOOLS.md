# What WorkBuddy needs for this project

Facts below about WorkBuddy features come from its documentation (workbuddy.ai/docs/cli). Items marked **not tested** were not run in WorkBuddy yet.

## What WorkBuddy supports (documented)
- **MCP servers:** stdio, SSE, HTTP. Project file `<repo>/.mcp.json`, or `codebuddy mcp add --scope project|user ...`. Tool names look like `mcp__<server>__<tool>`. Permissions go in `permissions.allow`. In non-interactive runs, approve project servers with `--settings '{"enableAllProjectMcpServers": true}'`.
- **Skills:** `.codebuddy/skills/<name>/SKILL.md` (project) or `~/.codebuddy/skills/`. Frontmatter: `name`, `description`, `allowed-tools`, optional `context: fork`, `model`.
- **Sub-agents:** `.codebuddy/agents/*.md` (already added: `backend-dev`, `frontend-dev`, `code-reviewer`).
- **Plugins:** `/plugin marketplace add <owner/repo>` then `/plugin install <name>@<marketplace>`; bundle skills, agents, commands, hooks and MCP servers.
- **Project memory:** `CODEBUDDY.md` (already added).

## Needed: build these (small, ours)
| Item | Why | Status |
|---|---|---|
| `campusbiz` MCP server (stdio) with tools `calculate_finance`, `evaluate_feasibility`, `get_plan`, `list_orders`, `order_summary` | Makes WorkBuddy agents do real tool calls: the Finance agent calls our calculator; the Operations agent reads real orders. This is what turns WorkBuddy from "chat that returns JSON" into "agents that do work" | TEAM.md A12 |
| Project `.mcp.json` registering it | Lets every WorkBuddy session and the app's headless runs load it | A12 |
| Skill `campusbiz-validate` | Critic checklist: price consistency with the calculator, capacity limits, unlabelled claims, invented products | A14 |
| Skill `campusbiz-launch-kit` | Template and rules for the launch kit and checklist files | A17 |

## Recommended: install existing ones
| Item | Why | How |
|---|---|---|
| **CodeGraph** (MCP) | Fast code navigation for agents on a growing repo. Already installed globally on this PC and telemetry is off, but its installer configured Claude Code, not CodeBuddy. Add it for WorkBuddy by hand | `codebuddy mcp add --scope user codegraph -- codegraph serve --mcp`, then `codegraph init` in the repo. Not tested in WorkBuddy |
| **Ponytail** (plugin/skill) | Keeps changes minimal, concise reviews | `/plugin marketplace add DietrichGebert/ponytail`, `/plugin install ponytail@ponytail`. Its install doc says CodeBuddy uses the same two commands. Not tested in WorkBuddy |
| **Superpowers** (plugin/skills) | Brainstorming, TDD, verification-before-completion, parallel agents, code review habits | WorkBuddy already cloned a copy into its own worktree; install it through `/plugin` rather than using that folder. Compatibility with CodeBuddy not verified |
| **Browser automation MCP** (Chrome DevTools MCP or Playwright MCP) | The UI agent must open the running app at 375 px and 1280 px and check it, and capture screenshots for the submission | e.g. `codebuddy mcp add --scope project chrome-devtools -- npx chrome-devtools-mcp@latest`. Not tested in WorkBuddy |
| **Office skills for slides and docs** | The slides and documentation must be made in WorkBuddy | Check the WorkBuddy app for its built-in presentation and document capabilities and use those. If none exist, say so and we decide an alternative. Not verified |

## Not needed (do not add)
GitHub MCP (the `git` and `gh` CLIs are enough), database MCPs (SQLite is accessed by our own code), any deployment MCP (the demo runs locally, nothing is published).

## Accounts and quotas
- Models used: `hy4-preview`, `kimi-k3`, `gpt-5.6-sol`, fallback `glm-5.3`. Each has its own usage limit; `glm-5.3` was rate-limited after the ten-run benchmark and reset at 19:14 UTC+8.
- The app itself needs no API key: it reuses the signed-in CodeBuddy session (`codebuddy` then `/login`). Both teammates sign in on their own machine.
- Leave headroom before the demo: a full analysis is four WorkBuddy calls.
