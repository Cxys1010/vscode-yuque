/** VSCode Extension activation entry */
import * as vscode from "vscode";
import { CloudNotesTreeDataProvider } from "./ui/treeview/provider";
import { registerCommands, setTreeProvider } from "./ui/commands";
import { YuqueClient } from "./api/yuque/client";
import { YuqueWorkspace } from "./api/yuque/workspace";
import { createAuthProvider } from "./api/yuque/auth";
import type { ICloudWorkspace } from "./api/shared/workspace";
import { logger } from "./api/shared/logger";

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  logger.info("Extension activating");

  // ── Initialize workspaces ────────────────────────
  const workspaces: ICloudWorkspace[] = [];

  try {
    const auth = createAuthProvider();
    if (auth.isConfigured()) {
      const client = new YuqueClient(auth);
      const ws = new YuqueWorkspace(client);
      const user = await ws.getUser();
      workspaces.push(ws);
      logger.info("Yuque workspace initialized", { login: user.login });
    }
  } catch (err) {
    logger.error("Yuque init failed", { error: (err as Error).message });
  }

  const getWorkspaces = (): ICloudWorkspace[] => workspaces;

  // ── TreeView ──────────────────────────────────────
  const treeProvider = new CloudNotesTreeDataProvider();
  setTreeProvider(treeProvider);

  const treeView = vscode.window.createTreeView("cloudNotes.treeView", {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
  });
  context.subscriptions.push(treeView);

  // ── Commands ──────────────────────────────────────
  registerCommands(context, getWorkspaces);

  // ── Auto-init TreeView ────────────────────────────
  await treeProvider.init();

  logger.info("Extension activated", { workspaceCount: workspaces.length });
}

export function deactivate(): void {
  logger.info("Extension deactivated");
}
