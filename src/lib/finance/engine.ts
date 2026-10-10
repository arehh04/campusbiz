import type { BusinessInputs, Feasibility, FinanceResult } from "@/lib/schemas/plan";

/** Ceiling of a / b for non-negative integers, without float rounding. */
const ceilDiv = (a: number, b: number) => Math.floor((a + b - 1) / b);

const EXCLUSIONS = ["tax", "owner pay", "delivery", "wastage", "transaction fees", "ingredient purchases for launch stock"];

/**
 * Deterministic finance maths. All money is integer sen. Nothing here is LLM-produced.
 * Missing inputs yield nulls plus a `missingInputs` entry, never silent assumptions.
 */
export function computeFinance(i: BusinessInputs): FinanceResult {
  if (i.operatingDaysPerMonth != null && i.operatingDaysPerMonth < 1) {
    throw new RangeError("operatingDaysPerMonth must be at least 1");
  }
  const price = i.sellingPriceSen ?? null;
  const cost = i.variableCostPerUnitSen ?? null;
  const fixed = i.monthlyFixedCostsSen ?? null;
  const target = i.targetMonthlyProfitSen ?? null;
  const days = i.operatingDaysPerMonth ?? null;
  const daily = i.dailyCapacityUnits ?? null;
  const setup = i.setupExpensesSen ?? null;
  const capital = i.startingCapitalSen ?? null;

  const missing: string[] = [];
  const need = (name: string, v: unknown) => v == null && missing.push(name);
  need("sellingPrice", price);
  need("variableCostPerUnit", cost);
  need("monthlyFixedCosts", fixed);
  need("targetMonthlyProfit", target);
  need("operatingDaysPerMonth", days);
  need("dailyCapacity", daily);
  need("setupExpenses", setup);
  need("startingCapital", capital);

  const warnings: string[] = [];
  const contribution = price != null && cost != null ? price - cost : null;
  const valid = contribution != null && contribution > 0;
  if (contribution != null && !valid) {
    warnings.push("Selling price does not cover variable cost per unit. Review price, ingredients, sourcing or production cost.");
  }

  const breakEven = valid && fixed != null ? ceilDiv(fixed, contribution) : null;
  const requiredMonthly = valid && fixed != null && target != null ? ceilDiv(target + fixed, contribution) : null;
  const requiredDaily = requiredMonthly != null && days != null ? ceilDiv(requiredMonthly, days) : null;

  const revenue = requiredMonthly != null && price != null ? requiredMonthly * price : null;
  const variable = requiredMonthly != null && cost != null ? requiredMonthly * cost : null;
  const profit = revenue != null && variable != null && fixed != null ? revenue - variable - fixed : null;

  const monthlyCapacity = daily != null && days != null ? daily * days : null;
  const fitsCapacity = requiredMonthly != null && monthlyCapacity != null ? requiredMonthly <= monthlyCapacity : null;
  if (fitsCapacity === false) warnings.push("Required monthly sales exceed stated production capacity.");

  // Only supplied setup expenses are counted; launch stock is listed as an exclusion.
  const capitalNeeded = setup;
  const fitsCapital = capitalNeeded != null && capital != null ? capitalNeeded <= capital : null;
  if (fitsCapital === false) warnings.push("Known setup expenses exceed starting capital.");

  return {
    provenance: "CALCULATED",
    valid,
    unitContributionSen: contribution,
    breakEvenUnits: breakEven,
    requiredMonthlyUnits: requiredMonthly,
    requiredDailyUnits: requiredDaily,
    projectedRevenueSen: revenue,
    projectedVariableCostsSen: variable,
    fixedCostsSen: fixed,
    projectedOperatingProfitSen: profit,
    monthlyCapacityUnits: monthlyCapacity,
    fitsCapacity,
    capitalNeededSen: capitalNeeded,
    fitsCapital,
    missingInputs: missing,
    exclusions: EXCLUSIONS,
    warnings,
  };
}

export interface FeasibilityOptions {
  /** Real or historical evidence that demand supports the target. Absent means unproven. */
  demandEvidence?: "SUPPORTS_TARGET";
}

// Fields without which no responsible verdict is possible. Setup expenses and capital only soften it.
const CORE = ["sellingPrice", "variableCostPerUnit", "monthlyFixedCosts", "targetMonthlyProfit", "operatingDaysPerMonth", "dailyCapacity"];
const TIGHT = 0.8;

export function evaluateFeasibility(f: FinanceResult, startingCapitalSen: number | null, opts: FeasibilityOptions = {}): Feasibility {
  const capital = startingCapitalSen;
  const reasons: Feasibility["reasons"] = [];
  const out = (status: Feasibility["status"]): Feasibility => ({ provenance: "CALCULATED", status, reasons });

  const missingCore = f.missingInputs.filter((m) => CORE.includes(m));
  if (missingCore.length) {
    reasons.push({ text: `Missing required inputs: ${missingCore.join(", ")}.`, severity: "blocker" });
    return out("INSUFFICIENT_DATA");
  }

  let blocked = false;
  if (!f.valid) {
    reasons.push({ text: "Unit contribution is zero or negative: the price does not cover variable cost.", severity: "blocker" });
    blocked = true;
  }
  if (f.fitsCapacity === false) {
    reasons.push({ text: `Required ${f.requiredMonthlyUnits} units/month exceeds capacity of ${f.monthlyCapacityUnits}.`, severity: "blocker" });
    blocked = true;
  }
  if (f.fitsCapital === false) {
    reasons.push({ text: "Known startup expenses exceed available capital.", severity: "blocker" });
    blocked = true;
  }
  if (blocked) return out("NOT_FEASIBLE");

  let risky = false;
  reasons.push({ text: `Required ${f.requiredMonthlyUnits} units/month fits within capacity of ${f.monthlyCapacityUnits}.`, severity: "info" });
  if (f.monthlyCapacityUnits! > 0 && f.requiredMonthlyUnits! / f.monthlyCapacityUnits! >= TIGHT) {
    reasons.push({ text: "Required sales use most of the stated capacity.", severity: "warning" });
    risky = true;
  }
  if (f.fitsCapital === null) {
    reasons.push({ text: "Startup costs or starting capital unknown, so the capital check is incomplete.", severity: "warning" });
    risky = true;
  } else if (capital! > 0 && f.capitalNeededSen! / capital! >= TIGHT) {
    reasons.push({ text: "Setup expenses use most of the starting capital.", severity: "warning" });
    risky = true;
  }
  if (opts.demandEvidence !== "SUPPORTS_TARGET") {
    reasons.push({ text: "No demand evidence supports the sales target yet.", severity: "warning" });
    risky = true;
  }
  return out(risky ? "AT_RISK" : "FEASIBLE");
}
