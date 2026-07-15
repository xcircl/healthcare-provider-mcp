#!/usr/bin/env node
/**
 * xcircl MCP server (stdio) — bin entry point.
 *
 * Wires a production XcirclClient into the tool server and speaks stdio.
 * Set XCIRCL_API_KEY to unlock paid fields (cash price, compliance signals,
 * timestamps). The tool wiring lives in ./server.ts (imported by tests).
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { XcirclClient } from '@xcircl/sdk';
import { createServer } from './server.js';

async function main(): Promise<void> {
  const client = new XcirclClient({
    apiKey: process.env.XCIRCL_API_KEY,
    baseUrl: process.env.XCIRCL_API_URL, // undefined → production default
  });
  const server = createServer(client);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `xcircl MCP server running (stdio) — tier: ${process.env.XCIRCL_API_KEY ? 'keyed' : 'free'}`,
  );
}

main().catch((err) => {
  console.error('xcircl MCP server failed to start:', err);
  process.exit(1);
});
