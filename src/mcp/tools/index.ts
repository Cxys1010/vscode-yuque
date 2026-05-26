import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ICloudWorkspace } from "../../api/shared/workspace";
import { registerWorkspaceTools } from "./yuque";

export function registerAllTools(server: McpServer, workspaces: ICloudWorkspace[]) {
  for (const ws of workspaces) {
    registerWorkspaceTools(server, ws);
  }
}
