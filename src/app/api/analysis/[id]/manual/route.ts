import { NextResponse } from "next/server";
import { z } from "zod";
import { buildManualPromptPack, importManualResult } from "@/lib/agents/manual";
import { getPlan } from "@/lib/db/plans";

const ManualImportRequest = z.object({
  role: z.enum(["orchestrator", "demand", "growth", "operations"]),
  result: z.unknown(),
});

/** Prompts the user can run by hand in the WorkBuddy desktop app. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const prompts = buildManualPromptPack(id);
  if (!prompts) return NextResponse.json({ error: "Analysis not found" }, { status: 404 });
  return NextResponse.json({ prompts });
}

/** Pastes one role's manual WorkBuddy result back into the plan. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!getPlan(id)) return NextResponse.json({ error: "Analysis not found" }, { status: 404 });

  const body = ManualImportRequest.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const result = importManualResult(id, body.data.role, body.data.result);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, plan: getPlan(id) });
}
