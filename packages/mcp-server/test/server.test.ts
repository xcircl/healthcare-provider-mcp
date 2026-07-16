/**
 * MCP server smoke tests — no network. A fake ProviderSource is injected into
 * createServer, wired to an MCP client over an in-memory transport, then we
 * assert the three tools are registered with valid schemas and route correctly.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer, type ProviderSource } from '../src/server.js';

const IDENTITY = {
  entity_id: 'ent_x',
  slug: 'x-tx',
  vertical: 'glp1' as const,
  name: 'X Clinic',
  city: 'Houston',
  state: 'TX',
  business_mode: 'physical' as const,
  latitude: null,
  longitude: null,
  npi: null,
};

function fakeSource(overrides: Partial<ProviderSource> = {}): ProviderSource {
  return {
    searchProviders: async () => ({
      tier: 'free',
      publish_boundary: 'verified',
      pagination: { total: 1, limit: 20, offset: 0, returned: 1 },
      filters: { vertical: 'glp1', state: null, city: null, business_mode: null },
      data: [IDENTITY],
    }),
    getProvider: async () => ({ tier: 'free', publish_boundary: 'verified', data: IDENTITY }),
    checkCompliance: async () => ({
      entity_id: 'ent_x',
      slug: 'x-tx',
      name: 'X Clinic',
      tier: 'free',
      compliance: null,
      notice: 'Full fields require paid access.',
    }),
    ...overrides,
  };
}

async function connect(source: ProviderSource): Promise<Client> {
  const server = createServer(source);
  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test', version: '1.0.0' });
  await Promise.all([server.connect(serverT), client.connect(clientT)]);
  return client;
}

test('registers exactly the three tools', async () => {
  const client = await connect(fakeSource());
  const { tools } = await client.listTools();
  assert.deepEqual(
    tools.map((t) => t.name).sort(),
    ['check_compliance', 'get_provider', 'search_providers'],
  );
  await client.close();
});

test('every tool exposes a JSON-Schema input schema', async () => {
  const client = await connect(fakeSource());
  const { tools } = await client.listTools();
  for (const t of tools) {
    assert.equal(t.inputSchema.type, 'object', `${t.name} inputSchema.type`);
    assert.ok(t.description && t.description.length > 0, `${t.name} has a description`);
  }
  // get_provider / check_compliance require `id`
  const byName = Object.fromEntries(tools.map((t) => [t.name, t]));
  assert.deepEqual(byName.get_provider.inputSchema.required, ['id']);
  assert.deepEqual(byName.check_compliance.inputSchema.required, ['id']);
  await client.close();
});

test('search_providers routes to the source and returns structuredContent', async () => {
  let received: unknown;
  const client = await connect(
    fakeSource({
      searchProviders: async (params) => {
        received = params;
        return {
          tier: 'free',
          publish_boundary: 'verified',
          pagination: { total: 1, limit: 20, offset: 0, returned: 1 },
          filters: { vertical: 'glp1', state: 'TX', city: null, business_mode: null },
          data: [IDENTITY],
        };
      },
    }),
  );
  const res = await client.callTool({ name: 'search_providers', arguments: { vertical: 'glp1', state: 'TX' } });
  assert.equal((received as { vertical: string }).vertical, 'glp1');
  assert.equal((res.structuredContent as { tier: string }).tier, 'free');
  await client.close();
});

test('get_provider 404 → isError with an actionable message', async () => {
  const { XcirclApiError } = await import('@xcircl/sdk');
  const client = await connect(
    fakeSource({
      getProvider: async () => {
        throw new XcirclApiError('Provider not found.', 404, 'https://api/x');
      },
    }),
  );
  const res = await client.callTool({ name: 'get_provider', arguments: { id: 'ent_missing' } });
  assert.equal(res.isError, true);
  const text = (res.content as Array<{ type: string; text: string }>)[0].text;
  assert.match(text, /provider not found/i);
  await client.close();
});

test('403 relays the server upgrade text verbatim', async () => {
  const { XcirclApiError } = await import('@xcircl/sdk');
  const client = await connect(
    fakeSource({
      searchProviders: async () => {
        throw new XcirclApiError('Your Builder plan is bound to the "glp1" vertical.', 403, 'https://api/x', {
          upgrade: 'Developer unlocks multi-vertical access — see /developers/pricing/.',
        });
      },
    }),
  );
  const res = await client.callTool({ name: 'search_providers', arguments: { vertical: 'medspa' } });
  assert.equal(res.isError, true);
  const text = (res.content as Array<{ type: string; text: string }>)[0].text;
  assert.match(text, /bound to the "glp1" vertical/);
  assert.match(text, /Developer unlocks multi-vertical access/);
  await client.close();
});
