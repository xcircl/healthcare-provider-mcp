# Security Policy

## Reporting a vulnerability

Please report security issues **privately** — do not open a public issue for
anything exploitable.

Two ways, either is fine:

1. **GitHub private advisory** (preferred): open a report under
   **Security → Advisories → Report a vulnerability** on this repository. This
   keeps the discussion private until a fix ships.
2. **Email**: [charles@xcircl.com](mailto:charles@xcircl.com). If you'd like to
   encrypt, say so in a first plaintext email and we'll exchange a key.

Please include: affected package (`@xcircl/sdk` and/or `@xcircl/mcp-server`) and
version, a description, and a minimal reproduction if you have one.

## Response targets

| Stage | Target |
|---|---|
| Acknowledge your report | within **3 business days** |
| Initial assessment (severity + rough plan) | within **7 business days** |
| Fix or mitigation for confirmed high/critical issues | within **30 days** |

We'll keep you updated through the advisory/email thread and credit you in the
release notes unless you'd prefer to stay anonymous.

## Scope

This repository is the **open-source client shell** — an MCP server and a
TypeScript SDK that call the hosted xcircl API. In scope:

- The SDK / MCP server code in this repo (request handling, error passthrough,
  input validation, dependency vulnerabilities).

Out of scope here (report separately, same email):

- The hosted API and its data at `xcircl.com` — server-side issues, data
  exposure, or authentication problems on the service itself.

## Good to know

- The client holds **no data and no field-tiering logic** — tiering, quotas and
  vertical binding are enforced server-side. An exposed or misused API key is a
  key-management issue; rotate it in your xcircl developer account.
- Never paste a real API key into an issue, PR, or reproduction.
