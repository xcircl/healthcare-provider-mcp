# Verification log

Recorded test runs against the production API (`https://xcircl.com/api/v1`).
Keys are supplied via environment variables only — none are stored in this
repository.

## 2026-07-03 — free tier & paid passthrough (v0.1.0)

- No-key quickstart: fresh install + build + `examples/01-find-clinics.mjs`
  completed in ~3s, returning real identity fields plus the free-tier notice.
- MCP stdio protocol: `initialize` handshake (protocol `2025-06-18`),
  `tools/list` (3 tools), `tools/call` on all three tools, and 404 handling
  all passed.
- Paid key: `tier: "paid"`, all four paid fields (`legitscript`, `license`,
  `fda`, `price`) present with source + `verified_at`, on both the SDK and
  MCP paths.

## 2026-07-04 — Builder plan behaviors (four-tier pricing)

All runs with a Builder demo key bound to `glp1`, on **both** paths (SDK and
MCP server). Outputs below are verbatim.

### 1. Full fields + metering

SDK / MCP `search_providers` (vertical=glp1):

```
tier: paid | plan: builder | usage: {"used":7,"quota":5000}
paid fields on first record: legitscript, license, fda, price
```

SDK / MCP `get_provider` and `check_compliance`:

```
tier: paid | plan: builder | usage: undefined
paid fields: legitscript, license, fda, price          (get_provider)
compliance signals: legitscript, license, fda          (check_compliance)
```

Note: the single-provider API envelope carries `plan` but no `usage` meter —
the meter appears on the list endpoint and in 429 bodies. Clients pass the
envelope through as-is.

### 2. Cross-vertical 403 (vertical binding)

`search_providers` with `vertical=medspa` on a glp1-bound Builder key.

SDK (`XcirclApiError`):

```
status: 403
message (verbatim): Your Builder plan is bound to the "glp1" vertical.
upgrade (verbatim): Developer ($750/mo) unlocks multi-vertical access — see /developers/pricing/ or talk to sales.
```

MCP:

```
isError: true
text: Error (403): Your Builder plan is bound to the "glp1" vertical. Developer ($750/mo) unlocks multi-vertical access — see /developers/pricing/ or talk to sales.
```

### 3. Quota 429 (replayed shape)

The production 429 body (from the providers route, Builder branch) replayed
by a local mock — quota was not actually exhausted. Client relay verified:

SDK (`XcirclApiError`):

```
status: 429
message (verbatim): Monthly call quota reached (5000 calls).
upgrade (verbatim): Developer ($750/mo) raises the quota to 25,000 calls — see /developers/pricing/.
raw body: {"error":"Monthly call quota reached (5000 calls).","plan":"builder","usage":{"used":5000,"quota":5000},"upgrade":"Developer ($750/mo) raises the quota to 25,000 calls — see /developers/pricing/."}
```

MCP:

```
isError: true
text: Error (429): Monthly call quota reached (5000 calls). Developer ($750/mo) raises the quota to 25,000 calls — see /developers/pricing/.
```

In all cases the client relays the server's `error` + `upgrade` text
verbatim — no client-side rewording, gating, or plan logic.
