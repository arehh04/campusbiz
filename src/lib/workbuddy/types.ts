import type { z } from "zod";

/** Execution states kept distinct per the spec: never report COMPLETED unless confirmed. */
export type ExecutionStatus = "RUNNING" | "COMPLETED" | "FAILED" | "UNAVAILABLE";

export interface StructuredRequest<T extends z.ZodType> {
  /** Stable key; a second call with the same key while one is in flight shares the run. */
  runKey: string;
  systemPrompt: string;
  prompt: string;
  schema: T;
}

export type ExecutionResult<T> =
  | { status: "COMPLETED"; data: T; externalSessionId: string | null; durationMs: number }
  | { status: "FAILED"; error: string; externalSessionId: string | null; durationMs: number }
  | { status: "UNAVAILABLE"; error: string };
