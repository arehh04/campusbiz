import { NextResponse } from "next/server";
import { z } from "zod";
import { OrderError, updateOrderStatus } from "@/lib/db/orders";
import { OrderStatus } from "@/lib/schemas/plan";

const PatchBody = z.object({ status: OrderStatus });

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = PatchBody.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  try {
    return NextResponse.json(updateOrderStatus(id, body.data.status));
  } catch (e) {
    if (e instanceof OrderError) {
      if (e.code === "ORDER_NOT_FOUND") return NextResponse.json({ error: "Order not found" }, { status: 404 });
      if (e.code === "INVALID_TRANSITION") return NextResponse.json({ error: "Invalid status transition" }, { status: 409 });
    }
    throw e;
  }
}
