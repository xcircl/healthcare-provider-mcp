#!/usr/bin/env node
/**
 * Example 1 — find GLP-1 clinics, no API key needed.
 *
 * Run from the repo root (after `npm install && npm run build`):
 *   node examples/01-find-clinics.mjs [city] [state]
 *   node examples/01-find-clinics.mjs Houston TX
 *
 * Add XCIRCL_API_KEY=... to unlock cash price + compliance fields.
 */

import { XcirclClient } from '@xcircl/sdk';

const [city, state] = [process.argv[2], process.argv[3] ?? (process.argv[2] ? undefined : 'TX')];

const client = new XcirclClient({ apiKey: process.env.XCIRCL_API_KEY });

const res = await client.searchProviders({
  vertical: 'glp1',
  city,
  state,
  limit: 10,
});

console.log(`tier: ${res.tier} · boundary: ${res.publish_boundary} · matches: ${res.pagination.total}\n`);

for (const p of res.data) {
  const mode = p.business_mode === 'online' ? '🌐 online' : p.business_mode === 'both' ? '🏢+🌐' : '🏢 physical';
  console.log(`  ${p.name}  —  ${p.city}, ${p.state}  (${mode}, NPI ${p.npi ?? '—'})`);
  if (p.price?.range) console.log(`      💲 ${p.price.range}  (${p.price.source}, verified ${p.price.verified_at?.slice(0, 10)})`);
  if (p.fda) console.log(`      🛡  FDA screen: ${p.fda.status}`);
}

if (res.data.length === 0) {
  console.log('No verified providers matched — try dropping the city filter, e.g. `node examples/01-find-clinics.mjs "" TX`.');
}

if (res.notice) console.log(`\nℹ️  ${res.notice}`);
