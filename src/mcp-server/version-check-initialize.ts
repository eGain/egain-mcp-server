/**
 * Wraps the MCP server's initialize handler so that when an update is available,
 * the server responds to the client with an MCP error instead of succeeding.
 * The client (e.g. Claude) can then show the message and not use the server.
 */

import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { checkUpdateAvailable } from "../hooks/version-check-hook.js";

const INITIALIZE_METHOD = "initialize";

/**
 * Wraps the underlying MCP Server's initialize request handler so that if a newer
 * version is available, the server returns an MCP error response to the client
 * (with the update message) instead of completing initialization.
 *
 * Must be called after createMCPServer() and before server.connect(transport).
 */
export function wrapInitializeWithVersionCheck(mcpServer: McpServer): void {
  const lowLevel = (mcpServer as unknown as { server: { _requestHandlers: Map<string, (req: unknown, extra: unknown) => Promise<unknown>> } }).server;
  const handlers = lowLevel._requestHandlers;
  const original = handlers.get(INITIALIZE_METHOD);
  if (!original) return;

  handlers.set(INITIALIZE_METHOD, async (request: unknown, extra: unknown) => {
    const update = await checkUpdateAvailable();
    if (update) {
      throw new McpError(ErrorCode.InvalidRequest, update.message);
    }
    return original(request, extra);
  });
}
