import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { computeFinance, evaluateFeasibility } from "@/lib/finance/engine";
import { getPlan } from "@/lib/db/plans";
import { listOrders, orderSummary } from "@/lib/db/orders";
import { BusinessInputs, OrderStatus } from "@/lib/schemas/plan";
import type { Order } from "@/lib/schemas/plan";

const financeInputSchema = z.object(BusinessInputs.shape).partial();
const feasibilityInputSchema = z
  .object({
    ...BusinessInputs.shape,
    demandEvidenceSupportsTarget: z.boolean().optional(),
  })
  .partial();
const getPlanInputSchema = z.object({ planId: z.string().trim().min(1) });
const listOrdersInputSchema = z.object({
  status: OrderStatus.optional(),
  limit: z.number().int().min(1).max(200).default(50),
});
const emptyInputSchema = z.object({});

const readOnly = { readOnlyHint: true } as const;

type ToolResult = {
  structuredContent: Record<string, unknown>;
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

function structured(data: unknown): Record<string, unknown> {
  return data !== null && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : { result: data };
}

function ok(data: unknown, structuredContent = structured(data)): ToolResult {
  return {
    structuredContent,
    content: [{ type: "text", text: JSON.stringify(data) }],
  };
}

function toolError(message: string): ToolResult {
  return {
    isError: true,
    structuredContent: { error: message },
    content: [{ type: "text", text: message }],
  };
}

function hasUnsafeNumber(value: unknown): boolean {
  if (typeof value === "number") return !Number.isSafeInteger(value);
  if (Array.isArray(value)) return value.some(hasUnsafeNumber);
  if (value !== null && typeof value === "object") return Object.values(value).some(hasUnsafeNumber);
  return false;
}

function publicOrder(order: Order) {
  return {
    id: order.id,
    productName: order.productName,
    quantity: order.quantity,
    unitPriceSen: order.unitPriceSen,
    subtotalSen: order.subtotalSen,
    fulfilmentOption: order.fulfilmentOption,
    requestedDatetime: order.requestedDatetime,
    status: order.status,
    createdAt: order.createdAt,
  };
}

export function createCampusbizServer(): McpServer {
  const server = new McpServer({ name: "campusbiz", version: "0.1.0" });

  server.registerTool(
    "calculate_finance",
    {
      description: "Compute deterministic finance numbers from business inputs.",
      inputSchema: financeInputSchema,
      annotations: readOnly,
    },
    (input) => {
      try {
        const businessInputs = BusinessInputs.parse(input);
        if (hasUnsafeNumber(businessInputs)) return toolError("Finance input exceeds safe integer range.");
        const finance = computeFinance(businessInputs);
        if (hasUnsafeNumber(finance)) return toolError("Finance result exceeds safe integer range.");
        return ok(finance);
      } catch {
        return toolError("Invalid finance input.");
      }
    },
  );

  server.registerTool(
    "evaluate_feasibility",
    {
      description: "Compute finance and evaluate feasibility from business inputs.",
      inputSchema: feasibilityInputSchema,
      annotations: readOnly,
    },
    (input) => {
      try {
        const { demandEvidenceSupportsTarget, ...rawBusinessInputs } = input;
        const businessInputs = BusinessInputs.parse(rawBusinessInputs);
        if (hasUnsafeNumber(businessInputs)) return toolError("Finance input exceeds safe integer range.");
        const finance = computeFinance(businessInputs);
        if (hasUnsafeNumber(finance)) return toolError("Finance result exceeds safe integer range.");
        const feasibility = evaluateFeasibility(finance, businessInputs.startingCapitalSen ?? null, {
          demandEvidence: demandEvidenceSupportsTarget ? "SUPPORTS_TARGET" : undefined,
        });
        return ok({ finance, feasibility });
      } catch {
        return toolError("Invalid feasibility input.");
      }
    },
  );

  server.registerTool(
    "get_plan",
    {
      description: "Read a saved business plan subset by id.",
      inputSchema: getPlanInputSchema,
      annotations: readOnly,
    },
    ({ planId }) => {
      try {
        const plan = getPlan(planId);
        if (!plan) return toolError("Plan not found.");
        return ok({
          id: plan.id,
          analysisStatus: plan.analysisStatus,
          source: plan.source,
          inputs: plan.inputs,
          finance: plan.finance,
          feasibility: plan.feasibility,
          missingInformation: plan.missingInformation,
          assumptions: plan.assumptions,
          products: plan.growth?.products.map((product) => ({ name: product.name, priceSen: product.priceSen })) ?? null,
        });
      } catch {
        return toolError("Unable to read plan.");
      }
    },
  );

  server.registerTool(
    "list_orders",
    {
      description: "Read recent orders without customer personal data.",
      inputSchema: listOrdersInputSchema,
      annotations: readOnly,
    },
    ({ status, limit }) => {
      try {
        const orders = listOrders(status ? { status } : undefined)
          .slice(0, limit)
          .map(publicOrder);
        return ok(orders, { orders });
      } catch {
        return toolError("Unable to list orders.");
      }
    },
  );

  server.registerTool(
    "order_summary",
    {
      description: "Read aggregate order counts and revenue.",
      inputSchema: emptyInputSchema,
      annotations: readOnly,
    },
    () => {
      try {
        return ok(orderSummary());
      } catch {
        return toolError("Unable to summarize orders.");
      }
    },
  );

  return server;
}
