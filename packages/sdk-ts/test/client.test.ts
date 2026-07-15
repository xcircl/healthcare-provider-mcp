/**
 * SDK smoke tests — no network. A mock `fetch` asserts the client builds the
 * right URL, sends Authorization correctly, parses the envelope, relays server
 * errors verbatim, retries transient failures, and validates response shape.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { XcirclClient, XcirclApiError, XcirclSchemaError } from '../src/index.js';

type FetchArgs = { url: string; init: RequestInit | undefined };

/** A mock fetch that records calls and returns queued JSON responses. */
function mockFetch(
  responder: (n: number) => { status?: number; body?: unknown } | Error,
): { fetch: typeof fetch; calls: FetchArgs[] } {
  const calls: FetchArgs[] = [];
  const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    const r = responder(calls.length);
    if (r instanceof Error) throw r;
    return new Response(r.body === undefined ? null : JSON.stringify(r.body), {
      status: r.status ?? 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
  return { fetch: fetchImpl, calls };
}

const SEARCH_OK = {
  tier: 'free',
  publish_boundary: 'verified',
  pagination: { total: 1, limit: 20, offset: 0, returned: 1 },
  filters: { vertical: 'glp1', state: 'TX', city: null, business_mode: null },
  data: [{ entity_id: 'ent_x', slug: 'x-tx', vertical: 'glp1', name: 'X', city: 'Houston', state: 'TX', business_mode: 'physical', latitude: null, longitude: null, npi: null }],
};

test('searchProviders: builds URL, sends Bearer, parses envelope', async () => {
  const m = mockFetch(() => ({ body: SEARCH_OK }));
  const client = new XcirclClient({ apiKey: 'secret', fetch: m.fetch, baseUrl: 'https://api.test/v1' });
  const res = await client.searchProviders({ vertical: 'glp1', city: 'Houston', state: 'TX', limit: 3 });

  assert.equal(m.calls.length, 1);
  const url = m.calls[0].url;
  assert.ok(url.startsWith('https://api.test/v1/providers/?'), url);
  assert.ok(url.includes('vertical=glp1'));
  assert.ok(url.includes('city=Houston'));
  assert.ok(url.includes('state=TX'));
  assert.ok(url.includes('limit=3'));
  const headers = m.calls[0].init?.headers as Record<string, string>;
  assert.equal(headers.authorization, 'Bearer secret');
  assert.equal(res.data[0].entity_id, 'ent_x');
  assert.equal(res.tier, 'free');
});

test('missing key fails before any request', () => {
  const m = mockFetch(() => ({ body: SEARCH_OK }));
  assert.throws(
    () => new XcirclClient({ apiKey: '   ', fetch: m.fetch }),
    /requires apiKey/,
  );
  assert.equal(m.calls.length, 0);
});

test('403 vertical binding → XcirclApiError with verbatim upgrade + body', async () => {
  const errBody = {
    error: 'Your Builder plan is bound to the "glp1" vertical.',
    upgrade: 'Developer unlocks multi-vertical access — see /developers/pricing/ or talk to sales.',
  };
  const m = mockFetch(() => ({ status: 403, body: errBody }));
  const client = new XcirclClient({ apiKey: 'k', fetch: m.fetch });
  await assert.rejects(
    () => client.searchProviders({ vertical: 'medspa' }),
    (err: unknown) => {
      assert.ok(err instanceof XcirclApiError);
      assert.equal(err.status, 403);
      assert.equal(err.message, errBody.error);
      assert.equal(err.upgrade, errBody.upgrade);
      assert.deepEqual(err.body, errBody);
      return true;
    },
  );
  assert.equal(m.calls.length, 1, '4xx must not retry');
});

test('429 quota → verbatim; 4xx never retries', async () => {
  const m = mockFetch(() => ({ status: 429, body: { error: 'Monthly call quota reached (5000 calls).', upgrade: 'Developer raises the quota to 25,000 calls.' } }));
  const client = new XcirclClient({ apiKey: 'k', fetch: m.fetch, maxRetries: 2 });
  await assert.rejects(() => client.searchProviders(), (err: unknown) => err instanceof XcirclApiError && err.status === 429);
  assert.equal(m.calls.length, 1);
});

test('404 getProvider → XcirclApiError(404)', async () => {
  const m = mockFetch(() => ({ status: 404, body: { error: 'Provider not found.' } }));
  const client = new XcirclClient({ apiKey: 'k', fetch: m.fetch });
  await assert.rejects(() => client.getProvider('ent_missing'), (err: unknown) => err instanceof XcirclApiError && err.status === 404);
});

test('5xx retries with backoff, then succeeds', async () => {
  const m = mockFetch((n) => (n < 3 ? { status: 503, body: { error: 'overloaded' } } : { body: SEARCH_OK }));
  const client = new XcirclClient({ apiKey: 'k', fetch: m.fetch, maxRetries: 2, retryBaseMs: 1 });
  const res = await client.searchProviders({ vertical: 'glp1' });
  assert.equal(m.calls.length, 3, 'two retries then success');
  assert.equal(res.data[0].entity_id, 'ent_x');
});

test('network error retries, then exhausts → XcirclApiError(0)', async () => {
  const m = mockFetch(() => new TypeError('fetch failed'));
  const client = new XcirclClient({ apiKey: 'k', fetch: m.fetch, maxRetries: 2, retryBaseMs: 1 });
  await assert.rejects(() => client.getCoverage(), (err: unknown) => err instanceof XcirclApiError && err.status === 0);
  assert.equal(m.calls.length, 3, 'initial + two retries');
});

test('malformed 2xx envelope → XcirclSchemaError', async () => {
  const m = mockFetch(() => ({ body: { tier: 'free' /* no data[] */ } }));
  const client = new XcirclClient({ apiKey: 'k', fetch: m.fetch });
  await assert.rejects(() => client.searchProviders({ vertical: 'glp1' }), (err: unknown) => {
    assert.ok(err instanceof XcirclSchemaError);
    return true;
  });
});

test('validateResponses:false lets odd shapes through', async () => {
  const m = mockFetch(() => ({ body: { tier: 'free' } }));
  const client = new XcirclClient({ apiKey: 'k', fetch: m.fetch, validateResponses: false });
  const res = await client.searchProviders({ vertical: 'glp1' });
  assert.equal((res as { tier: string }).tier, 'free');
});

test('checkCompliance without signals → compliance:null + notice', async () => {
  const provider = {
    tier: 'free',
    publish_boundary: 'verified',
    data: { entity_id: 'ent_x', slug: 'x-tx', vertical: 'glp1', name: 'X', city: 'Houston', state: 'TX', business_mode: 'physical', latitude: null, longitude: null, npi: null },
  };
  const m = mockFetch(() => ({ body: provider }));
  const client = new XcirclClient({ apiKey: 'k', fetch: m.fetch });
  const res = await client.checkCompliance('ent_x');
  assert.equal(res.compliance, null);
  assert.match(res.notice ?? '', /require an API key/);
});
