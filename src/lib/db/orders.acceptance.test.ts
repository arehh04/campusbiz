import { beforeEach, describe, expect, it } from "vitest";
import { resetDbForTests } from "@/lib/db";
import { createPlan, updatePlan } from "@/lib/db/plans";
import { OrderError, createOrder, getOrder, listOrders, orderSummary, ordersToCsv, updateOrderStatus } from "@/lib/db/orders";
import { GET as listRoute, POST as createRoute } from "@/app/api/orders/route";
import { PATCH as patchRoute } from "@/app/api/orders/[id]/route";

const day = (n: number) => ({ day: n, activity: `d${n}` });
let planId: string;

beforeEach(() => {
  process.env.DATABASE_PATH = ":memory:";
  resetDbForTests();
  planId = createPlan("cookies", {});
  updatePlan(planId, {
    growth: {
      positioning: "p",
      valueProposition: "v",
      targetAudience: "t",
      products: [
        { name: "Choc Chip Cookie", description: "d", priceSen: 500 },
        { name: "Oat Cookie", description: "d", priceSen: 450 },
      ],
      landingPage: { businessName: "B", headline: "h", subheadline: "s", callToAction: "c", orderingInstructions: "o", sections: [] },
      socialCaptions: ["a", "b", "c"],
      launchAnnouncement: "l",
      promotionalOffer: "o",
      sevenDayCalendar: [1, 2, 3, 4, 5, 6, 7].map(day),
    },
  });
});

const req = (over = {}) => ({ customerName: "Aina", productName: "Choc Chip Cookie", quantity: 3, fulfilmentOption: "COLLECTION" as const, ...over });
const json = (url: string, method: string, body?: unknown) =>
  new Request(`http://x${url}`, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const codeOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e instanceof OrderError ? e.code : `other:${(e as Error).message}`;
  }
  return "no-throw";
};

