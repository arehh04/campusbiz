/**
 * THE CONTRACT between the agent/backend side and the UI side.
 * Change this file only by agreement: both halves of the app compile against it.
 *
 * Conventions
 *  - All money is an integer number of sen (RM1.00 = 100). Fields end in `Sen`.
 *  - Every significant value carries a provenance label (spec section 13).
 *  - WorkBuddy output is untrusted: the `*Output` schemas below are what the
 *    adapter validates before anything is saved or rendered.
 */
import { z } from "zod";

// ---------- provenance ----------
export const Provenance = z.enum([
  "USER_INPUT", // facts supplied by the user
  "CALCULATED", // deterministic application code
  "ESTIMATED", // forecast from assumptions or evidence
  "SIMULATED", // hypothetical scenario
  "GENERATED", // content created by WorkBuddy or the app
  "VERIFIED", // checked against a reliable external source
  "UNVERIFIED", // still needs confirmation
]);
export type Provenance = z.infer<typeof Provenance>;

const sen = z.number().int().nonnegative();
const text = (max = 2000) => z.string().trim().min(1).max(max);

// ---------- 1. business inputs (user-provided, all optional: partial goals are allowed) ----------
export const BusinessInputs = z.object({
  businessName: text(120).nullish(),
  businessType: text(200).nullish(),
  currency: z.literal("MYR").default("MYR"),
  startingCapitalSen: sen.nullish(),
  sellingPriceSen: sen.nullish(),
  variableCostPerUnitSen: sen.nullish(),
  monthlyFixedCostsSen: sen.nullish(),
  setupExpensesSen: sen.nullish(),
  targetMonthlyProfitSen: sen.nullish(),
  dailyCapacityUnits: z.number().int().positive().nullish(),
  operatingDaysPerMonth: z.number().int().min(1).max(31).nullish(),
  targetCustomers: text(300).nullish(),
  launchDate: z.string().date().nullish(),
});
export type BusinessInputs = z.infer<typeof BusinessInputs>;

/** What the user submits to POST /api/analyze. */
export const AnalyzeRequest = z.object({
  goalText: text(4000),
  inputs: BusinessInputs.partial().optional(),
});
export type AnalyzeRequest = z.infer<typeof AnalyzeRequest>;

// ---------- 2. orchestrator output: goal interpretation ----------
export const GoalInterpretationOutput = z.object({
  inputs: BusinessInputs,
  /** Fields the orchestrator could not find in the goal. */
  missingInformation: z.array(text(300)),
  /** Every value the model assumed rather than read from the user. Must be shown as ESTIMATED/UNVERIFIED. */
  assumptions: z.array(z.object({ field: text(80), value: text(200), note: text(300) })),
  clarifyingQuestions: z.array(text(300)).max(5),
});
export type GoalInterpretationOutput = z.infer<typeof GoalInterpretationOutput>;

// ---------- 3. finance (deterministic: NEVER produced by the LLM) ----------
export const FinanceResult = z.object({
  provenance: z.literal("CALCULATED"),
  valid: z.boolean(), // false when unit contribution <= 0
  unitContributionSen: z.number().int().nullable(), // null when price or variable cost is missing
  breakEvenUnits: z.number().int().nullable(),
  requiredMonthlyUnits: z.number().int().nullable(),
  requiredDailyUnits: z.number().int().nullable(),
  projectedRevenueSen: z.number().int().nullable(),
  projectedVariableCostsSen: z.number().int().nullable(),
  fixedCostsSen: z.number().int().nullable(),
  projectedOperatingProfitSen: z.number().int().nullable(),
  monthlyCapacityUnits: z.number().int().nullable(),
  fitsCapacity: z.boolean().nullable(),
  capitalNeededSen: z.number().int().nullable(),
  fitsCapital: z.boolean().nullable(),
  /** Missing cost inputs that make the result incomplete. */
  missingInputs: z.array(z.string()),
  /** Costs deliberately excluded (tax, wastage, delivery, owner pay...). */
  exclusions: z.array(z.string()),
  warnings: z.array(z.string()),
});
export type FinanceResult = z.infer<typeof FinanceResult>;

export const FeasibilityStatus = z.enum(["FEASIBLE", "AT_RISK", "NOT_FEASIBLE", "INSUFFICIENT_DATA"]);
export type FeasibilityStatus = z.infer<typeof FeasibilityStatus>;

export const Feasibility = z.object({
  provenance: z.literal("CALCULATED"),
  status: FeasibilityStatus,
  reasons: z.array(z.object({ text: z.string(), severity: z.enum(["info", "warning", "blocker"]) })),
});
export type Feasibility = z.infer<typeof Feasibility>;

