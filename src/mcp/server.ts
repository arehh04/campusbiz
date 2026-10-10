import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createCampusbizServer } from "./tools";

async function main() {
  const server = createCampusbizServer();
  await server.connect(new StdioServerTransport());
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  process.stderr.write(`campusbiz MCP server failed: ${message}\n`);
  process.exit(1);
});
