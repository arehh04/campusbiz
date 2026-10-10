import { NextResponse } from "next/server";
import { z } from "zod";
import { OrderError, createOrder, listOrders, orderSummary, ordersToCsv } from "@/lib/db/orders";
import { CreateOrderRequest, OrderStatus } from "@/lib/schemas/plan";

const CreateOrderBody = CreateOrderRequest.extend({ planId: z.string().min(1) });

export async function POST(req: Request) {
  const body = CreateOrderBody.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { planId, ...request } = body.data;
  try {
    return NextResponse.json(createOrder(planId, request), { status: 201 });
  } catch (e) {
    if (e instanceof OrderError) {
      if (e.code === "PLAN_NOT_FOUND") return NextResponse.json({ error: "Plan not found" }, { status: 404 });
      if (e.code === "UNKNOWN_PRODUCT") return NextResponse.json({ error: "Unknown product" }, { status: 422 });
    }
    throw e;
  }
}

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const statusParam = params.get("status");
  let filter: { status?: OrderStatus } = {};
  if (statusParam !== null) {
    const status = OrderStatus.safeParse(statusParam);
    if (!status.success) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    filter = { status: status.data };
  }

  const orders = listOrders(filter);
  if (params.get("format") === "csv") {
    return new NextResponse(ordersToCsv(orders), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": 'attachment; filename="orders.csv"',
      },
    });
  }
  return NextResponse.json({ orders, summary: orderSummary() });
}
