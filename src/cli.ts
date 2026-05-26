/** MCP Server entry point — launched by Claude Code via stdio */
import { startMcpServer } from "./mcp/server";

const config = {
  yuqueToken: process.env.YUQUE_TOKEN,
  yuqueBaseUrl: process.env.YUQUE_BASE_URL || "https://www.yuque.com",
};

startMcpServer(config).catch((err) => {
  console.error("MCP server fatal error:", err.message);
  process.exit(1);
});
