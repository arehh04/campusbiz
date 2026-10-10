import { describe, expect, it } from "vitest";
import type { BusinessInputs } from "@/lib/schemas/plan";
import { computeFinance, evaluateFeasibility } from "./engine";

// Spec section 18 demo: RM5 price, RM2 cost, RM100 fixed, RM800 target, 40/day, 22 days, RM300 capital.
const demo: BusinessInputs = {
  currency: "MYR",
  startingCapitalSen: 30000,
  sellingPriceSen: 500,
  variableCostPerUnitSen: 200,
  monthlyFixedCostsSen: 10000,
  targetMonthlyProfitSen: 80000,
  dailyCapacityUnits: 40,
  operatingDaysPerMonth: 22,
};

describe("computeFinance", () => {
  it("reproduces the spec demo numbers", () => {
    const f = computeFinance(demo);
    expect(f).toMatchObject({
      valid: true,
      unitContributionSen: 300,
      breakEvenUnits: 34,
      requiredMonthlyUnits: 300,
      requiredDailyUnits: 14,
      projectedRevenueSen: 150000,
      projectedVariableCostsSen: 60000,
      projectedOperatingProfitSen: 80000,
      monthlyCapacityUnits: 880,
      fitsCapacity: true,
    });
  });

  it("flags non-positive contribution and gives no sales target", () => {
    const f = computeFinance({ ...demo, sellingPriceSen: 200 });
    expect(f.valid).toBe(false);
    expect(f.requiredMonthlyUnits).toBeNull();
    expect(f.warnings[0]).toMatch(/does not cover variable cost/);
  });

  it("rejects zero operating days", () => {
    expect(() => computeFinance({ ...demo, operatingDaysPerMonth: 0 })).toThrow(RangeError);
  });

  it("treats zero fixed costs as zero break-even", () => {
    expect(computeFinance({ ...demo, monthlyFixedCostsSen: 0 }).breakEvenUnits).toBe(0);
  });

  it("lists missing inputs instead of assuming them", () => {
    const f = computeFinance({ currency: "MYR" });
    expect(f.missingInputs).toContain("sellingPrice");
    expect(f.unitContributionSen).toBeNull();
  });

  it("is exact at awkward sen values (no float drift)", () => {
    const f = computeFinance({ ...demo, sellingPriceSen: 333, variableCostPerUnitSen: 111, monthlyFixedCostsSen: 1, targetMonthlyProfitSen: 1 });
    expect(f.requiredMonthlyUnits).toBe(1); // ceil(2 / 222)
  });
});

describe("evaluateFeasibility", () => {
  const verdict = (i: BusinessInputs, opts = {}) => evaluateFeasibility(computeFinance(i), i.startingCapitalSen ?? null, opts).status;

  it("demo is AT_RISK: setup costs unknown and no demand evidence", () => {
    expect(verdict(demo)).toBe("AT_RISK");
  });
  it("FEASIBLE needs known fitting capital and demand evidence", () => {
    const i = { ...demo, setupExpensesSen: 10000 };
    expect(verdict(i, { demandEvidence: "SUPPORTS_TARGET" })).toBe("FEASIBLE");
    expect(verdict(i)).toBe("AT_RISK");
  });
  it("NOT_FEASIBLE when capacity is too low", () => {
    expect(verdict({ ...demo, dailyCapacityUnits: 10 })).toBe("NOT_FEASIBLE");
  });
  it("NOT_FEASIBLE when setup exceeds capital", () => {
    expect(verdict({ ...demo, setupExpensesSen: 40000 })).toBe("NOT_FEASIBLE");
  });
  it("NOT_FEASIBLE when contribution is not positive", () => {
    expect(verdict({ ...demo, sellingPriceSen: 200 })).toBe("NOT_FEASIBLE");
  });
  it("INSUFFICIENT_DATA when core inputs are missing", () => {
    expect(verdict({ currency: "MYR", startingCapitalSen: 30000 })).toBe("INSUFFICIENT_DATA");
  });
  it("AT_RISK when capacity is nearly used", () => {
    expect(verdict({ ...demo, dailyCapacityUnits: 15, setupExpensesSen: 1000 }, { demandEvidence: "SUPPORTS_TARGET" })).toBe("AT_RISK");
  });
});
