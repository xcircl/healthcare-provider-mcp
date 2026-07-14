# @xcircl/sdk

[![npm](https://img.shields.io/npm/v/@xcircl/sdk?color=cb3837&logo=npm)](https://www.npmjs.com/package/@xcircl/sdk)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)

**US regulated-care provider data for AI agents, clinic finders, and diligence
teams.** Zero-dependency TypeScript client for
[xcircl.com](https://xcircl.com) — verified provider facts cross-checked
against NPPES, the FDA, and where available LegitScript and state boards;
source-linked and
timestamped. GLP-1 is the deepest vertical today, with more in the pipeline.

The free tier works with **no API key**: identity fields (name, location, NPI)
from public registries, plus a notice describing what a key adds. Paid keys
(self-serve from $99/mo) unlock LegitScript / state-license / FDA compliance
signals and published cash prices, each with source + verification timestamp.
Field tiering, quotas and vertical binding are all enforced **server-side** —
this client contains zero gating logic.

## Install

```bash
npm install @xcircl/sdk
```

## Use

```ts
import { XcirclClient } from '@xcircl/sdk';

const xcircl = new XcirclClient();            // no key → free tier
// const xcircl = new XcirclClient({ apiKey: process.env.XCIRCL_API_KEY });

const { data, notice } = await xcircl.searchProviders({
  vertical: 'glp1',
  city: 'Houston',
  state: 'TX',
});

for (const p of data) console.log(p.name, p.city, p.npi);
if (notice) console.log(notice);              // what a key would add

const compliance = await xcircl.checkCompliance(data[0].entity_id);
```

API surface: `searchProviders`, `getProvider`, `checkCompliance`,
`getCoverage`, `getSample`. Errors throw `XcirclApiError` with `.status`,
`.message`, `.upgrade` and `.body` — server messages are relayed verbatim.

Full docs, field dictionary and MCP server:
[github.com/xcircl/healthcare-provider-mcp](https://github.com/xcircl/healthcare-provider-mcp).

## License

MIT
