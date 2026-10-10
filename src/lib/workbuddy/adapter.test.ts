import { describe, expect, it } from "vitest";
import { cleanSchema, parseCliOutput, redact, unwrapData } from "./adapter";

describe("unwrapData", () => {
  it("unwraps only an exact single data key", () => {
    expect(unwrapData({ data: { a: 1 } })).toEqual({ a: 1 });
    expect(unwrapData({ data: 1, other: 2 })).toEqual({ data: 1, other: 2 });
    expect(unwrapData([1])).toEqual([1]);
  });
});

describe("cleanSchema", () => {
  it("drops $schema, pattern, format and the max-safe-integer bound recursively", () => {
    const out = cleanSchema({
      $schema: "x",
      properties: { d: { type: "string", format: "date", pattern: "^a$" }, n: { type: "integer", maximum: Number.MAX_SAFE_INTEGER, minimum: 0 } },
    });
    expect(out).toEqual({ properties: { d: { type: "string" }, n: { type: "integer", minimum: 0 } } });
  });
});

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
