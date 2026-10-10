import type { z } from "zod";
import { updatePlan, recordRun } from "@/lib/db/plans";
import { computeFinance, evaluateFeasibility } from "@/lib/finance/engine";
import {
  BusinessInputs,
  DemandOutput,
  GoalInterpretationOutput,
  GrowthOutput,
  OperationsOutput,
  type AgentRun,
  type BusinessPlan,
  type RunStatus,
} from "@/lib/schemas/plan";
import { submitStructured } from "@/lib/workbuddy/adapter";
import type { ExecutionResult } from "@/lib/workbuddy/types";
import {
  SYSTEM_PROMPTS,
  demandPrompt,
  growthPrompt,
  operationsPrompt,
  orchestratorPrompt,
  type Role,
  type SpecialistContext,
} from "./prompts";

type Submit = typeof submitStructured;

/** One WorkBuddy call, recorded in agent_runs. A validation FAILED result is retried once; UNAVAILABLE is not. */
async function runRole<T extends z.ZodType>(
  submit: Submit,
  planId: string,
  role: Role,
  prompt: string,
  schema: T,
): Promise<ExecutionResult<z.infer<T>>> {
  const run = (status: RunStatus, r?: ExecutionResult<unknown>): AgentRun => ({
    role,
    status,
    externalSessionId: r && "externalSessionId" in r ? r.externalSessionId : null,
    durationMs: r && "durationMs" in r ? r.durationMs : null,
    error: r && r.status !== "COMPLETED" ? r.error : null,
  });

  recordRun(planId, run("RUNNING"));
  const call = () => submit({ runKey: `${planId}:${role}`, systemPrompt: SYSTEM_PROMPTS[role], prompt, schema });
  let result = await call();
  if (result.status === "FAILED") result = await call();
  recordRun(planId, run(result.status, result));
  return result;
}

/**
 * Orchestrate one analysis: interpret goal -> deterministic finance -> three specialists in parallel.
 * Persists every step so GET /api/analysis/:id always shows the truthful state.
 * `submit` is injectable for tests.
 */
export async function runAnalysis(
  planId: string,
  goalText: string,
  userInputs: Partial<BusinessInputs>,
  submit: Submit = submitStructured,
): Promise<void> {
  updatePlan(planId, { analysisStatus: "RUNNING" });

  // 1. Goal interpretation. If WorkBuddy is down we can still use what the user typed into the form.
  const goal = await runRole(submit, planId, "orchestrator", orchestratorPrompt(goalText, userInputs), GoalInterpretationOutput);
  const extracted = goal.status === "COMPLETED" ? goal.data : null;
  const userSet = Object.fromEntries(Object.entries(userInputs).filter(([, v]) => v != null));
  const inputs = BusinessInputs.parse({ ...extracted?.inputs, ...userSet }); // user-provided values always win

  // 2. Deterministic maths. Never delegated to the model.
  const finance = computeFinance(inputs);
  const feasibility = evaluateFeasibility(finance, inputs.startingCapitalSen ?? null);
  updatePlan(planId, {
    inputs,
    assumptions: extracted?.assumptions ?? [],
    missingInformation: extracted?.missingInformation ?? finance.missingInputs,
    finance,
    feasibility,
    nextActions: feasibility.reasons
      .filter((r) => r.severity !== "info")
      .map((r) => ({ text: r.text, provenance: "CALCULATED" as const })),
  });

  if (goal.status === "UNAVAILABLE") {
    updatePlan(planId, { analysisStatus: "MANUAL_REQUIRED" });
    return;
  }

  // 3. Specialists in parallel. Each saves its own result as soon as it validates.
  const ctx: SpecialistContext = { goalText, inputs, finance, feasibility };
  const [demand, growth, operations] = await Promise.all([
    runRole(submit, planId, "demand", demandPrompt(ctx), DemandOutput).then((r) => {
      if (r.status === "COMPLETED") updatePlan(planId, { demand: r.data });
      return r;
    }),
    runRole(submit, planId, "growth", growthPrompt(ctx), GrowthOutput).then((r) => {
      if (r.status === "COMPLETED") updatePlan(planId, { growth: r.data });
      return r;
    }),
    runRole(submit, planId, "operations", operationsPrompt(ctx), OperationsOutput).then((r) => {
      if (r.status === "COMPLETED") {
        // Never recommend production beyond stated capacity, whatever the model said.
        const cap = inputs.dailyCapacityUnits;
        const data = cap != null ? { ...r.data, suggestedDailyUnits: Math.min(r.data.suggestedDailyUnits, cap) } : r.data;
        updatePlan(planId, { operations: data });
      }
      return r;
    }),
  ]);

  const all = [goal, demand, growth, operations];
  const status: BusinessPlan["analysisStatus"] = all.every((r) => r.status === "COMPLETED")
    ? "COMPLETED"
    : all.some((r) => r.status === "UNAVAILABLE")
      ? "MANUAL_REQUIRED"
      : "FAILED";
  updatePlan(planId, { analysisStatus: status });
}
