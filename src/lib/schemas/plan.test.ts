import { describe, expect, it } from "vitest";
import { BusinessPlan, CreateOrderRequest, ORDER_TRANSITIONS, OrderStatus } from "./plan";
import { samplePlan } from "./sample";

describe("plan contract", () => {
  it("sample plan satisfies the BusinessPlan schema", () => {
    expect(BusinessPlan.safeParse(samplePlan).success).toBe(true);
  });
  it("rejects client-supplied prices or non-positive quantities on orders", () => {
    const base = { customerName: "A", productName: "Cookie", fulfilmentOption: "COLLECTION" as const };
    expect(CreateOrderRequest.safeParse({ ...base, quantity: 0 }).success).toBe(false);
    expect(CreateOrderRequest.safeParse({ ...base, quantity: 2 }).success).toBe(true);
    const parsed = CreateOrderRequest.parse({ ...base, quantity: 2, subtotalSen: 1 });
    expect("subtotalSen" in parsed).toBe(false);
  });
  it("terminal order states have no transitions", () => {
    expect(ORDER_TRANSITIONS.COMPLETED).toEqual([]);
    expect(Object.keys(ORDER_TRANSITIONS).sort()).toEqual([...OrderStatus.options].sort());
  });
});
