import { describe, expect, it } from "vitest";
import { parseCliOutput, redact } from "./adapter";

describe("parseCliOutput", () => {
  it("finds the result item in the CLI array", () => {
    const out = JSON.stringify([
      { type: "message", role: "user" },
      { type: "result", is_error: false, structured_output: { a: 1 }, session_id: "s1" },
    ]);
    expect(parseCliOutput(out)?.structured_output).toEqual({ a: 1 });
  });
  it("returns null for non-JSON or missing result", () => {
    expect(parseCliOutput("Authentication required")).toBeNull();
    expect(parseCliOutput("[]")).toBeNull();
  });
});

describe("redact", () => {
  it("hides bearer tokens and api keys", () => {
    expect(redact("Authorization: Bearer abc.def-123")).not.toContain("abc.def");
    expect(redact("CODEBUDDY_API_KEY=sk-secret")).not.toContain("sk-secret");
  });
});
