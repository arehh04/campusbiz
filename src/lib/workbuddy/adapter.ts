import { spawn } from "node:child_process";
import { z } from "zod";
import { checkConfiguration, type WorkBuddyConfig } from "./config";
import type { ExecutionResult, StructuredRequest } from "./types";

const AUTH_MARKER = "Authentication required";
const inFlight = new Map<string, Promise<ExecutionResult<unknown>>>();

/** Redact anything key-like before an error string is stored or shown. */
export function redact(text: string): string {
  return text
    .replace(/(Bearer\s+)[A-Za-z0-9._-]+/gi, "$1[REDACTED]")
    .replace(/(CODEBUDDY_API_KEY=)\S+/g, "$1[REDACTED]")
    .slice(0, 500);
}

interface CliResultItem {
  type: "result";
  is_error?: boolean;
  result?: string;
  structured_output?: unknown;
  session_id?: string;
  duration_ms?: number;
}

/** Pull the final result item out of the CLI's JSON-array output. */
export function parseCliOutput(stdout: string): CliResultItem | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return null;
  }
  const items = Array.isArray(parsed) ? parsed : [parsed];
  const found = items.find(
    (m): m is CliResultItem => typeof m === "object" && m !== null && (m as { type?: unknown }).type === "result",
  );
  return found ?? null;
}

/** The CLI sometimes wraps structured output as {"data": {...}}; unwrap only that exact shape. */
export function unwrapData(v: unknown): unknown {
  if (typeof v === "object" && v !== null && !Array.isArray(v)) {
    const keys = Object.keys(v);
    if (keys.length === 1 && keys[0] === "data") return (v as { data: unknown }).data;
  }
  return v;
}

/** Drop JSON Schema noise the CLI mishandles ($schema) or that only bloats the prompt (regex, huge bounds, formats). */
export function cleanSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(cleanSchema);
  if (typeof node !== "object" || node === null) return node;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node)) {
    if (k === "$schema" || k === "pattern" || k === "format" || (k === "maximum" && v === Number.MAX_SAFE_INTEGER)) continue;
    out[k] = cleanSchema(v);
  }
  return out;
}

function runCli(config: WorkBuddyConfig, args: string[]): Promise<{ stdout: string; stderr: string; timedOut: boolean }> {
  return new Promise((resolve, reject) => {
    const child = spawn(config.command, [...config.baseArgs, ...args], {
      cwd: config.workDir,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, config.timeoutMs);
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", () => {
      clearTimeout(timer);
      resolve({ stdout, stderr, timedOut });
    });
  });
}

async function execute<T extends z.ZodType>(req: StructuredRequest<T>): Promise<ExecutionResult<z.infer<T>>> {
  const cfg = checkConfiguration();
  if (!cfg.ok) return { status: "UNAVAILABLE", error: cfg.reason };

  const started = Date.now();
  const jsonSchema = JSON.stringify(cleanSchema(z.toJSONSchema(req.schema)));
  const args = [
    "-p",
    req.prompt,
    "--system-prompt",
    // --json-schema alone is not reliably obeyed for large schemas, so state the shape in the prompt too.
    `${req.systemPrompt}\n\nReturn a JSON object with exactly the top-level keys and shape of this JSON Schema, with no wrapper object:\n${jsonSchema}`,
    "--json-schema",
    jsonSchema,
    // The CLI needs this tool to emit schema-validated output; no file or shell tools are enabled.
    "--tools",
    "StructuredOutput",
    "--output-format",
    "json",
    "--no-session-persistence",
    "--max-turns",
    "4",
  ];

  let out;
  try {
    out = await runCli(cfg.config, args);
  } catch (e) {
    return { status: "UNAVAILABLE", error: redact(`Could not start CodeBuddy CLI: ${(e as Error).message}`) };
  }
  const durationMs = Date.now() - started;

  if (out.timedOut) {
    return {
      status: "FAILED",
      error: `WorkBuddy did not finish within ${cfg.config.timeoutMs} ms.`,
      externalSessionId: null,
      durationMs,
    };
  }
  const combined = `${out.stdout}\n${out.stderr}`;
  if (combined.includes(AUTH_MARKER)) {
    return { status: "UNAVAILABLE", error: "CodeBuddy CLI is not signed in. Run `codebuddy`, then `/login`." };
  }

  const item = parseCliOutput(out.stdout);
  if (!item) {
    return { status: "FAILED", error: redact(`Unreadable CLI output: ${combined.trim()}`), externalSessionId: null, durationMs };
  }
  const sessionId = item.session_id ?? null;
  if (item.is_error) {
    return { status: "FAILED", error: redact(item.result ?? "WorkBuddy reported an error."), externalSessionId: sessionId, durationMs };
  }
  const checked = req.schema.safeParse(unwrapData(item.structured_output));
  if (!checked.success) {
    return {
      status: "FAILED",
      error: `WorkBuddy output failed validation: ${redact(z.prettifyError(checked.error))}`,
      externalSessionId: sessionId,
      durationMs,
    };
  }
  return { status: "COMPLETED", data: checked.data, externalSessionId: sessionId, durationMs };
}

/**
 * Submit one structured task to WorkBuddy. Output is untrusted and zod-validated.
 * Concurrent calls with the same runKey share one execution (no duplicate submissions).
 */
export function submitStructured<T extends z.ZodType>(req: StructuredRequest<T>): Promise<ExecutionResult<z.infer<T>>> {
  const existing = inFlight.get(req.runKey);
  if (existing) return existing as Promise<ExecutionResult<z.infer<T>>>;
  const p = execute(req).finally(() => inFlight.delete(req.runKey));
  inFlight.set(req.runKey, p);
  return p;
}
