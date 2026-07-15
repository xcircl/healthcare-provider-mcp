# xcircl data schema

The xcircl API returns one outward-facing shape — the `Provider` record — for
every vertical. Field tiering is enforced **server-side by your API key**: the
free tier simply doesn't include paid fields in the response. Nothing is
hidden client-side.

This document is the field dictionary. The TypeScript source of truth is
[`packages/sdk-ts/src/types.ts`](../packages/sdk-ts/src/types.ts).

## Provider record

### FREE tier — public identity

Sourced from public registries (NPPES et al.). Returned on the **free key**
tier and up.

| Field | Type | Description |
|---|---|---|
| `entity_id` | `string` | Stable xcircl ID, e.g. `ent_f47550b79f755d70b58b183a` |
| `slug` | `string` | URL-safe handle, e.g. `alegro-health-mckinney-tx` |
| `vertical` | `string` | `glp1` (live) · `pet_health` · `medspa` · `ivf` · `dental` · `senior` (planned) |
| `name` | `string` | Provider name |
| `city` | `string \| null` | City |
| `state` | `string \| null` | Two-letter US state code |
| `business_mode` | `string` | `online` · `physical` · `both` |
| `latitude` | `number \| null` | WGS84 |
| `longitude` | `number \| null` | WGS84 |
| `npi` | `string \| null` | National Provider Identifier (NPPES) |
| `publish_tier` | `string?` | Only in `include=tracked` responses: `verified` or `internal_only` |

### PAID tier — verified signals + commercial

Each signal carries **status + source + verification timestamp** — that
triple is the product. Requires a paid key — see
[plans](https://xcircl.com/developers/pricing/).

| Field | Type | Description |
|---|---|---|
| `legitscript` | `SourcedSignal` | LegitScript certification check |
| `license` | `SourcedSignal & { states_count: number }` | State medical/pharmacy license record |
| `fda` | `SourcedSignal` | FDA warning-letter screen (Drugs/Biologics compliance actions) |
| `price` | `ProviderPrice` | Published cash price |

#### `SourcedSignal`

```ts
{
  status: 'verified' | 'clear' | 'flagged' | 'reported' | 'unverified' | 'not_screened',
  source: string | null,       // where the fact comes from
  verified_at: string | null,  // ISO 8601 — when we last checked
  source_url?: string | null
}
```

Signal statuses are the honesty boundary:

| Status | Meaning |
|---|---|
| `verified` | Positive fact on file — we hold BOTH a source AND a timestamp |
| `clear` | A negative screen we actually ran (e.g. no FDA warning letter found) |
| `flagged` | Adverse finding on file |
| `reported` | Self-reported by the provider, not independently verified |
| `unverified` | Not yet checked |
| `not_screened` | Screen not yet run |

#### `ProviderPrice`

```ts
{
  range: string | null,        // human-readable, e.g. "$429–$862/mo"
  monthly_min: number | null,
  monthly_max: number | null,
  source: string | null,       // e.g. "Clinic website"
  verified_at: string | null   // ISO 8601
}
```

## Response envelopes

### `GET /api/v1/providers/`

Query params: `vertical`, `state`, `city`, `business_mode`, `limit` (≤1000),
`offset`, `format` (`json`|`csv`), `include=tracked` (free-tier transparency
view of the wider monitored set).

```jsonc
{
  "tier": "free",                    // or "paid" — decided by your key
  "plan": "free",                    // free | builder | developer | enterprise
  "publish_boundary": "verified",    // or "tracked" (include=tracked, free tier only)
  "usage": { "used": 7, "quota": 5000 },           // metered plans (builder/developer) only
  "notice": "Free tier: identity fields only. …",  // free tier only
  "pagination": { "total": 15, "limit": 20, "offset": 0, "returned": 15 },
  "filters": { "vertical": "glp1", "state": "TX", "city": null, "business_mode": null },
  "data": [ /* Provider[] */ ]
}
```

On a Builder key with no `vertical` param, the API serves the key's bound
vertical. The single-provider envelope carries `tier`/`plan` but no `usage`
meter (its 429 body does include one).

### `GET /api/v1/providers/{entity_id|slug}/`

Same envelope with a single `data: Provider`. 404 if unknown.

### `GET /api/v1/coverage/`

Free for everyone — the live proof of what xcircl holds. Dual-boundary
counts (`tracked` = full monitored set, `verified` = default delivery set),
per-state breakdowns, signal counts, `verticals_live`, `generated_at`.

### `GET /api/v1/sample/`

~50 clean demo records in the **paid schema** (verified-only) so you can
inspect the full shape before wiring up a paid key. This is the only
sanctioned demo data source — this repository itself contains zero data files.

## Publication boundary (`publish_boundary`)

Independent of the free/paid field cut, the API has a **publication
boundary**: default delivery is `verified` (records whose identity passed
verification) for every tier. The wider `tracked` set is available only as a
free-tier, JSON-only transparency view via `include=tracked`; paid delivery
and CSV export are strictly verified-only. Rows in tracked responses
self-declare via `publish_tier`.

## Authentication

```
Authorization: Bearer <your-key>
```

| Tier | Fields | Notes |
|---|---|---|
| Free key | FREE fields | Email signup, instant — [signup](https://xcircl.com/developers/signup). Metered; responses carry a `notice` about paid fields |
| Paid key | ALL fields | Monthly call quota and vertical binding vary by plan — the response echoes `plan` and, on metered plans, a `usage` meter |

A missing or unrecognised key returns `401` with a notice pointing to signup —
a free key is 30 seconds away. Plans, quotas and pricing are maintained in one
place, on the website:
**[xcircl.com/developers/pricing](https://xcircl.com/developers/pricing/)**.
This repo deliberately carries no price or quota numbers — they would rot here.

Rate limits and vertical binding are enforced server-side by the key, same
principle as field tiering — clients do no gating.

## Error responses (verbatim)

The SDK and MCP server relay these server messages **verbatim** — the
`error` and `upgrade` texts below are exactly what callers see.

**403 — Builder key used outside its bound vertical** (e.g. a glp1-bound key
querying `vertical=medspa`):

```json
{
  "error": "Your Builder plan is bound to the \"glp1\" vertical.",
  "upgrade": "Developer ($750/mo) unlocks multi-vertical access — see /developers/pricing/ or talk to sales."
}
```

**429 — monthly quota reached** (Builder example; Developer's `upgrade` line
points to Enterprise instead):

```json
{
  "error": "Monthly call quota reached (5000 calls).",
  "plan": "builder",
  "usage": { "used": 5000, "quota": 5000 },
  "upgrade": "Developer ($750/mo) raises the quota to 25,000 calls — see /developers/pricing/."
}
```

In the SDK both surface as an `XcirclApiError` with `.status`, `.message`
(the `error` text), `.upgrade` and `.body` (the raw JSON). The MCP server
returns `isError: true` with `Error (403|429): <error> <upgrade>`.
