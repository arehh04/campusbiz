import { beforeEach, describe, expect, it } from "vitest";
import { createPlan, getPlan } from "@/lib/db/plans";
import { resetDbForTests } from "@/lib/db";
import type { ExecutionResult } from "@/lib/workbuddy/types";
import { runAnalysis } from "./analyze";

const demoInputs = {
  startingCapitalSen: 30000,
  sellingPriceSen: 500,
  variableCostPerUnitSen: 200,
  monthlyFixedCostsSen: 10000,
  targetMonthlyProfitSen: 80000,
  dailyCapacityUnits: 40,
  operatingDaysPerMonth: 22,
};

const ok = <T>(data: T): ExecutionResult<T> => ({ status: "COMPLETED", data, externalSessionId: "s1", durationMs: 5 });
const day = (n: number) => ({ day: n, activity: `day ${n}` });

// Fake WorkBuddy keyed by role (the runKey ends with ":<role>").
const fake = (overrides: Record<string, ExecutionResult<unknown>> = {}) =>
  (async (req: { runKey: string }) => {
    const role = req.runKey.split(":")[1];
    if (overrides[role]) return overrides[role];
    const data = {
      orchestrator: { inputs: { currency: "MYR" }, missingInformation: [], assumptions: [], clarifyingQuestions: [] },
      demand: { segments: [], scenarios: [], researchSuggestions: [], risks: [] },
      growth: {
        positioning: "p",
        valueProposition: "v",
        targetAudience: "t",
        products: [{ name: "Cookie", description: "d", priceSen: 500 }],
        landingPage: { businessName: "B", headline: "h", subheadline: "s", callToAction: "c", orderingInstructions: "o", sections: [] },
        socialCaptions: ["a", "b", "c"],
        launchAnnouncement: "l",
        promotionalOffer: "o",
        sevenDayCalendar: [1, 2, 3, 4, 5, 6, 7].map(day),
      },
      operations: { suggestedDailyUnits: 500, dailyPreparationPlan: [], checklist: [], wasteReduction: [], risks: [] },
    }[role];
    return ok(data);
  }) as never;

beforeEach(() => {
  process.env.DATABASE_PATH = ":memory:";
  resetDbForTests();
});

describe("runAnalysis", () => {
  it("completes, computes finance in code, and clamps production to capacity", async () => {
    const id = createPlan("cookies", demoInputs);
    await runAnalysis(id, "cookies", demoInputs, fake());
    const plan = getPlan(id)!;
    expect(plan.analysisStatus).toBe("COMPLETED");
    expect(plan.finance?.requiredMonthlyUnits).toBe(300);
    expect(plan.feasibility?.status).toBe("AT_RISK");
    expect(plan.operations?.suggestedDailyUnits).toBe(40); // model said 500
    expect(plan.runs.map((r) => r.role).sort()).toEqual(["demand", "growth", "operations", "orchestrator"]);
  });

  it("when WorkBuddy is unavailable: finance still computed, status MANUAL_REQUIRED, no fake specialist output", async () => {
    const id = createPlan("cookies", demoInputs);
    await runAnalysis(id, "cookies", demoInputs, (async () => ({ status: "UNAVAILABLE", error: "not signed in" })) as never);
    const plan = getPlan(id)!;
    expect(plan.analysisStatus).toBe("MANUAL_REQUIRED");
    expect(plan.finance?.requiredMonthlyUnits).toBe(300);
    expect(plan.demand).toBeNull();
    expect(plan.runs[0]).toMatchObject({ role: "orchestrator", status: "UNAVAILABLE", error: "not signed in" });
  });

  it("a failed specialist leaves the rest intact and marks the plan FAILED", async () => {
    const id = createPlan("cookies", demoInputs);
    const bad: ExecutionResult<unknown> = { status: "FAILED", error: "validation", externalSessionId: null, durationMs: 1 };
    await runAnalysis(id, "cookies", demoInputs, fake({ demand: bad }));
    const plan = getPlan(id)!;
    expect(plan.analysisStatus).toBe("FAILED");
    expect(plan.growth).not.toBeNull();
    expect(plan.demand).toBeNull();
  });

  it("user-provided inputs override what the model extracted", async () => {
    const id = createPlan("cookies", demoInputs);
    const orch = ok({ inputs: { currency: "MYR", sellingPriceSen: 999 }, missingInformation: [], assumptions: [], clarifyingQuestions: [] });
    await runAnalysis(id, "cookies", demoInputs, fake({ orchestrator: orch }));
    expect(getPlan(id)!.inputs.sellingPriceSen).toBe(500);
  });
});
