import { beforeEach, describe, expect, it } from "vitest";
import { getDb, resetDbForTests } from "./index";
import { createPlan, updatePlan } from "./plans";
import { OrderError, createOrder, getOrder, listOrders, orderSummary, ordersToCsv, updateOrderStatus } from "./orders";
import type { CreateOrderRequest, GrowthOutput, OrderStatus } from "../schemas/plan";

beforeEach(() => {
  process.env.DATABASE_PATH = ":memory:";
  resetDbForTests();
});

const growth = (products: { name: string; priceSen: number }[]): GrowthOutput => ({
  positioning: "p",
  valueProposition: "v",
  targetAudience: "t",
  products: products.map((p) => ({ ...p, description: "d" })),
  landingPage: {
    businessName: "B",
    headline: "h",
    subheadline: "s",
    callToAction: "c",
    orderingInstructions: "o",
    sections: [],
  },
  socialCaptions: ["a", "b", "c"],
  launchAnnouncement: "l",
  promotionalOffer: "o",
  sevenDayCalendar: [1, 2, 3, 4, 5, 6, 7].map((day) => ({ day, activity: `day ${day}` })),
});

const planWithCatalogue = (products: { name: string; priceSen: number }[] = [
  { name: "Cookie", priceSen: 500 },
  { name: "Tea", priceSen: 300 },
]) => {
  const id = createPlan("sell cookies", {});
  updatePlan(id, { growth: growth(products) });
  return id;
};

const req = (overrides: Partial<CreateOrderRequest> = {}): CreateOrderRequest => ({
  customerName: "Ana",
  productName: "Cookie",
  quantity: 2,
  fulfilmentOption: "COLLECTION",
  ...overrides,
});

describe("createOrder", () => {
  it("takes the price from the plan's catalogue and computes the subtotal", () => {
    const order = createOrder(planWithCatalogue(), req({ quantity: 3 }));
    expect(order).toMatchObject({ productName: "Cookie", quantity: 3, unitPriceSen: 500, subtotalSen: 1500, status: "PENDING" });
    expect(order.id).toHaveLength(36);
    expect(order.createdAt).toBe(order.updatedAt);
  });

  it("ignores client-supplied price and subtotal fields", () => {
    const planId = planWithCatalogue();
    const tampered = { ...req({ quantity: 2 }), unitPriceSen: 1, subtotalSen: 2 } as unknown as CreateOrderRequest;
    const order = createOrder(planId, tampered);
    expect(order.unitPriceSen).toBe(500);
    expect(order.subtotalSen).toBe(1000);
  });

  it("matches the product case-insensitively after trimming and stores the canonical name", () => {
    const order = createOrder(planWithCatalogue([{ name: "Iced Tea", priceSen: 300 }]), req({ productName: "  iCED tEA " }));
    expect(order.productName).toBe("Iced Tea");
    expect(order.unitPriceSen).toBe(300);
  });

  it("throws PLAN_NOT_FOUND for an unknown plan", () => {
    expect(() => createOrder("nope", req())).toThrow(OrderError);
    try {
      createOrder("nope", req());
    } catch (e) {
      expect((e as OrderError).code).toBe("PLAN_NOT_FOUND");
    }
  });

  it("throws UNKNOWN_PRODUCT when the name is not in the catalogue or the plan has no growth output", () => {
    const planId = planWithCatalogue();
    expect(() => createOrder(planId, req({ productName: "Cake" }))).toThrow(/UNKNOWN_PRODUCT/);
    const barePlanId = createPlan("no growth yet", {});
    expect(() => createOrder(barePlanId, req())).toThrow(/UNKNOWN_PRODUCT/);
  });
});

describe("getOrder", () => {
  it("round-trips an order and returns null for an unknown id", () => {
    const order = createOrder(planWithCatalogue(), req({ customerContact: "012", notes: "no sugar", fulfilmentOption: "DELIVERY" }));
    expect(getOrder(order.id)).toEqual(order);
    expect(getOrder("missing")).toBeNull();
  });
});

describe("listOrders", () => {
  it("returns newest first", () => {
    const planId = planWithCatalogue();
    const first = createOrder(planId, req({ customerName: "A" }));
    const second = createOrder(planId, req({ customerName: "B" }));
    expect(listOrders().map((o) => o.id)).toEqual([second.id, first.id]);
  });

  it("filters by status", () => {
    const planId = planWithCatalogue();
    const pending = createOrder(planId, req({ customerName: "A" }));
    const confirmed = updateOrderStatus(createOrder(planId, req({ customerName: "B" })).id, "CONFIRMED");
    expect(listOrders({ status: "CONFIRMED" }).map((o) => o.id)).toEqual([confirmed.id]);
    expect(listOrders({ status: "CANCELLED" })).toEqual([]);
    expect(listOrders()).toHaveLength(2);
    expect(listOrders().map((o) => o.id)).toContain(pending.id);
  });

  it("stores injection-looking text verbatim", () => {
    const evil = "'); DROP TABLE orders; --";
    const order = createOrder(planWithCatalogue(), req({ customerName: evil }));
    expect(getOrder(order.id)!.customerName).toBe(evil);
  });
});

