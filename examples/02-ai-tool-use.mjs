#!/usr/bin/env node
/**
 * Example 2 — give an AI (Claude) live access to xcircl data via tool use.
 *
 * This is the same integration the MCP server provides, shown as plain
 * Claude API tool calling so you can embed it in any app.
 *
 * Run from the repo root (after `npm install && npm run build`):
 *   ANTHROPIC_API_KEY=sk-ant-... node examples/02-ai-tool-use.mjs "Find GLP-1 clinics in Houston and tell me about one of them"
 *
 * Optional: XCIRCL_API_KEY=... to give the AI paid fields (price, compliance).
 */

import Anthropic from '@anthropic-ai/sdk';
import { XcirclClient } from '@xcircl/sdk';

const question =
  process.argv[2] ?? 'Find GLP-1 clinics in Houston, TX and summarize what you know about one of them.';

const xcircl = new XcirclClient({ apiKey: process.env.XCIRCL_API_KEY });
const anthropic = new Anthropic();

const tools = [
  {
    name: 'search_providers',
    description:
      'Search verified U.S. regulated-care providers (GLP-1 vertical is live). Free tier returns identity fields plus a notice about paid fields.',
    input_schema: {
      type: 'object',
      properties: {
        vertical: { type: 'string', enum: ['glp1'], description: 'Care vertical' },
        city: { type: 'string', description: 'City name, e.g. "Austin"' },
        state: { type: 'string', description: 'Two-letter state code, e.g. "TX"' },
        business_mode: { type: 'string', enum: ['online', 'physical', 'both'] },
        limit: { type: 'integer', minimum: 1, maximum: 50 },
      },
    },
  },
  {
    name: 'get_provider',
    description: 'Fetch one provider record by entity_id or slug, as returned by search_providers.',
    input_schema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'entity_id ("ent_…") or slug' } },
      required: ['id'],
    },
  },
  {
    name: 'check_compliance',
    description:
      'Compliance signals (LegitScript / state license / FDA screen) for one provider. Paid fields — without an xcircl key the result explains how to unlock them.',
    input_schema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'entity_id ("ent_…") or slug' } },
      required: ['id'],
    },
  },
];

async function runTool(name, input) {
  switch (name) {
    case 'search_providers':
      return xcircl.searchProviders(input);
    case 'get_provider':
      return xcircl.getProvider(input.id);
    case 'check_compliance':
      return xcircl.checkCompliance(input.id);
    default:
      throw new Error(`unknown tool: ${name}`);
  }
}

const messages = [{ role: 'user', content: question }];

while (true) {
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 4096,
    thinking: { type: 'adaptive' },
    tools,
    messages,
  });

  for (const block of response.content) {
    if (block.type === 'text') console.log(block.text);
  }

  if (response.stop_reason !== 'tool_use') break;

  messages.push({ role: 'assistant', content: response.content });
  const results = [];
  for (const block of response.content) {
    if (block.type !== 'tool_use') continue;
    console.log(`\n🔧 ${block.name}(${JSON.stringify(block.input)})\n`);
    try {
      const data = await runTool(block.name, block.input);
      results.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(data) });
    } catch (err) {
      results.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: String(err?.message ?? err),
        is_error: true,
      });
    }
  }
  messages.push({ role: 'user', content: results });
}
