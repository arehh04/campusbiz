import { describe, expect, it } from "vitest";
import { z } from "zod";
import { submitStructured } from "./adapter";

// Real round trip to WorkBuddy. Opt-in: RUN_WORKBUDDY_SMOKE=1 npm test
describe.skipIf(!process.env.RUN_WORKBUDDY_SMOKE)("WorkBuddy live smoke test", () => {
  it("returns schema-validated structured output", async () => {
    const r = await submitStructured({
      runKey: "smoke",
      systemPrompt: "You are the CampusBiz Orchestrator. Answer only with the requested structured data.",
      prompt: "Extract: I want to sell homemade cookies on campus with RM300 capital.",
      schema: z.object({ businessType: z.string(), startingCapital: z.number() }),
    });
    console.log(JSON.stringify(r));
    expect(r.status).toBe("COMPLETED");
    if (r.status === "COMPLETED") expect(r.data.startingCapital).toBe(300);
  }, 130000);
});
