#!/usr/bin/env node
/**
 * xcircl MCP server (stdio).
 *
 * Exposes xcircl's regulated-care provider data as three tools:
 *   search_providers / get_provider / check_compliance
 *
 * All calls go to the production API (https://xcircl.com/api/v1) — this
 * server holds no data and no field-tiering logic. Set XCIRCL_API_KEY to
 * unlock paid fields (cash price, compliance signals, timestamps); without
 * it every tool still works on the free tier and says what a key would add.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { XcirclClient, XcirclApiError, UPGRADE_HINT } from '@xcircl/sdk';

const client = new XcirclClient({
  apiKey: process.env.XCIRCL_API_KEY,
  baseUrl: process.env.XCIRCL_API_URL, // undefined → production default
});

const server = new McpServer({
  name: 'xcircl-mcp-server',
  version: '0.1.0',
});

const VERTICALS = ['glp1', 'pet_health', 'medspa', 'ivf', 'dental', 'senior'] as const;
const MODES = ['online', 'physical', 'both'] as const;

/** Wrap a tool handler: JSON text + structuredContent, API errors → readable message. */
function toolResult(payload: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload as Record<string, unknown>,
  };
}

function toolError(err: unknown) {
  let text: string;
  if (err instanceof XcirclApiError) {
    text =
      err.status === 404
        ? 'Error: provider not found. Pass an entity_id (e.g. "ent_…") or slug exactly as returned by search_providers.'
        : err.status === 429
          ? 'Error: rate limit exceeded. Free tier allows limited requests — get a key at https://xcircl.com/developers/ or retry later.'
          : `Error: xcircl API request failed (${err.status || 'network'}): ${err.message}`;
  } else {
    text = `Error: ${err instanceof Error ? err.message : String(err)}`;
  }
  return { content: [{ type: 'text' as const, text }], isError: true };
}

server.registerTool(
  'search_providers',
  {
    title: 'Search regulated-care providers',
    description: `Search verified U.S. regulated-care providers (currently the GLP-1 / weight-management vertical is live) by vertical, city, state and business mode.

Free tier (no key): identity fields per provider — entity_id, slug, vertical, name, city, state, business_mode, latitude, longitude, npi — plus a notice describing paid fields.
With XCIRCL_API_KEY: adds legitscript / license / fda compliance signals and cash price, each with source + verification timestamp.

Returns JSON: { tier, publish_boundary, notice?, pagination: { total, limit, offset, returned }, filters, data: Provider[] }.

Examples:
  - "GLP-1 clinics in Austin" → { vertical: "glp1", city: "Austin", state: "TX" }
  - "online GLP-1 providers" → { vertical: "glp1", business_mode: "online" }
Use get_provider for one record, check_compliance for compliance signals only.`,
    inputSchema: {
      vertical: z
        .enum(VERTICALS)
        .optional()
        .describe('Care vertical. "glp1" is live today; others are planned.'),
      city: z.string().min(1).max(100).optional().describe('City name, e.g. "Austin". Case-insensitive.'),
      state: z
        .string()
        .length(2)
        .optional()
        .describe('Two-letter US state code, e.g. "TX".'),
      business_mode: z
        .enum(MODES)
        .optional()
        .describe('How the provider operates: online, physical, or both.'),
      limit: z.number().int().min(1).max(100).default(20).describe('Max results (1–100, default 20).'),
      offset: z.number().int().min(0).default(0).describe('Pagination offset.'),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async (params) => {
    try {
      const res = await client.searchProviders(params);
      if (res.data.length === 0) {
        return toolResult({
          ...res,
          hint: 'No providers matched. Try dropping the city filter or check the state code — coverage spans all 51 US states/DC.',
        });
      }
      return toolResult(res);
    } catch (err) {
      return toolError(err);
    }
  },
);

server.registerTool(
  'get_provider',
  {
    title: 'Get one provider record',
    description: `Fetch a single provider by entity_id (e.g. "ent_f47550b79f755d70b58b183a") or slug (e.g. "alegro-health-mckinney-tx").

Free tier: identity fields + notice. With XCIRCL_API_KEY: full record including legitscript / license / fda signals and price, each source-linked and timestamped.

Returns JSON: { tier, publish_boundary, notice?, data: Provider }. Errors with a clear message if the id is unknown.`,
    inputSchema: {
      id: z
        .string()
        .min(1)
        .max(200)
        .describe('Provider entity_id ("ent_…") or slug, as returned by search_providers.'),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async ({ id }) => {
    try {
      return toolResult(await client.getProvider(id));
    } catch (err) {
      return toolError(err);
    }
  },
);

server.registerTool(
  'check_compliance',
  {
    title: 'Check provider compliance signals',
    description: `Compliance signals for one provider: LegitScript certification, state-license record, FDA warning-letter screen — each with status, source and verification timestamp.

These are PAID fields. Without XCIRCL_API_KEY the tool still answers (provider identity + compliance: null) and explains how to unlock: "${UPGRADE_HINT}".

Signal statuses: verified (source+date held) | clear (negative screen run) | flagged (adverse finding) | reported (self-reported) | unverified | not_screened.

Returns JSON: { entity_id, slug, name, tier, compliance: { legitscript, license, fda } | null, notice? }.`,
    inputSchema: {
      id: z
        .string()
        .min(1)
        .max(200)
        .describe('Provider entity_id ("ent_…") or slug, as returned by search_providers.'),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  async ({ id }) => {
    try {
      return toolResult(await client.checkCompliance(id));
    } catch (err) {
      return toolError(err);
    }
  },
);

async function main(): Promise<void> {
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
