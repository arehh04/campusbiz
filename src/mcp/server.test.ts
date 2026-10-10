import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { CallToolResultSchema, type CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createOrder } from "@/lib/db/orders";
import { resetDbForTests } from "@/lib/db";
import { createPlan, updatePlan } from "@/lib/db/plans";
import type { CreateOrderRequest, GrowthOutput } from "@/lib/schemas/plan";
import { createCampusbizServer } from "./tools";

const toolNames = ["calculate_finance", "evaluate_feasibility", "get_plan", "list_orders", "order_summary"];
const publicOrderKeys = [
  "createdAt",
  "fulfilmentOption",
  "id",
  "productName",
  "quantity",
  "requestedDatetime",
  "status",
  "subtotalSen",
  "unitPriceSen",
];

const demoInputs = {
  sellingPriceSen: 500,
  variableCostPerUnitSen: 200,
  monthlyFixedCostsSen: 10000,
  targetMonthlyProfitSen: 80000,
  dailyCapacityUnits: 40,
  operatingDaysPerMonth: 22,
  startingCapitalSen: 30000,
};

const growth = (products: { name: string; priceSen: number }[]): GrowthOutput => ({
  positioning: "positioning",
  valueProposition: "value",
  targetAudience: "students",
  products: products.map((product) => ({ ...product, description: "description" })),
  landingPage: {
    businessName: "Campus Cookies",
    headline: "Fresh cookies",
    subheadline: "Baked daily",
    callToAction: "Order now",
    orderingInstructions: "Message us",
    sections: [],
  },
  socialCaptions: ["one", "two", "three"],
  launchAnnouncement: "launch",
  promotionalOffer: "offer",
  sevenDayCalendar: [1, 2, 3, 4, 5, 6, 7].map((day) => ({ day, activity: `day ${day}` })),
});

const orderRequest = (overrides: Partial<CreateOrderRequest> = {}): CreateOrderRequest => ({
  customerName: "Ana",
  productName: "Cookie",
  quantity: 2,
  fulfilmentOption: "COLLECTION",
  ...overrides,
});

beforeEach(() => {
  process.env.DATABASE_PATH = ":memory:";
  resetDbForTests();
});

afterEach(() => {
  resetDbForTests();
});

