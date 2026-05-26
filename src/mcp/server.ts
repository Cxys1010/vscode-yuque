/** MCP Server setup */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAllTools } from "./tools/index";
import { YuqueWorkspace } from "../api/yuque/workspace";
import { YuqueClient } from "../api/yuque/client";
import { createAuthProvider } from "../api/yuque/auth";
import { logger } from "../api/shared/logger";
import type { ICloudWorkspace } from "../api/shared/workspace";

export interface McpConfig {
  yuqueToken?: string;
  yuqueBaseUrl?: string;
}

export async function startMcpServer(config: McpConfig = {}): Promise<void> {
  const workspaces: ICloudWorkspace[] = [];

  // Set up Yuque workspace if credentials are available
  const auth = createAuthProvider(config.yuqueToken, config.yuqueBaseUrl);
  if (auth.isConfigured() || config.yuqueToken) {
    const client = new YuqueClient(auth);
    const ws = new YuqueWorkspace(client);

    try {
      const user = await ws.getUser();
      workspaces.push(ws);
      logger.info("Yuque connected", { login: user.login, name: user.name });
    } catch (err) {
      logger.error("Failed to connect to Yuque", { error: (err as Error).message });
      // Don't add workspace if auth fails
    }
  }

  if (workspaces.length === 0) {
    logger.error("No cloud workspaces configured. Set up Yuque credentials first.");
    console.error(
      "No cloud workspaces configured.\n" +
      "Run 'Cloud Notes: Setup Yuque Credentials' in VSCode or set environment variables.\n" +
      "The MCP server will start but no tools are available.",
    );
  }

  const server = new McpServer({
    name: "cloud-notes",
    version: "0.1.0",
  });

  registerAllTools(server, workspaces);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info("MCP server started", {
    platforms: workspaces.map(w => w.platform),
    toolCount: workspaces.length * 8, // 8 tools per platform
  });
}
