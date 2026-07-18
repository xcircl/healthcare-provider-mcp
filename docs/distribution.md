# Distribution & discoverability kit

Internal working doc for getting `@xcircl/mcp-server` and `@xcircl/sdk` found.
Submission actions (anything that creates a public listing) are executed by
the coordinator / owner — this file is the prepared material, not a to-do the
repo runs itself.

Canonical names: GitHub repo **`xcircl/healthcare-provider-mcp`** (renamed
from `xcircl-agent`; old URL 301s). npm packages **`@xcircl/mcp-server`** and
**`@xcircl/sdk`** (unchanged package names; 0.1.1 carries the current required-key policy).

## GitHub topics

Set on the repo (Settings → Topics, or `gh repo edit --add-topic`). Chosen for
real developer search terms:

```
mcp  mcp-server  model-context-protocol  claude  anthropic  llm-tools
healthcare  healthcare-mcp  glp1  provider-data  regulated-care
compliance  nppes  fda  ai-agents  typescript
```

## npm keywords

Already written into the two `package.json` files (take effect on the next
publish — 0.1.0 is not being re-churned):

- **@xcircl/sdk**: xcircl, healthcare, healthcare-api, glp1, provider-data,
  provider-directory, regulated-care, compliance, nppes, fda, clinic-finder,
  diligence, llm-tools, ai-agents
- **@xcircl/mcp-server**: mcp, mcp-server, model-context-protocol, claude,
  anthropic, llm-tools, xcircl, healthcare, healthcare-mcp, glp1,
  provider-data, regulated-care, compliance, nppes, fda, ai-agents

## MCP directory submissions

One-liner (shared across listings):

> **US healthcare provider facts as MCP tools** — search verified GLP-1 /
> regulated-care providers with source-linked, timestamped compliance signals
> (LegitScript, state license, FDA) and cash prices. Provider tools require an
> API key; a free key takes about 30 seconds to create.

Tools to list: `search_providers`, `get_provider`, `check_compliance`.
Install: `npx -y @xcircl/mcp-server`. License: MIT. Repo:
`https://github.com/xcircl/healthcare-provider-mcp`.

### Glama (glama.ai/mcp)

Glama auto-indexes public GitHub repos with an MCP server. Steps to claim:

1. Ensure the repo is public with a clear README (done) and the
   `mcp-server` topic set (see above) so the crawler classifies it.
2. Sign in to glama.ai with the GitHub account that has admin on
   `xcircl/healthcare-provider-mcp`.
3. Find the auto-generated server page (search "xcircl" or the repo name);
   click **Claim** → authorize → the listing binds to the org.
4. Fill the description (one-liner above), category **Healthcare**, and the
   install command. Confirm the tool list rendered from the server.

### Smithery (smithery.ai)

Submit via `https://smithery.ai/new` (or the "Submit server" link):

- Repository: `https://github.com/xcircl/healthcare-provider-mcp`
- Package: `@xcircl/mcp-server` (npm)
- Run command: `npx -y @xcircl/mcp-server`
- Config: required env `XCIRCL_API_KEY` (free key from xcircl.com/developers/signup)
- Description: one-liner above. Category: Healthcare / Data.

### PulseMCP (pulsemcp.com)

Community directory; submit via their "Add a server" form:

- Name: xcircl — US healthcare provider facts
- npm: `@xcircl/mcp-server` · GitHub: repo URL above
- Summary: one-liner. Tags: healthcare, provider-data, compliance, glp1.

### mcp.so

Submit via `https://mcp.so/submit` (or the GitHub-based intake):

- Repo URL + npm package name as above; description one-liner; tag Healthcare.

### modelcontextprotocol/servers (official list) — PR

Add an entry to the community servers list in
`github.com/modelcontextprotocol/servers` (README, "Community Servers"
section, alphabetical). Suggested line:

```md
- [xcircl](https://github.com/xcircl/healthcare-provider-mcp) — US healthcare
  provider facts: verified GLP-1 / regulated-care providers with source-linked
  compliance signals (LegitScript, state license, FDA) and cash prices. Free
  tier; an API key is required for provider tools, and free keys cover
  identity-field evaluation.
```

PR title: `Add xcircl healthcare-provider MCP server`. Follow their
CONTRIBUTING (alphabetical order, one line, no marketing adjectives — keep it
factual; the wording above is already trimmed to their house style).

## Submission checklist (coordinator executes)

- [ ] GitHub repo renamed to `healthcare-provider-mcp`, topics set
- [ ] Glama listing claimed
- [ ] Smithery submitted
- [ ] PulseMCP submitted
- [ ] mcp.so submitted
- [ ] modelcontextprotocol/servers PR opened
- [ ] Next npm publish carries the updated keywords + repo URL + required-key README
