import type { z } from "zod";
import { getPlan, recordRun, updatePlan } from "@/lib/db/plans";
import { computeFinance, evaluateFeasibility } from "@/lib/finance/engine";
import {
  BusinessInputs,
  DemandOutput,
  GoalInterpretationOutput,
  GrowthOutput,
  OperationsOutput,
} from "@/lib/schemas/plan";
import { unwrapData } from "@/lib/workbuddy/adapter";
import {
  SYSTEM_PROMPTS,
  demandPrompt,
  growthPrompt,
  operationsPrompt,
  orchestratorPrompt,
  type Role,
  type SpecialistContext,
} from "./prompts";

export interface ManualPrompt {
  role: Role;
  systemPrompt: string;
  userPrompt: string;
}

/**
 * Prompts for the user to run by hand in the WorkBuddy desktop app when the CLI
 * cannot be called (analysisStatus MANUAL_REQUIRED). Specialists are only
 * offered once the deterministic finance/feasibility results exist.
 */
export function buildManualPromptPack(planId: string): ManualPrompt[] | null {
  const plan = getPlan(planId);
  if (!plan) return null;

  const prompts: ManualPrompt[] = [
    {
      role: "orchestrator",
      systemPrompt: SYSTEM_PROMPTS.orchestrator,
      userPrompt: orchestratorPrompt(plan.goalText, plan.inputs),
    },
  ];

  if (plan.finance && plan.feasibility) {
    const ctx: SpecialistContext = {
      goalText: plan.goalText,
      inputs: plan.inputs,
      finance: plan.finance,
      feasibility: plan.feasibility,
    };
    prompts.push(
      { role: "demand", systemPrompt: SYSTEM_PROMPTS.demand, userPrompt: demandPrompt(ctx) },
      { role: "growth", systemPrompt: SYSTEM_PROMPTS.growth, userPrompt: growthPrompt(ctx) },
      { role: "operations", systemPrompt: SYSTEM_PROMPTS.operations, userPrompt: operationsPrompt(ctx) },
    );
  }
  return prompts;
}

function validate<T extends z.ZodType>(
  role: Role,
  raw: unknown,
  schema: T,
): { ok: true; data: z.infer<T> } | { ok: false; error: string } {
  const parsed = schema.safeParse(unwrapData(raw));
  if (parsed.success) return { ok: true, data: parsed.data };
  const issue = parsed.error.issues[0];
  // map(String): zod paths may contain symbols, which Array.join would throw on.
  const at = issue && issue.path.length > 0 ? ` at ${issue.path.map(String).join(".")}` : "";
  return { ok: false, error: `Manual ${role} result failed validation${at}: ${issue ? issue.message : "unexpected shape"}` };
}

/**
 * Import one role's result pasted from a manual WorkBuddy session. Nothing is
 * marked COMPLETED unless the pasted JSON passes the contract validation;
 * on failure nothing is written.
 */
export function importManualResult(planId: string, role: Role, raw: unknown): { ok: true } | { ok: false; error: string } {
  const plan = getPlan(planId);
  if (!plan) return { ok: false, error: "Analysis not found." };

  switch (role) {
    case "orchestrator": {
      const v = validate(role, raw, GoalInterpretationOutput);
      if (!v.ok) return v;
      // Existing user-set inputs win over what the model extracted.
      const userSet = Object.fromEntries(Object.entries(plan.inputs).filter(([, value]) => value != null));
      const inputs = BusinessInputs.parse({ ...v.data.inputs, ...userSet });
      const finance = computeFinance(inputs);
      const feasibility = evaluateFeasibility(finance, inputs.startingCapitalSen ?? null);
      updatePlan(planId, {
        source: "MANUAL_WORKBUDDY",
        inputs,
        assumptions: v.data.assumptions,
        missingInformation: v.data.missingInformation,
        finance,
        feasibility,
      });
      break;
    }
    case "demand": {
      const v = validate(role, raw, DemandOutput);
      if (!v.ok) return v;
      updatePlan(planId, { source: "MANUAL_WORKBUDDY", demand: v.data });
      break;
    }
    case "growth": {
      const v = validate(role, raw, GrowthOutput);
      if (!v.ok) return v;
      updatePlan(planId, { source: "MANUAL_WORKBUDDY", growth: v.data });
      break;
    }
    case "operations": {
      const v = validate(role, raw, OperationsOutput);
      if (!v.ok) return v;
      // Never recommend production beyond stated capacity, whatever was pasted.
      const cap = plan.inputs.dailyCapacityUnits;
      const data = cap != null ? { ...v.data, suggestedDailyUnits: Math.min(v.data.suggestedDailyUnits, cap) } : v.data;
      updatePlan(planId, { source: "MANUAL_WORKBUDDY", operations: data });
      break;
    }
  }

  recordRun(planId, { role, status: "COMPLETED", externalSessionId: null, durationMs: null, error: null });
  const updated = getPlan(planId);
  if (updated?.demand && updated.growth && updated.operations) {
    updatePlan(planId, { analysisStatus: "COMPLETED" });
  }
  return { ok: true };
}