// ---------- 4. specialist outputs (WorkBuddy, validated) ----------
export const DemandOutput = z.object({
  segments: z.array(z.object({ name: text(100), problem: text(300), motivation: text(300) })).max(6),
  /** Scenario numbers are illustrative: provenance must be SIMULATED or ESTIMATED, never VERIFIED. */
  scenarios: z
    .array(
      z.object({
        name: z.enum(["conservative", "expected", "optimistic"]),
        provenance: z.enum(["SIMULATED", "ESTIMATED"]),
        peopleReachedPerDay: z.number().int().nonnegative(),
        conversionRatePercent: z.number().min(0).max(100),
        unitsPerCustomer: z.number().positive(),
        assumptions: text(500),
      }),
    )
    .max(3),
  researchSuggestions: z.array(text(300)).max(8),
  risks: z.array(text(300)).max(8),
});
export type DemandOutput = z.infer<typeof DemandOutput>;

export const GrowthOutput = z.object({
  positioning: text(500),
  valueProposition: text(300),
  targetAudience: text(300),
  products: z.array(z.object({ name: text(80), description: text(300), priceSen: sen })).min(1).max(8),
  landingPage: z.object({
    businessName: text(80),
    headline: text(120),
    subheadline: text(300),
    callToAction: text(60),
    orderingInstructions: text(300),
    sections: z.array(z.object({ title: text(80), body: text(600) })).max(6),
  }),
  socialCaptions: z.array(text(400)).length(3),
  launchAnnouncement: text(1000),
  promotionalOffer: text(300),
  sevenDayCalendar: z.array(z.object({ day: z.number().int().min(1).max(7), activity: text(300) })).length(7),
});
export type GrowthOutput = z.infer<typeof GrowthOutput>;

export const OperationsOutput = z.object({
  /** Recommended daily production. The backend clamps this to stated capacity regardless. */
  suggestedDailyUnits: z.number().int().nonnegative(),
  dailyPreparationPlan: z.array(text(300)).max(12),
  checklist: z.array(
    z.object({
      phase: z.enum(["preparation", "inventory", "production", "packaging", "order_confirmation", "fulfilment", "end_of_day"]),
      items: z.array(text(200)).min(1).max(10),
    }),
  ),
  wasteReduction: z.array(text(300)).max(6),
  risks: z.array(text(300)).max(8),
});
export type OperationsOutput = z.infer<typeof OperationsOutput>;

// ---------- 5. run tracking (truthful execution status) ----------
export const RunStatus = z.enum(["QUEUED", "RUNNING", "COMPLETED", "FAILED", "UNAVAILABLE", "MANUAL_REQUIRED"]);
export type RunStatus = z.infer<typeof RunStatus>;

export const AgentRun = z.object({
  role: z.enum(["orchestrator", "demand", "growth", "operations", "consolidation"]),
  status: RunStatus,
  externalSessionId: z.string().nullable(),
  durationMs: z.number().int().nullable(),
  error: z.string().nullable(), // already redacted
});
export type AgentRun = z.infer<typeof AgentRun>;

// ---------- 6. the consolidated plan returned by GET /api/analysis/:id ----------
export const BusinessPlan = z.object({
  id: z.string(),
  /** SAMPLE data must be labelled as such in the UI. */
  source: z.enum(["WORKBUDDY", "MANUAL_WORKBUDDY", "SAMPLE"]),
  createdAt: z.string().datetime(),
  goalText: z.string(),
  analysisStatus: RunStatus,
  runs: z.array(AgentRun),
  inputs: BusinessInputs,
  assumptions: GoalInterpretationOutput.shape.assumptions,
  missingInformation: z.array(z.string()),
  finance: FinanceResult.nullable(),
  feasibility: Feasibility.nullable(),
  demand: DemandOutput.nullable(),
  growth: GrowthOutput.nullable(),
  operations: OperationsOutput.nullable(),
  /** Backend-computed from confirmed orders and capacity, not from the LLM. */
  nextActions: z.array(z.object({ text: z.string(), provenance: Provenance })),
});
export type BusinessPlan = z.infer<typeof BusinessPlan>;

// ---------- 7. orders ----------
export const OrderStatus = z.enum(["PENDING", "CONFIRMED", "PREPARING", "READY", "COMPLETED", "CANCELLED"]);
export type OrderStatus = z.infer<typeof OrderStatus>;

/** Allowed status moves; enforce in PATCH /api/orders/:id. */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

/** Customer-supplied. Price and subtotal are NEVER accepted from the client. */
export const CreateOrderRequest = z.object({
  customerName: text(100),
  customerContact: text(100).optional(),
  productName: text(80),
  quantity: z.number().int().min(1).max(500),
  fulfilmentOption: z.enum(["COLLECTION", "DELIVERY"]),
  requestedDatetime: z.string().datetime().optional(),
  notes: text(500).optional(),
});
export type CreateOrderRequest = z.infer<typeof CreateOrderRequest>;

export const Order = z.object({
  id: z.string(),
  customerName: z.string(),
  customerContact: z.string().nullable(),
  productName: z.string(),
  quantity: z.number().int(),
  unitPriceSen: sen,
  subtotalSen: sen, // computed server-side
  fulfilmentOption: z.enum(["COLLECTION", "DELIVERY"]),
  requestedDatetime: z.string().nullable(),
  status: OrderStatus,
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Order = z.infer<typeof Order>;
