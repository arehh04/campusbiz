import { NextResponse } from "next/server";
import { runAnalysis } from "@/lib/agents/analyze";
import { createPlan, updatePlan } from "@/lib/db/plans";
import { AnalyzeRequest } from "@/lib/schemas/plan";
import { checkConfiguration } from "@/lib/workbuddy/config";

/** Starts an analysis and returns immediately; the client polls GET /api/analysis/:id. */
export async function POST(req: Request) {
  const body = AnalyzeRequest.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Invalid request", issues: body.error.issues }, { status: 400 });
  }
  const { goalText, inputs = {} } = body.data;

  const id = createPlan(goalText, inputs);
  const config = checkConfiguration();
  // Run in the background; the setup problem is surfaced truthfully via the run records, not hidden.
  void runAnalysis(id, goalText, inputs).catch((e) => {
    console.error("analysis crashed", id, e instanceof Error ? e.message : "unknown");
    updatePlan(id, { analysisStatus: "FAILED" });
  });
  return NextResponse.json({ id, status: "QUEUED", workbuddyConfigured: config.ok }, { status: 202 });
}