async function connectInMemory() {
  const server = createCampusbizServer();
  const client = new Client({ name: "campusbiz-test", version: "0.1.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, server };
}

async function withInMemoryClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const { client, server } = await connectInMemory();
  try {
    return await fn(client);
  } finally {
    await client.close();
    await server.close();
  }
}

/** Typed view of structuredContent (the SDK types it as {}). */
function sc(result: unknown): Record<string, unknown> {
  return (result as { structuredContent?: Record<string, unknown> }).structuredContent ?? {};
}

function textJson(result: unknown): unknown {
  const r = result as CallToolResult;
  const block = r.content.find((item) => item.type === "text");
  if (!block || block.type !== "text") throw new Error("missing text block");
  return JSON.parse(block.text);
}

describe("campusbiz MCP server", () => {
  it("lists the five read-only tools", async () => {
    await withInMemoryClient(async (client) => {
      const list = await client.listTools();
      expect(list.tools.map((tool) => tool.name).sort()).toEqual([...toolNames].sort());
      expect(list.tools.every((tool) => tool.annotations?.readOnlyHint === true)).toBe(true);
    });
  });

  it("calculates finance through the finance engine", async () => {
    await withInMemoryClient(async (client) => {
      const result = await client.callTool(
        { name: "calculate_finance", arguments: demoInputs },
        CallToolResultSchema,
      );
      expect(result.isError).not.toBe(true);
      expect(sc(result).requiredMonthlyUnits).toBe(300);
      expect(sc(result).requiredDailyUnits).toBe(14);
      expect(textJson(result)).toMatchObject({ requiredMonthlyUnits: 300, requiredDailyUnits: 14 });
    });
  });

  it("evaluates feasibility from finance and demand evidence", async () => {
    await withInMemoryClient(async (client) => {
      const atRisk = await client.callTool(
        { name: "evaluate_feasibility", arguments: demoInputs },
        CallToolResultSchema,
      );
      expect(sc(atRisk).feasibility).toMatchObject({ status: "AT_RISK" });

      const feasible = await client.callTool(
        {
          name: "evaluate_feasibility",
          arguments: { ...demoInputs, setupExpensesSen: 10000, demandEvidenceSupportsTarget: true },
        },
        CallToolResultSchema,
      );
      expect(sc(feasible).feasibility).toMatchObject({ status: "FEASIBLE" });
    });
  });

  it("returns plan lookup errors and only the allowed plan subset", async () => {
    await withInMemoryClient(async (client) => {
      const missing = await client.callTool({ name: "get_plan", arguments: { planId: "missing" } }, CallToolResultSchema);
      expect(missing.isError).toBe(true);

      const planId = createPlan("sell cookies", demoInputs);
      updatePlan(planId, {
        analysisStatus: "COMPLETED",
        growth: growth([{ name: "Cookie", priceSen: 500 }]),
      });

      const result = await client.callTool({ name: "get_plan", arguments: { planId } }, CallToolResultSchema);
      expect(result.isError).not.toBe(true);
      expect(Object.keys(sc(result)).sort()).toEqual(
        [
          "analysisStatus",
          "assumptions",
          "feasibility",
          "finance",
          "id",
          "inputs",
          "missingInformation",
          "products",
          "source",
        ].sort(),
      );
      expect(sc(result).products).toEqual([{ name: "Cookie", priceSen: 500 }]);
      expect(JSON.stringify(result)).not.toContain('"runs"');
    });
  });

  it("keeps personal order data out and returns order summary", async () => {
    await withInMemoryClient(async (client) => {
      const planId = createPlan("sell cookies", {});
      updatePlan(planId, { growth: growth([{ name: "Cookie", priceSen: 500 }]) });
      createOrder(
        planId,
        orderRequest({ customerName: "Secret Person", customerContact: "0123456789", notes: "private" }),
      );

      const orders = await client.callTool({ name: "list_orders", arguments: {} }, CallToolResultSchema);
      const serialized = JSON.stringify(orders);
      expect(serialized).not.toContain("Secret Person");
      expect(serialized).not.toContain("0123456789");
      expect(serialized).not.toContain("private");
      expect(sc(orders).orders).toMatchObject([
        { productName: "Cookie", quantity: 2, unitPriceSen: 500, subtotalSen: 1000, status: "PENDING" },
      ]);
      const structuredOrders = sc(orders).orders as Record<string, unknown>[];
      expect(Object.keys(structuredOrders[0]).sort()).toEqual([...publicOrderKeys].sort());
      const textOrders = textJson(orders) as Record<string, unknown>[];
      expect(Object.keys(textOrders[0]).sort()).toEqual([...publicOrderKeys].sort());

      const summary = await client.callTool({ name: "order_summary", arguments: {} }, CallToolResultSchema);
      expect(sc(summary).totalOrders).toBe(1);
    });
  });

  it(
    "serves tools over stdio with clean stdout",
    async () => {
      const env = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] != null));
      env.DATABASE_PATH = ":memory:";
      const client = new Client({ name: "campusbiz-stdio-test", version: "0.1.0" });
      const transport = new StdioClientTransport({
        command: process.execPath,
        args: ["node_modules/tsx/dist/cli.mjs", "src/mcp/server.ts"],
        env,
        stderr: "pipe",
      });

      try {
        await client.connect(transport);
        const list = await client.listTools();
        expect(list.tools.map((tool) => tool.name).sort()).toEqual([...toolNames].sort());
        const result = await client.callTool(
          { name: "calculate_finance", arguments: demoInputs },
          CallToolResultSchema,
        );
        expect(sc(result).requiredMonthlyUnits).toBe(300);
      } finally {
        await client.close();
      }
    },
    30_000,
  );
});
