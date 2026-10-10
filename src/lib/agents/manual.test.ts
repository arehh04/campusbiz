import { beforeEach, describe, expect, it } from "vitest";
import { createPlan, getPlan } from "@/lib/db/plans";
import { resetDbForTests } from "@/lib/db";
import { buildManualPromptPack, importManualResult } from "./manual";

const demoInputs = {
  startingCapitalSen: 30000,
  sellingPriceSen: 500,
  variableCostPerUnitSen: 200,
  monthlyFixedCostsSen: 10000,
  targetMonthlyProfitSen: 80000,
  dailyCapacityUnits: 40,
  operatingDaysPerMonth: 22,
};

const orchestratorOut = {
  inputs: { currency: "MYR", sellingPriceSen: 999, businessName: "Cookie Stand" },
  missingInformation: ["setupExpenses"],
  assumptions: [{ field: "operatingDaysPerMonth", value: "22", note: "typical campus month" }],
  clarifyingQuestions: [],
};

const demandOut = { segments: [], scenarios: [], researchSuggestions: [], risks: [] };

const growthOut = {
  positioning: "p",
  valueProposition: "v",
  targetAudience: "t",
  products: [{ name: "Cookie", description: "d", priceSen: 500 }],
  landingPage: { businessName: "B", headline: "h", subheadline: "s", callToAction: "c", orderingInstructions: "o", sections: [] },
  socialCaptions: ["a", "b", "c"],
  launchAnnouncement: "l",
  promotionalOffer: "o",
  sevenDayCalendar: [1, 2, 3, 4, 5, 6, 7].map((day) => ({ day, activity: `day ${day}` })),
};

const operationsOut = { suggestedDailyUnits: 500, dailyPreparationPlan: [], checklist: [], wasteReduction: [], risks: [] };

beforeEach(() => {
  process.env.DATABASE_PATH = ":memory:";
  resetDbForTests();
});

describe("buildManualPromptPack", () => {
  it("offers only the orchestrator until finance exists, then all four roles", () => {
    const id = createPlan("cookies", {});
    expect(buildManualPromptPack(id)!.map((p) => p.role)).toEqual(["orchestrator"]);

    expect(importManualResult(id, "orchestrator", orchestratorOut).ok).toBe(true);
    const pack = buildManualPromptPack(id)!;
    expect(pack.map((p) => p.role).sort()).toEqual(["demand", "growth", "operations", "orchestrator"]);
    expect(pack.every((p) => p.systemPrompt.length > 0 && p.userPrompt.length > 0)).toBe(true);
  });

  it("returns null for a missing plan", () => {
    expect(buildManualPromptPack("nope")).toBeNull();
  });
});

describe("importManualResult", () => {
  it("an invalid result changes nothing and records no COMPLETED run", () => {
    const id = createPlan("cookies", demoInputs);
    importManualResult(id, "orchestrator", orchestratorOut);
    const before = getPlan(id)!;

    const bad = importManualResult(id, "demand", { segments: 42 });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.length).toBeGreaterThan(0);

    const after = getPlan(id)!;
    expect(after.demand).toBeNull();
    expect(after.source).toBe(before.source);
    expect(after.analysisStatus).toBe(before.analysisStatus);
    expect(after.runs.some((r) => r.role === "demand")).toBe(false);
  });

  it("a valid orchestrator import computes finance and keeps user-set inputs on top", () => {
    const id = createPlan("cookies", demoInputs);
    const result = importManualResult(id, "orchestrator", orchestratorOut);
    expect(result).toEqual({ ok: true });

    const plan = getPlan(id)!;
    expect(plan.source).toBe("MANUAL_WORKBUDDY");
    expect(plan.inputs.sellingPriceSen).toBe(500); // user said 500, model said 999
    expect(plan.inputs.businessName).toBe("Cookie Stand"); // extracted where the user set nothing
    expect(plan.finance?.requiredMonthlyUnits).toBe(300);
    expect(plan.feasibility?.status).toBe("AT_RISK");
    expect(plan.assumptions).toEqual(orchestratorOut.assumptions);
    expect(plan.missingInformation).toEqual(["setupExpenses"]);
    expect(plan.runs).toContainEqual({
      role: "orchestrator",
      status: "COMPLETED",
      externalSessionId: null,
      durationMs: null,
      error: null,
    });
  });

  it("an operations import clamps suggestedDailyUnits to stated capacity", () => {
    const id = createPlan("cookies", demoInputs);
    expect(importManualResult(id, "operations", operationsOut).ok).toBe(true);
    expect(getPlan(id)!.operations?.suggestedDailyUnits).toBe(40); // pasted 500
  });

  it("accepts a lone {data: ...} wrapper like the adapter does", () => {
    const id = createPlan("cookies", demoInputs);
    expect(importManualResult(id, "demand", { data: demandOut }).ok).toBe(true);
    expect(getPlan(id)!.demand).toEqual(demandOut);
  });

  it("the plan becomes COMPLETED only when all three specialists are in", () => {
    const id = createPlan("cookies", demoInputs);
    importManualResult(id, "orchestrator", orchestratorOut);
    importManualResult(id, "demand", demandOut);
    expect(getPlan(id)!.analysisStatus).not.toBe("COMPLETED");

    importManualResult(id, "operations", operationsOut);
    expect(getPlan(id)!.analysisStatus).not.toBe("COMPLETED");

    importManualResult(id, "growth", growthOut);
    const plan = getPlan(id)!;
    expect(plan.analysisStatus).toBe("COMPLETED");
    expect(plan.source).toBe("MANUAL_WORKBUDDY");
  });

  it("returns an error for a missing plan", () => {
    const result = importManualResult("nope", "demand", demandOut);
    expect(result.ok).toBe(false);
  });
});