describe("orders lib", () => {
  it("creates a PENDING order with server-side price and subtotal", () => {
    const o = createOrder(planId, req());
    expect(o).toMatchObject({ status: "PENDING", unitPriceSen: 500, subtotalSen: 1500, quantity: 3, customerName: "Aina", productName: "Choc Chip Cookie" });
    expect(o.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(new Date(o.createdAt).toISOString()).toBe(o.createdAt);
  });
  it("matches product names case-insensitively and ignores client-supplied price fields", () => {
    const o = createOrder(planId, { ...req({ productName: "  oat cookie " }), unitPriceSen: 1, subtotalSen: 1 } as never);
    expect(o).toMatchObject({ productName: "Oat Cookie", unitPriceSen: 450, subtotalSen: 1350 });
  });
  it("rejects unknown plan and unknown product with typed codes", () => {
    expect(codeOf(() => createOrder("nope", req()))).toBe("PLAN_NOT_FOUND");
    expect(codeOf(() => createOrder(planId, req({ productName: "Pizza" })))).toBe("UNKNOWN_PRODUCT");
  });
  it("rejects a plan that has no growth products yet", () => {
    const bare = createPlan("x", {});
    expect(codeOf(() => createOrder(bare, req()))).toBe("UNKNOWN_PRODUCT");
  });
  it("persists across a db handle reset only in the same file db (memory resets), and getOrder finds by id", () => {
    const o = createOrder(planId, req());
    expect(getOrder(o.id)).toEqual(o);
    expect(getOrder("missing")).toBeNull();
  });
  it("lists newest first and filters by status", () => {
    const a = createOrder(planId, req({ customerName: "A" }));
    const b = createOrder(planId, req({ customerName: "B" }));
    updateOrderStatus(a.id, "CONFIRMED");
    expect(listOrders().map((o) => o.customerName)).toEqual(["B", "A"]);
    expect(listOrders({ status: "CONFIRMED" }).map((o) => o.id)).toEqual([a.id]);
    expect(listOrders({ status: "READY" })).toEqual([]);
    void b;
  });
  it("allows only transitions in ORDER_TRANSITIONS and bumps updatedAt", () => {
    const o = createOrder(planId, req());
    expect(codeOf(() => updateOrderStatus(o.id, "READY"))).toBe("INVALID_TRANSITION");
    const c = updateOrderStatus(o.id, "CONFIRMED");
    expect(c.status).toBe("CONFIRMED");
    expect(c.updatedAt >= o.updatedAt).toBe(true);
    updateOrderStatus(o.id, "PREPARING");
    updateOrderStatus(o.id, "READY");
    updateOrderStatus(o.id, "COMPLETED");
    expect(codeOf(() => updateOrderStatus(o.id, "CANCELLED"))).toBe("INVALID_TRANSITION"); // terminal
    expect(getOrder(o.id)!.status).toBe("COMPLETED");
  });
  it("unknown order id throws ORDER_NOT_FOUND", () => {
    expect(codeOf(() => updateOrderStatus("missing", "CONFIRMED"))).toBe("ORDER_NOT_FOUND");
  });
  it("summary counts every status and excludes cancelled orders from revenue", () => {
    const a = createOrder(planId, req({ quantity: 2 })); // 1000
    const b = createOrder(planId, req({ quantity: 1 })); // 500
    createOrder(planId, req({ productName: "Oat Cookie", quantity: 1 })); // 450
    updateOrderStatus(b.id, "CANCELLED");
    updateOrderStatus(a.id, "CONFIRMED");
    expect(orderSummary()).toEqual({
      totalOrders: 3,
      byStatus: { PENDING: 1, CONFIRMED: 1, PREPARING: 0, READY: 0, COMPLETED: 0, CANCELLED: 1 },
      revenueSen: 1450,
    });
  });
  it("empty summary is all zeros", () => {
    expect(orderSummary()).toEqual({ totalOrders: 0, byStatus: { PENDING: 0, CONFIRMED: 0, PREPARING: 0, READY: 0, COMPLETED: 0, CANCELLED: 0 }, revenueSen: 0 });
  });
  it("stores hostile text verbatim (parameterised SQL)", () => {
    const o = createOrder(planId, req({ customerName: "x'); DROP TABLE orders;--", notes: "n" }));
    expect(getOrder(o.id)!.customerName).toBe("x'); DROP TABLE orders;--");
    expect(listOrders()).toHaveLength(1);
  });
});

describe("ordersToCsv", () => {
  it("emits the exact header, one row per order, CRLF line endings", () => {
    const o = createOrder(planId, req());
    const csv = ordersToCsv([o]);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("id,customerName,productName,quantity,unitPriceSen,subtotalSen,fulfilmentOption,status,createdAt");
    expect(lines[1]).toBe(`${o.id},Aina,Choc Chip Cookie,3,500,1500,COLLECTION,PENDING,${o.createdAt}`);
  });
  it("quotes commas, quotes and newlines (RFC 4180)", () => {
    const o = createOrder(planId, req({ customerName: 'Ali, "the" Great\nJr' }));
    expect(ordersToCsv([o])).toContain('"Ali, ""the"" Great\nJr"');
  });
  it("neutralises spreadsheet formula injection", () => {
    for (const evil of ["=1+1", "+SUM(A1)", "-2+3", "@cmd"]) {
      const o = createOrder(planId, req({ customerName: evil }));
      expect(ordersToCsv([o])).toContain(`,'${evil},`);
    }
  });
  it("returns header only for no orders", () => {
    expect(ordersToCsv([])).toBe("id,customerName,productName,quantity,unitPriceSen,subtotalSen,fulfilmentOption,status,createdAt");
  });
});

describe("orders routes", () => {
  it("POST creates (201) and GET lists with summary", async () => {
    const res = await createRoute(json("/api/orders", "POST", { planId, ...req() }));
    expect(res.status).toBe(201);
    const order = await res.json();
    expect(order.subtotalSen).toBe(1500);
    const list = await (await listRoute(json("/api/orders", "GET"))).json();
    expect(list.orders).toHaveLength(1);
    expect(list.summary.totalOrders).toBe(1);
  });
  it("POST returns 400 for invalid body, 404 for unknown plan, 422 for unknown product", async () => {
    expect((await createRoute(json("/api/orders", "POST", { planId, ...req({ quantity: 0 }) }))).status).toBe(400);
    expect((await createRoute(json("/api/orders", "POST", { ...req() }))).status).toBe(400); // no planId
    expect((await createRoute(json("/api/orders", "POST", { planId: "nope", ...req() }))).status).toBe(404);
    expect((await createRoute(json("/api/orders", "POST", { planId, ...req({ productName: "Pizza" }) }))).status).toBe(422);
    const notJson = new Request("http://x/api/orders", { method: "POST", body: "{{" });
    expect((await createRoute(notJson)).status).toBe(400);
  });
  it("GET filters by ?status and rejects an invalid status with 400", async () => {
    const a = createOrder(planId, req());
    updateOrderStatus(a.id, "CONFIRMED");
    createOrder(planId, req());
    const only = await (await listRoute(json("/api/orders?status=CONFIRMED", "GET"))).json();
    expect(only.orders).toHaveLength(1);
    expect((await listRoute(json("/api/orders?status=BOGUS", "GET"))).status).toBe(400);
  });
  it("GET ?format=csv returns text/csv with an attachment filename", async () => {
    createOrder(planId, req());
    const res = await listRoute(json("/api/orders?format=csv", "GET"));
    expect(res.headers.get("content-type")).toMatch(/^text\/csv/);
    expect(res.headers.get("content-disposition")).toMatch(/attachment; filename="orders.*\.csv"/);
    expect((await res.text()).split("\r\n")[0]).toMatch(/^id,customerName/);
  });
  it("PATCH updates status (200), 400 bad body, 404 missing, 409 invalid transition", async () => {
    const o = createOrder(planId, req());
    const ok = await patchRoute(json(`/api/orders/${o.id}`, "PATCH", { status: "CONFIRMED" }), ctx(o.id));
    expect(ok.status).toBe(200);
    expect((await ok.json()).status).toBe("CONFIRMED");
    expect((await patchRoute(json(`/api/orders/${o.id}`, "PATCH", { status: "NOPE" }), ctx(o.id))).status).toBe(400);
    expect((await patchRoute(json(`/api/orders/missing`, "PATCH", { status: "CONFIRMED" }), ctx("missing"))).status).toBe(404);
    expect((await patchRoute(json(`/api/orders/${o.id}`, "PATCH", { status: "COMPLETED" }), ctx(o.id))).status).toBe(409);
  });
});
