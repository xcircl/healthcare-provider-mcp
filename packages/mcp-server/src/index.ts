#!/usr/bin/env node
/**
 * xcircl MCP server (stdio) — bin entry point.
 *
 * Wires a production XcirclClient into the tool server and speaks stdio.
 * XCIRCL_API_KEY is required; free keys return identity fields and eligible
 * plans unlock compliance and price. Tool wiring lives in ./server.ts.
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { XcirclClient } from '@xcircl/sdk';
import { createServer } from './server.js';

async function main(): Promise<void> {
  const apiKey = process.env.XCIRCL_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      'XCIRCL_API_KEY is required. Create a free key at https://xcircl.com/developers/signup/.',
    );
  }
  const client = new XcirclClient({
    apiKey,
    baseUrl: process.env.XCIRCL_API_URL, // undefined → production default
  });
  const server = createServer(client);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('xcircl MCP server running (stdio) — authenticated');
}

main().catch((err) => {
  console.error('xcircl MCP server failed to start:', err);
  process.exit(1);
});