describe("updateOrderStatus", () => {
  it("follows the allowed transitions", () => {
    const planId = planWithCatalogue();
    let order = createOrder(planId, req());
    for (const status of ["CONFIRMED", "PREPARING", "READY", "COMPLETED"] as OrderStatus[]) {
      order = updateOrderStatus(order.id, status);
      expect(order.status).toBe(status);
    }
    expect(getOrder(order.id)!.status).toBe("COMPLETED");
  });

  it("allows cancellation from a non-terminal status", () => {
    const planId = planWithCatalogue();
    const order = updateOrderStatus(createOrder(planId, req()).id, "CONFIRMED");
    expect(updateOrderStatus(order.id, "CANCELLED").status).toBe("CANCELLED");
  });

  it("sets updatedAt", () => {
    const order = createOrder(planWithCatalogue(), req());
    getDb().prepare("UPDATE orders SET updated_at = ? WHERE id = ?").run("2020-01-01T00:00:00.000Z", order.id);
    expect(updateOrderStatus(order.id, "CONFIRMED").updatedAt).not.toBe("2020-01-01T00:00:00.000Z");
  });

  it("throws ORDER_NOT_FOUND for an unknown id", () => {
    try {
      updateOrderStatus("missing", "CONFIRMED");
      expect.unreachable();
    } catch (e) {
      expect((e as OrderError).code).toBe("ORDER_NOT_FOUND");
    }
  });

  it("throws INVALID_TRANSITION for a disallowed move", () => {
    const planId = planWithCatalogue();
    const pending = createOrder(planId, req());
    expect(() => updateOrderStatus(pending.id, "READY")).toThrow(/INVALID_TRANSITION/);
    let id = pending.id;
    for (const status of ["CONFIRMED", "PREPARING", "READY", "COMPLETED"] as OrderStatus[]) {
      id = updateOrderStatus(id, status).id;
    }
    expect(() => updateOrderStatus(id, "PENDING")).toThrow(/INVALID_TRANSITION/);
    // A rejected move leaves the order untouched.
    expect(getOrder(pending.id)!.status).toBe("COMPLETED");
  });
});

describe("orderSummary", () => {
  it("is empty but complete with no orders", () => {
    expect(orderSummary()).toEqual({
      totalOrders: 0,
      byStatus: { PENDING: 0, CONFIRMED: 0, PREPARING: 0, READY: 0, COMPLETED: 0, CANCELLED: 0 },
      revenueSen: 0,
    });
  });

  it("counts by status and excludes cancelled orders from revenue", () => {
    const planId = planWithCatalogue();
    const a = createOrder(planId, req({ quantity: 2 })); // 1000, stays PENDING
    const b = createOrder(planId, req({ quantity: 1, productName: "Tea" })); // 300
    updateOrderStatus(b.id, "CONFIRMED");
    const c = createOrder(planId, req({ quantity: 4, productName: "Tea" })); // 1200
    updateOrderStatus(c.id, "CANCELLED");
    expect(a.subtotalSen).toBe(1000);
    expect(orderSummary()).toEqual({
      totalOrders: 3,
      byStatus: { PENDING: 1, CONFIRMED: 1, PREPARING: 0, READY: 0, COMPLETED: 0, CANCELLED: 1 },
      revenueSen: 1300,
    });
  });
});

describe("ordersToCsv", () => {
  const row = (csv: string) => csv.split("\r\n")[1];

  it("writes the header and one row per order with no trailing newline", () => {
    const order = createOrder(planWithCatalogue(), req());
    const csv = ordersToCsv([order]);
    expect(csv.split("\r\n")[0]).toBe(
      "id,customerName,productName,quantity,unitPriceSen,subtotalSen,fulfilmentOption,status,createdAt",
    );
    expect(row(csv)).toBe(`${order.id},Ana,Cookie,2,500,1000,COLLECTION,PENDING,${order.createdAt}`);
    expect(ordersToCsv([order, order]).split("\r\n")).toHaveLength(3);
    expect(csv.endsWith("\n")).toBe(false);
  });

  it("quotes fields containing a comma, quote, CR or LF", () => {
    const planId = planWithCatalogue([{ name: 'Hot "Tea"', priceSen: 300 }]);
    const comma = ordersToCsv([createOrder(planId, req({ customerName: "Ana, Lim", productName: 'Hot "Tea"' }))]);
    expect(row(comma)).toContain(`"Ana, Lim"`);
    expect(row(comma)).toContain(`"Hot ""Tea"""`);

    const newline = ordersToCsv([createOrder(planId, req({ customerName: "Ana\nLim", productName: 'Hot "Tea"' }))]);
    expect(row(newline)).toContain(`"Ana\nLim"`);

    const cr = ordersToCsv([createOrder(planId, req({ customerName: "Ana\rLim", productName: 'Hot "Tea"' }))]);
    expect(cr).toContain(`"Ana\rLim"`);
  });

  it("prefixes fields that start with a tab or carriage return", () => {
    const planId = planWithCatalogue([{ name: "Cookie", priceSen: 100 }]);
    expect(ordersToCsv([createOrder(planId, req({ customerName: "\t=1+1" }))])).toContain(`'\t=1+1`);
    expect(ordersToCsv([createOrder(planId, req({ customerName: "\r=1+1" }))])).toContain(`"'\r=1+1"`);
  });

  it("prefixes text that a spreadsheet would treat as a formula", () => {
    const planId = planWithCatalogue([{ name: "=1+1", priceSen: 100 }]);
    const order = createOrder(planId, req({ productName: "=1+1", customerName: '=A,b "x"' }));
    expect(row(ordersToCsv([order]))).toContain(`"'=A,b ""x"""`);
    expect(row(ordersToCsv([order]))).toContain("'=1+1");
  });
});
