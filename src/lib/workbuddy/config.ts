import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface WorkBuddyConfig {
  /** Executable + leading args used to launch the CodeBuddy CLI. */
  command: string;
  baseArgs: string[];
  timeoutMs: number;
  /** Scratch dir so the CLI never loads project memory or touches the repo. */
  workDir: string;
}

export type ConfigCheck =
  | { ok: true; config: WorkBuddyConfig }
  | { ok: false; reason: string };

function findCliEntry(): string | null {
  const explicit = process.env.WORKBUDDY_CLI_ENTRY;
  if (explicit) return fs.existsSync(explicit) ? explicit : null;
  const candidates = [
    process.env.APPDATA &&
      path.join(process.env.APPDATA, "npm", "node_modules", "@tencent-ai", "codebuddy-code", "bin", "codebuddy"),
    "/usr/local/lib/node_modules/@tencent-ai/codebuddy-code/bin/codebuddy",
    "/usr/lib/node_modules/@tencent-ai/codebuddy-code/bin/codebuddy",
  ].filter((p): p is string => Boolean(p));
  return candidates.find((p) => fs.existsSync(p)) ?? null;
}

export function checkConfiguration(): ConfigCheck {
  const entry = findCliEntry();
  if (!entry) {
    return {
      ok: false,
      reason:
        "CodeBuddy CLI not found. Run `npm install -g @tencent-ai/codebuddy-code`, sign in with `codebuddy` then `/login`, " +
        "or set WORKBUDDY_CLI_ENTRY to the bin/codebuddy path of that package.",
    };
  }
  const timeoutMs = Number(process.env.WORKBUDDY_TIMEOUT_MS ?? 240000); // a growth-kit call measured ~110 s
  const workDir = path.join(os.tmpdir(), "campusbiz-workbuddy");
  fs.mkdirSync(workDir, { recursive: true });
  return {
    ok: true,
    config: {
      command: process.execPath,
      baseArgs: [entry],
      timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 240000,
      workDir,
    },
  };
}
