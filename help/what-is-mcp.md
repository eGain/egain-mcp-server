# What is MCP?

Model Context Protocol (MCP) is an open standard that lets AI clients (Claude Desktop, Cursor, Windsurf, VS Code, and others) connect to external tools and data through a simple, consistent interface. This server implements MCP for eGain Knowledge, unifying Portal Manager, Search, Retrieve, and Answers into a single endpoint that your AI client can call.

## Why use MCP with eGain?
- Unified access: One MCP endpoint to your eGain knowledge base.
- Flexible workflows: Mix Search → Retrieve → Answers in one flow.
- LLM-friendly outputs: JSON contracts optimized for MCP clients and LLMs.
- Cross-client compatibility: Works with Claude Desktop, Cursor, CLI, Windsurf, VS Code, npm/stdio.
- Secure by design: Token-based, role-aware access aligned with portal permissions.
- Faster adoption: Consistent setup across teams and environments.
- Discoverable tools: Typed schemas so UIs can guide parameter entry.

## Common use cases

- Intelligent customer support automation: Power chatbots with accurate knowledge.
- Agent knowledge enhancement: Surface relevant content during live interactions.
- Unified knowledge access: Bring portal knowledge into developer and agent tools.

## Example workflow

User asks: "What are the employee holidays?"

1. Client calls MCP `queryAnswers` (or `querySearch` → `queryRetrieve`).
2. Server checks auth and forwards the request to eGain.
3. Response returns an answer plus references and scores, for example:

```json
{
  "answer": {
    "answerType": "extractive",
    "answerValue": "The holidays for the year 2026 are New Year's Day, Thanksgiving, and Christmas."
  }
}
```

See `README.md` for installation and configuration. Learn more in the MCP Guide: [eGain MCP](https://apidev.egain.com/developer-portal/guides/mcp/mcp/).
