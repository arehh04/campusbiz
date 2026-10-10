import { beforeEach, describe, expect, it } from "vitest";
import { resetDbForTests } from "./index";
import { createPlan, getPlan, recordRun, updatePlan } from "./plans";
import type { Feasibility, FinanceResult } from "../schemas/plan";

beforeEach(() => {
  process.env.DATABASE_PATH = ":memory:";
  resetDbForTests();
});

const finance: FinanceResult = {
  provenance: "CALCULATED",
  valid: true,
  unitContributionSen: 500,
  breakEvenUnits: 40,
  requiredMonthlyUnits: 100,
  requiredDailyUnits: 5,
  projectedRevenueSen: 100000,
  projectedVariableCostsSen: 50000,
  fixedCostsSen: 20000,
  projectedOperatingProfitSen: 30000,
  monthlyCapacityUnits: 600,
  fitsCapacity: true,
  capitalNeededSen: 50000,
  fitsCapital: true,
  missingInputs: [],
  exclusions: ["tax"],
  warnings: [],
};
const feasibility: Feasibility = { provenance: "CALCULATED", status: "FEASIBLE", reasons: [{ text: "ok", severity: "info" }] };

describe("plans db", () => {
  it("creates a QUEUED plan", () => {
    const id = createPlan("sell nasi lemak", { sellingPriceSen: 500 });
    const plan = getPlan(id)!;
    expect(plan.analysisStatus).toBe("QUEUED");
    expect(plan.source).toBe("WORKBUDDY");
    expect(plan.goalText).toBe("sell nasi lemak");
    expect(plan.inputs).toMatchObject({ currency: "MYR", sellingPriceSen: 500 });
    expect(plan.runs).toEqual([]);
    expect(plan.finance).toBeNull();
  });

  it("round-trips finance and feasibility", () => {
    const id = createPlan("goal", {});
    updatePlan(id, { finance, feasibility, analysisStatus: "COMPLETED", missingInformation: ["rent"] });
    const plan = getPlan(id)!;
    expect(plan.finance).toEqual(finance);
    expect(plan.feasibility).toEqual(feasibility);
    expect(plan.analysisStatus).toBe("COMPLETED");
    expect(plan.missingInformation).toEqual(["rent"]);
  });

  it("upserts runs by role", () => {
    const id = createPlan("goal", {});
    recordRun(id, { role: "demand", status: "RUNNING", externalSessionId: "s1", durationMs: null, error: null });
    recordRun(id, { role: "demand", status: "FAILED", externalSessionId: "s1", durationMs: 1200, error: "boom" });
    recordRun(id, { role: "growth", status: "COMPLETED", externalSessionId: null, durationMs: 10, error: null });
    const { runs } = getPlan(id)!;
    expect(runs).toHaveLength(2);
    expect(runs[0]).toEqual({ role: "demand", status: "FAILED", externalSessionId: "s1", durationMs: 1200, error: "boom" });
  });

  it("returns null for unknown id", () => {
    expect(getPlan("nope")).toBeNull();
  });

  it("stores injection-looking text verbatim", () => {
    const evil = "'); DROP TABLE business_plans; --";
    const id = createPlan(evil, {});
    expect(getPlan(id)!.goalText).toBe(evil);
  });
});
