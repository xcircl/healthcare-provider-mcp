/**
 * xcircl MCP server — tool wiring.
 *
 * Exposes xcircl's regulated-care provider data as three tools:
 *   search_providers / get_provider / check_compliance
 *
 * All calls go to the production API (https://xcircl.com/api/v1) — this
 * server holds no data and no field-tiering logic. `createServer` takes the
 * data source as an argument so tests can inject a fake without a network.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { XcirclApiError, UPGRADE_HINT, type XcirclClient } from '@xcircl/sdk';

/** The three data methods the tools depend on — lets tests inject a fake. */
export type ProviderSource = Pick<
  XcirclClient,
  'searchProviders' | 'getProvider' | 'checkCompliance'
>;

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
    if (err.status === 404) {
      text =
        'Error: provider not found. Pass an entity_id (e.g. "ent_…") or slug exactly as returned by search_providers.';
    } else {
      // 403 (vertical binding), 429 (quota) and anything else: relay the
      // server's error and upgrade text verbatim — no client-side rewording.
      text = `Error (${err.status || 'network'}): ${err.message}${err.upgrade ? ` ${err.upgrade}` : ''}`;
    }
  } else {
    text = `Error: ${err instanceof Error ? err.message : String(err)}`;
  }
  return { content: [{ type: 'text' as const, text }], isError: true };
}

/** Build a fully-configured MCP server backed by `client`. Exported for tests. */
export function createServer(client: ProviderSource): McpServer {
  const server = new McpServer({
    name: 'xcircl-mcp-server',
    version: '0.1.0',
  });

  server.registerTool(
    'search_providers',
    {
      title: 'Search regulated-care providers',
      description: `Search verified U.S. regulated-care providers (currently the GLP-1 / weight-management vertical is live) by vertical, city, state and business mode.

A free XCIRCL_API_KEY returns identity fields per provider — entity_id, slug, vertical, name, city, state, business_mode, latitude, longitude, npi — plus a notice describing plan-gated fields.
Keys with compliance access add legitscript / license / fda signals and cash price, each with source + verification timestamp.

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
        state: z.string().length(2).optional().describe('Two-letter US state code, e.g. "TX".'),
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

A free XCIRCL_API_KEY returns identity fields + notice. Keys with compliance access return legitscript / license / fda signals and price, each source-linked and timestamped.

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

These are plan-gated fields. A free XCIRCL_API_KEY returns provider identity + compliance: null and explains how to unlock them: "${UPGRADE_HINT}".

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

  return server;
}
