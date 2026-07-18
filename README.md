# US healthcare provider facts — MCP server & SDK (xcircl)

**Verified U.S. regulated-care provider data for your app or AI. Source-linked, timestamped.**

[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)
[![npm @xcircl/sdk](https://img.shields.io/npm/v/@xcircl/sdk?label=%40xcircl%2Fsdk&color=cb3837&logo=npm)](https://www.npmjs.com/package/@xcircl/sdk)
[![npm @xcircl/mcp-server](https://img.shields.io/npm/v/@xcircl/mcp-server?label=%40xcircl%2Fmcp-server&color=cb3837&logo=npm)](https://www.npmjs.com/package/@xcircl/mcp-server)
[![Verified providers](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fxcircl.com%2Fapi%2Fv1%2Fcoverage%2F&query=%24.verified.total&label=verified%20providers&color=blue)](https://xcircl.com/data/coverage/)
[![Tracked providers](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fxcircl.com%2Fapi%2Fv1%2Fcoverage%2F&query=%24.tracked.total&label=tracked&color=lightgrey)](https://xcircl.com/data/coverage/)
[![States covered](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fxcircl.com%2Fapi%2Fv1%2Fcoverage%2F&query=%24.verified.states&label=states&color=blue)](https://xcircl.com/data/coverage/)
[![Verticals live](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fxcircl.com%2Fapi%2Fv1%2Fcoverage%2F&query=%24.verticals_live&label=verticals%20live&color=orange)](https://xcircl.com/data/coverage/)

**Verify any US healthcare provider** — query them in natural language or
function calls, cross-checked against official sources: NPPES, the FDA, and
where available LegitScript and state licensing boards. Use it as an **MCP
server** for Claude/ChatGPT or a **TypeScript SDK** for your own product; a
**free key** takes 30 seconds (email signup), and it's built for AI agents,
clinic finders, and diligence teams.

GLP-1 / weight-management is the deepest vertical today (6,028 tracked ·
869 verified). A US-wide provider identity layer (~9M providers across all
specialties) is rolling out; medspa and pet veterinary follow. Verified
compliance signals and cash prices unlock with a key.

> Counts in the badges above are pulled live from
> [`/api/v1/coverage/`](https://xcircl.com/api/v1/coverage/) — the numbers
> update as the dataset grows.

## 30-second quickstart

Grab a free key (email signup, instant) →
**[xcircl.com/developers/signup](https://xcircl.com/developers/signup)**, then:

```bash
export XCIRCL_API_KEY=your-free-key
curl -sL -H "Authorization: Bearer $XCIRCL_API_KEY" \
  "https://xcircl.com/api/v1/providers/?vertical=glp1&state=TX&limit=3"
```

```jsonc
{
  "tier": "free",
  "pagination": { "total": 15, "limit": 3, "offset": 0, "returned": 3 },
  "data": [
    {
      "entity_id": "ent_f47550b79f755d70b58b183a",
      "slug": "alegro-health-mckinney-tx",
      "vertical": "glp1",
      "name": "Alegro Health",
      "city": "McKinney",
      "state": "TX",
      "business_mode": "online",
      "latitude": 33.198119,
      "longitude": -96.708802,
      "npi": "1053066357"
    }
    // …
  ]
}
```

Real data, real API. A free key returns identity fields — enough to evaluate.
Free keys include **500 provider calls per month**. Compliance fields (FDA, licenses, prices) and commercial use →
[plans](https://xcircl.com/developers/pricing/).

## Use it from Claude (MCP server)

No clone, no build — `npx` pulls
[`@xcircl/mcp-server`](https://www.npmjs.com/package/@xcircl/mcp-server) from npm.

`XCIRCL_API_KEY` is required for provider tools. Get a free key (email signup, 30s) →
[xcircl.com/developers/signup](https://xcircl.com/developers/signup). A paid
key additionally unlocks price + compliance fields.

**Claude Code:**

```bash
claude mcp add xcircl -e XCIRCL_API_KEY=your-key -- npx -y @xcircl/mcp-server
```

**Claude Desktop** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "xcircl": {
      "command": "npx",
      "args": ["-y", "@xcircl/mcp-server"],
      "env": { "XCIRCL_API_KEY": "your-key" }
    }
  }
}
```

Then just ask: *“Find GLP-1 clinics in Houston and check their compliance.”*
The server exposes three tools:

| Tool | What it does |
|---|---|
| `search_providers` | Filter by vertical / city / state / business mode |
| `get_provider` | One full record by `entity_id` or slug |
| `check_compliance` | LegitScript / state-license / FDA signals (paid fields — a free-tier key returns identity plus a notice on how to unlock) |

## Use it from your code (TypeScript SDK)

```bash
npm install @xcircl/sdk
```

```ts
import { XcirclClient } from '@xcircl/sdk';

const apiKey = process.env.XCIRCL_API_KEY;
if (!apiKey) throw new Error('Set XCIRCL_API_KEY first');
const xcircl = new XcirclClient({ apiKey });
// free key → identity fields; paid key → + compliance & price

const { data, notice } = await xcircl.searchProviders({
  vertical: 'glp1',
  city: 'Houston',
  state: 'TX',
});

for (const p of data) console.log(p.name, p.city, p.npi);
if (notice) console.log(notice);              // what a key would add
```

Runnable examples live in the repo (clone it to run them; use a free xcircl
key for provider data; the AI example also needs your own Claude API key):

```bash
git clone https://github.com/xcircl/healthcare-provider-mcp.git
cd healthcare-provider-mcp && npm install && npm run build
node examples/01-find-clinics.mjs Houston TX  # find clinics
node examples/02-ai-tool-use.mjs              # give Claude live xcircl tools (bring your own ANTHROPIC_API_KEY)
```

## Where the data comes from

Every record is assembled from official, citable sources — and every paid
signal carries its **source and verification timestamp**:

- **[NPPES](https://npiregistry.cms.hhs.gov/)** — the CMS National Provider
  Identifier registry, for provider identity (name, location, NPI).
- **[FDA Data Dashboard](https://datadashboard.fda.gov/)** — Drugs/Biologics
  warning-letter screens (compliance actions since 2019).
- **State license boards** — medical and pharmacy license records.
- **[LegitScript](https://www.legitscript.com/)** — certification status checks.
- **Provider websites** — published cash prices, with the source page and
  check date recorded.

This repository contains **no data files** — it is the open-source shell
(MCP server + SDK + docs) around the xcircl API. The data lives, and the
field tiering is enforced, server-side. The only demo data source is the
live [`/api/v1/sample/`](https://xcircl.com/api/v1/sample/) endpoint
(~50 clean records in the paid schema).

## Free vs paid fields

| Field | Free key | Paid key |
|---|:---:|:---:|
| `entity_id`, `slug`, `vertical`, `name` | ✅ | ✅ |
| `city`, `state`, `latitude`, `longitude` | ✅ | ✅ |
| `business_mode`, `npi` | ✅ | ✅ |
| `legitscript` — certification signal | — | ✅ |
| `license` — state-license record | — | ✅ |
| `fda` — warning-letter screen | — | ✅ |
| `price` — published cash price | — | ✅ |
| source + `verified_at` on every signal | — | ✅ |

**Free key (email signup, 30s)** — 500 provider calls/month and identity fields, great for evaluation.
**Compliance fields (FDA, licenses, prices) and commercial use** → plans at
[xcircl.com/developers/pricing](https://xcircl.com/developers/pricing/).

- A **free key** returns real identity data plus a one-line notice on what a paid key adds — the wall you hit is a field/quota wall, and any missing/invalid key gets a clear 401 pointing to signup.
- Field tiering, rate limits and vertical binding are all enforced **server-side** by the key — this client contains zero gating logic.

Full field dictionary: [docs/schema.md](./docs/schema.md) · recorded test
runs against production: [docs/verification.md](./docs/verification.md).

## Repository layout

```
packages/mcp-server/   MCP server (stdio) — search_providers / get_provider / check_compliance
packages/sdk-ts/       @xcircl/sdk — zero-dependency TypeScript client
examples/              runnable examples (find clinics, AI tool use)
docs/schema.md         field dictionary (free/paid tiering)
```

## License

[MIT](./LICENSE) — the shell is open; build on it freely.
