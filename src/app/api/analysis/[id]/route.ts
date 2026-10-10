import { NextResponse } from "next/server";
import { getPlan } from "@/lib/db/plans";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const plan = getPlan(id);
  if (!plan) return NextResponse.json({ error: "Analysis not found" }, { status: 404 });
  return NextResponse.json(plan);
}
