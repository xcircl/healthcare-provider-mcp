# xcircl-agent

**Verified U.S. regulated-care provider data for your app or AI. Source-linked, timestamped.**

[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)
[![Verified providers](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fxcircl.com%2Fapi%2Fv1%2Fcoverage%2F&query=%24.verified.total&label=verified%20providers&color=blue)](https://xcircl.com/data/coverage/)
[![Tracked providers](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fxcircl.com%2Fapi%2Fv1%2Fcoverage%2F&query=%24.tracked.total&label=tracked&color=lightgrey)](https://xcircl.com/data/coverage/)
[![States covered](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fxcircl.com%2Fapi%2Fv1%2Fcoverage%2F&query=%24.verified.states&label=states&color=blue)](https://xcircl.com/data/coverage/)
[![Verticals live](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fxcircl.com%2Fapi%2Fv1%2Fcoverage%2F&query=%24.verticals_live%5B*%5D&label=verticals%20live&color=orange)](https://xcircl.com/data/coverage/)

Query US regulated-care providers (GLP-1 / weight-management clinics today;
more verticals coming) in natural language or function calls — as an **MCP
server** for Claude/ChatGPT, or a **TypeScript SDK** for your own product.
The free tier works with **no API key**; verified compliance signals and cash
prices unlock with one.

> Counts in the badges above are pulled live from
> [`/api/v1/coverage/`](https://xcircl.com/api/v1/coverage/) — the numbers
> update as the dataset grows.

## 30-second quickstart (no key, no install)

```bash
curl -sL "https://xcircl.com/api/v1/providers/?vertical=glp1&state=TX&limit=3"
```

```jsonc
{
  "tier": "free",
  "notice": "Free tier: identity fields only. Verified compliance signals, price and timestamps require a key — see /developers/pricing/.",
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

Real data, real API, zero setup. `Full fields (cash_price, compliance) from
$99/mo self-serve → [xcircl.com/developers](https://xcircl.com/developers/)`.

## Use it from Claude (MCP server)

```bash
git clone https://github.com/xcircl/xcircl-agent.git
cd xcircl-agent && npm install && npm run build
```

**Claude Code:**

```bash
claude mcp add xcircl -- node /path/to/xcircl-agent/packages/mcp-server/dist/index.js
# with a key (unlocks price + compliance fields):
claude mcp add xcircl -e XCIRCL_API_KEY=your-key -- node /path/to/xcircl-agent/packages/mcp-server/dist/index.js
```

**Claude Desktop** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "xcircl": {
      "command": "node",
      "args": ["/path/to/xcircl-agent/packages/mcp-server/dist/index.js"],
      "env": { "XCIRCL_API_KEY": "optional — omit for the free tier" }
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
| `check_compliance` | LegitScript / state-license / FDA signals (paid fields — the tool still answers without a key and says how to unlock) |

## Use it from your code (TypeScript SDK)

```bash
npm install && npm run build   # from the repo root
```

```ts
import { XcirclClient } from '@xcircl/sdk';

const xcircl = new XcirclClient();            // no key → free tier
// const xcircl = new XcirclClient({ apiKey: process.env.XCIRCL_API_KEY });

const { data, notice } = await xcircl.searchProviders({
  vertical: 'glp1',
  city: 'Austin',
  state: 'TX',
});

for (const p of data) console.log(p.name, p.city, p.npi);
if (notice) console.log(notice);              // what a key would add
```

Runnable examples (both work without any key):

```bash
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

| Field | Free (no key / free key) | Builder+ ($99/mo and up) |
|---|:---:|:---:|
| `entity_id`, `slug`, `vertical`, `name` | ✅ | ✅ |
| `city`, `state`, `latitude`, `longitude` | ✅ | ✅ |
| `business_mode`, `npi` | ✅ | ✅ |
| `legitscript` — certification signal | — | ✅ |
| `license` — state-license record | — | ✅ |
| `fda` — warning-letter screen | — | ✅ |
| `price` — published cash price | — | ✅ |
| source + `verified_at` on every signal | — | ✅ |

## Plans

| Plan | Price | Fields | Requests | Verticals |
|---|---|---|---|---|
| **Free** | $0 (register at [xcircl.com/developers](https://xcircl.com/developers/)) | identity fields | 1,000/mo | all |
| **Builder** | **$99/mo** — credit-card self-serve | **all fields** | 5,000/mo | 1 (key-bound) |
| **Developer** | $750/mo · Founding Customer (first 10): $375/mo locked 12 months | all fields | 25,000/mo | multiple |
| **Enterprise** | [contact sales](https://xcircl.com/developers/) | all fields + export | unlimited | all |

- **No key**: fully usable, 100% real data, plus a one-line notice about paid fields — the free experience is a real demo, and the wall you hit is a field/vertical/volume wall, never a "doesn't run" wall.
- Rate limits and vertical binding are enforced **server-side** by the key, same as field tiering — this client contains zero gating logic.

Full field dictionary: [docs/schema.md](./docs/schema.md).

## Repository layout

```
packages/mcp-server/   MCP server (stdio) — search_providers / get_provider / check_compliance
packages/sdk-ts/       @xcircl/sdk — zero-dependency TypeScript client
examples/              runnable examples (find clinics, AI tool use)
docs/schema.md         field dictionary (free/paid tiering)
```

## License

[MIT](./LICENSE) — the shell is open; build on it freely.
