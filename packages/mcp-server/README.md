# @xcircl/mcp-server

**Compliance-aware GLP-1 provider data as MCP tools** — let Claude, ChatGPT
or any MCP client query [xcircl.com](https://xcircl.com)'s verified U.S.
regulated-care provider data: AI agents, clinic finders, diligence workflows.

The free tier works with **no API key**. Set `XCIRCL_API_KEY` (self-serve
from $99/mo) to unlock compliance signals and cash prices — field tiering is
enforced server-side; this server holds no data and no gating logic.

## Tools

| Tool | What it does |
|---|---|
| `search_providers` | Filter by vertical / city / state / business mode |
| `get_provider` | One full record by `entity_id` or slug |
| `check_compliance` | LegitScript / state-license / FDA signals with source + timestamp |

## Connect

**Claude Code:**

```bash
claude mcp add xcircl -- npx -y @xcircl/mcp-server
# with a key:
claude mcp add xcircl -e XCIRCL_API_KEY=your-key -- npx -y @xcircl/mcp-server
```

**Claude Desktop** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "xcircl": {
      "command": "npx",
      "args": ["-y", "@xcircl/mcp-server"],
      "env": { "XCIRCL_API_KEY": "optional — omit for the free tier" }
    }
  }
}
```

Then ask: *“Find GLP-1 clinics in Houston and check their compliance.”*

Full docs, TypeScript SDK and field dictionary:
[github.com/xcircl/xcircl-agent](https://github.com/xcircl/xcircl-agent).

## License

MIT
