import type { BusinessPlan } from "./plan";

/**
 * Hand-written demo plan so the UI can be built before the agent side is ready.
 * Numbers are the spec section 18 demo scenario (price RM5, cost RM2, fixed RM100,
 * target RM800, 40/day, 22 days). Shown in the UI ONLY with a visible [SAMPLE] label.
 */
export const samplePlan: BusinessPlan = {
  id: "sample",
  source: "SAMPLE",
  createdAt: "2026-01-01T00:00:00.000Z",
  goalText: "Sample: homemade cookies on campus, RM300 capital, RM800 monthly profit target.",
  analysisStatus: "COMPLETED",
  runs: [],
  inputs: {
    businessName: "Sample Cookie Co.",
    businessType: "homemade cookies",
    currency: "MYR",
    startingCapitalSen: 30000,
    sellingPriceSen: 500,
    variableCostPerUnitSen: 200,
    monthlyFixedCostsSen: 10000,
    targetMonthlyProfitSen: 80000,
    dailyCapacityUnits: 40,
    operatingDaysPerMonth: 22,
  },
  assumptions: [],
  missingInformation: ["Setup expenses", "Evidence of demand"],
  finance: {
    provenance: "CALCULATED",
    valid: true,
    unitContributionSen: 300,
    breakEvenUnits: 34,
    requiredMonthlyUnits: 300,
    requiredDailyUnits: 14,
    projectedRevenueSen: 150000,
    projectedVariableCostsSen: 60000,
    fixedCostsSen: 10000,
    projectedOperatingProfitSen: 80000,
    monthlyCapacityUnits: 880,
    fitsCapacity: true,
    capitalNeededSen: null,
    fitsCapital: null,
    missingInputs: ["setupExpenses"],
    exclusions: ["tax", "owner pay", "delivery", "wastage", "transaction fees"],
    warnings: [],
  },
  feasibility: {
    provenance: "CALCULATED",
    status: "AT_RISK",
    reasons: [
      { text: "Unit contribution is positive and 300 units fit within 880 monthly capacity.", severity: "info" },
      { text: "Setup costs unknown, so the RM300 capital check is incomplete.", severity: "warning" },
      { text: "No demand evidence supports 14 sales per day yet.", severity: "warning" },
    ],
  },
  demand: null,
  growth: null,
  operations: null,
  nextActions: [{ text: "Run a small campus survey to test demand for 14 cookies per day.", provenance: "GENERATED" }],
};
