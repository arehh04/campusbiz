import { randomUUID } from "node:crypto";
import { getDb } from "./index";
import {
  BusinessPlan,
  type AgentRun,
  type BusinessInputs,
  type DemandOutput,
  type Feasibility,
  type FinanceResult,
  type GrowthOutput,
  type OperationsOutput,
  type RunStatus,
} from "../schemas/plan";

type PlanPatch = Partial<{
  analysisStatus: RunStatus;
  source: BusinessPlan["source"];
  inputs: BusinessInputs;
  assumptions: BusinessPlan["assumptions"];
  missingInformation: string[];
  finance: FinanceResult | null;
  feasibility: Feasibility | null;
  demand: DemandOutput | null;
  growth: GrowthOutput | null;
  operations: OperationsOutput | null;
  nextActions: BusinessPlan["nextActions"];
}>;

// Patch key -> column. Column names come from this fixed map, never from caller input.
const COLUMNS: Record<keyof PlanPatch, { column: string; json: boolean }> = {
  analysisStatus: { column: "analysis_status", json: false },
  source: { column: "source", json: false },
  inputs: { column: "inputs_json", json: true },
  assumptions: { column: "assumptions_json", json: true },
  missingInformation: { column: "missing_information_json", json: true },
  finance: { column: "finance_json", json: true },
  feasibility: { column: "feasibility_json", json: true },
  demand: { column: "demand_json", json: true },
  growth: { column: "growth_json", json: true },
  operations: { column: "operations_json", json: true },
  nextActions: { column: "next_actions_json", json: true },
};

const TERMINAL: RunStatus[] = ["COMPLETED", "FAILED", "UNAVAILABLE"];

export function createPlan(goalText: string, inputs: Partial<BusinessInputs>): string {
  const id = randomUUID();
  getDb()
    .prepare(
      `INSERT INTO business_plans (id, goal_input, source, analysis_status, inputs_json, created_at)
       VALUES (?, ?, 'WORKBUDDY', 'QUEUED', ?, ?)`,
    )
    .run(id, goalText, JSON.stringify(inputs), new Date().toISOString());
  return id;
}

export function updatePlan(id: string, patch: PlanPatch): void {
  const keys = (Object.keys(patch) as (keyof PlanPatch)[]).filter((k) => k in COLUMNS && patch[k] !== undefined);
  if (keys.length === 0) return;
  const sets = keys.map((k) => `${COLUMNS[k].column} = ?`).join(", ");
  const values = keys.map((k) => (COLUMNS[k].json ? JSON.stringify(patch[k]) : (patch[k] as string)));
  getDb().prepare(`UPDATE business_plans SET ${sets} WHERE id = ?`).run(...values, id);
}

export function recordRun(planId: string, run: AgentRun): void {
  const now = new Date().toISOString();
  const completedAt = TERMINAL.includes(run.status) ? now : null;
  getDb()
    .prepare(
      `INSERT INTO agent_runs
         (id, plan_id, role, provider, execution_status, external_session_id, started_at, completed_at, duration_ms, error_summary)
       VALUES (?, ?, ?, 'workbuddy-cli', ?, ?, ?, ?, ?, ?)
       ON CONFLICT (plan_id, role) DO UPDATE SET
         execution_status = excluded.execution_status,
         external_session_id = excluded.external_session_id,
         completed_at = COALESCE(excluded.completed_at, agent_runs.completed_at),
         duration_ms = excluded.duration_ms,
         error_summary = excluded.error_summary`,
    )
    .run(randomUUID(), planId, run.role, run.status, run.externalSessionId, now, completedAt, run.durationMs, run.error);
}

type PlanRow = {
  id: string;
  goal_input: string;
  source: string;
  analysis_status: string;
  inputs_json: string | null;
  assumptions_json: string | null;
  missing_information_json: string | null;
  finance_json: string | null;
  feasibility_json: string | null;
  demand_json: string | null;
  growth_json: string | null;
  operations_json: string | null;
  next_actions_json: string | null;
  created_at: string;
};

type RunRow = {
  role: AgentRun["role"];
  execution_status: RunStatus;
  external_session_id: string | null;
  duration_ms: number | null;
  error_summary: string | null;
};

const parse = (s: string | null, fallback: unknown = null): unknown => (s === null ? fallback : JSON.parse(s));

export function getPlan(id: string): BusinessPlan | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM business_plans WHERE id = ?").get(id) as PlanRow | undefined;
  if (!row) return null;
  const runRows = db
    .prepare(
      "SELECT role, execution_status, external_session_id, duration_ms, error_summary FROM agent_runs WHERE plan_id = ? ORDER BY rowid",
    )
    .all(id) as RunRow[];

  const result = BusinessPlan.safeParse({
    id: row.id,
    source: row.source,
    createdAt: row.created_at,
    goalText: row.goal_input,
    analysisStatus: row.analysis_status,
    runs: runRows.map((r) => ({
      role: r.role,
      status: r.execution_status,
      externalSessionId: r.external_session_id,
      durationMs: r.duration_ms,
      error: r.error_summary,
    })),
    inputs: parse(row.inputs_json, { currency: "MYR" }),
    assumptions: parse(row.assumptions_json, []),
    missingInformation: parse(row.missing_information_json, []),
    finance: parse(row.finance_json),
    feasibility: parse(row.feasibility_json),
    demand: parse(row.demand_json),
    growth: parse(row.growth_json),
    operations: parse(row.operations_json),
    nextActions: parse(row.next_actions_json, []),
  });
  if (!result.success) throw new Error(`Stored plan ${id} failed validation: ${result.error.message}`);
  return result.data;
}
