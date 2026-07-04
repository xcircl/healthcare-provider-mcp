# xcircl data schema

The xcircl API returns one outward-facing shape — the `Provider` record — for
every vertical. Field tiering is enforced **server-side by your API key**: the
free tier simply doesn't include paid fields in the response. Nothing is
hidden client-side.

This document is the field dictionary. The TypeScript source of truth is
[`packages/sdk-ts/src/types.ts`](../packages/sdk-ts/src/types.ts).

## Provider record

### FREE tier — public identity

Sourced from public registries (NPPES et al.). Available with **no API key**.

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
triple is the product. Requires a paid key — self-serve from $99/mo
([xcircl.com/developers](https://xcircl.com/developers/)).

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
  "publish_boundary": "verified",    // or "tracked" (include=tracked, free tier only)
  "notice": "Free tier: identity fields only. …",  // free tier only
  "pagination": { "total": 15, "limit": 20, "offset": 0, "returned": 15 },
  "filters": { "vertical": "glp1", "state": "TX", "city": null, "business_mode": null },
  "data": [ /* Provider[] */ ]
}
```

### `GET /api/v1/providers/{entity_id|slug}/`

Same envelope with a single `data: Provider`. 404 if unknown.

### `GET /api/v1/coverage/`

Free for everyone — the live proof of what xcircl holds. Dual-boundary
counts (`tracked` = full monitored set, `verified` = default delivery set),
per-state breakdowns, signal counts, `verticals_live`, `generated_at`.

### `GET /api/v1/sample/`

~50 clean demo records in the **paid schema** (verified-only) so you can see
the full shape without a key. This is the only sanctioned demo data source —
this repository itself contains zero data files.

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

| Tier | Fields | Requests | Verticals | Notes |
|---|---|---|---|---|
| No key | FREE fields | — | all | Fully usable; responses carry a `notice` about paid fields |
| Free key ($0, register) | FREE fields | 1,000/mo | all | |
| Builder key ($99/mo, self-serve) | ALL fields | 5,000/mo | 1 — key is bound to one vertical; cross-vertical requests return an upgrade notice | |
| Developer key ($750/mo; Founding Customer, first 10: $375/mo locked 12 months) | ALL fields | 25,000/mo | multiple | |
| Enterprise key | ALL fields + export | unlimited | all | Per contract — [contact sales](https://xcircl.com/developers/) |

Rate limits and vertical binding are enforced server-side by the key, same
principle as field tiering — clients do no gating. An unrecognised key falls
back to the free tier with a notice (it never hard-fails), so demos keep
working.
