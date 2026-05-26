/** TreeDataProvider for the Cloud Notes sidebar */
import * as vscode from "vscode";
import type { TreeNode } from "./models";
import type { ICloudWorkspace, Workspace, DocSummary } from "../../api/shared/workspace";
import { loadCredentials } from "../../api/shared/config";
import { YuqueClient } from "../../api/yuque/client";
import { YuqueWorkspace } from "../../api/yuque/workspace";
import { createAuthProvider } from "../../api/yuque/auth";

export class CloudNotesTreeDataProvider implements vscode.TreeDataProvider<TreeNode> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeNode | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private workspaces: ICloudWorkspace[] = [];
  private initialized = false;

  // Memory cache with 1-minute TTL
  private repoCache: { data: Workspace[]; ts: number } | null = null;
  private docsCache = new Map<string, { data: DocSummary[]; ts: number }>();
  private readonly CACHE_TTL = 60_000; // 1 minute

  private isCacheValid<T>(cached: { ts: number } | null): cached is { data: T; ts: number } {
    return !!cached && (Date.now() - cached.ts) < this.CACHE_TTL;
  }

  async init(): Promise<void> {
    this.initialized = true;
    try {
      const auth = createAuthProvider();
      if (auth.isConfigured()) {
        const client = new YuqueClient(auth);
        const ws = new YuqueWorkspace(client);
        await ws.getUser(); // verify auth
        this.workspaces = [ws];
      }
    } catch {
      this.workspaces = [];
    }
    this.refresh();
  }

  get connected(): boolean { return this.workspaces.length > 0; }

  refresh(): void {
    this.repoCache = null;
    this.docsCache.clear();
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TreeNode): vscode.TreeItem {
    switch (element.kind) {
      case "yuque-root":
        return {
          label: element.connected ? "语雀 (Yuque)" : "语雀 — 未连接",
          collapsibleState: element.connected
            ? vscode.TreeItemCollapsibleState.Expanded
            : vscode.TreeItemCollapsibleState.None,
          iconPath: new vscode.ThemeIcon(element.connected ? "check" : "warning"),
          contextValue: element.connected ? "yuque-connected" : "yuque-disconnected",
        };

      case "repo":
        return {
          label: element.data.name,
          collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
          iconPath: new vscode.ThemeIcon(element.data.type === "personal" ? "book" : "organization"),
          contextValue: "repo",
          tooltip: element.data.namespace,
        };

      case "doc":
        return {
          label: element.data.title,
          collapsibleState: vscode.TreeItemCollapsibleState.None,
          iconPath: new vscode.ThemeIcon("note"),
          contextValue: "doc",
          tooltip: element.data.url,
          command: {
            command: "cloudNotes.openInBrowser",
            title: "Open in Browser",
            arguments: [element.data],
          },
        };

      case "loading":
        return {
          label: element.label,
          collapsibleState: vscode.TreeItemCollapsibleState.None,
          iconPath: new vscode.ThemeIcon("loading~spin"),
        };

      case "error":
        return {
          label: element.label,
          collapsibleState: vscode.TreeItemCollapsibleState.None,
          iconPath: new vscode.ThemeIcon("error"),
          tooltip: element.message,
        };
    }
  }

  async getChildren(element?: TreeNode): Promise<TreeNode[]> {
    // Root → show platforms
    if (!element) {
      if (!this.initialized) return [{ kind: "loading", label: "Initializing..." }];
      return [{ kind: "yuque-root", connected: this.connected }];
    }

    // Yuque root → lazy-load repos
    if (element.kind === "yuque-root") {
      if (!this.connected) return [];
      try {
        if (!this.isCacheValid(this.repoCache)) {
          const ws = this.workspaces[0];
          const repos = await ws.listWorkspaces();
          this.repoCache = { data: repos, ts: Date.now() };
        }
        return this.repoCache!.data.map(r => ({ kind: "repo" as const, data: r }));
      } catch (err) {
        return [{ kind: "error", label: "Failed to load", message: (err as Error).message }];
      }
    }

    // Repo → lazy-load docs
    if (element.kind === "repo") {
      try {
        const ns = element.data.namespace;
        const cached = this.docsCache.get(ns);
        if (!this.isCacheValid(cached)) {
          const ws = this.workspaces[0];
          const docs = await ws.listDocs(ns);
          this.docsCache.set(ns, { data: docs, ts: Date.now() });
        }
        return (this.docsCache.get(ns)!.data).map(d => ({
          kind: "doc" as const, data: d, namespace: element.data.namespace,
        }));
      } catch (err) {
        return [{ kind: "error", label: "Failed to load docs", message: (err as Error).message }];
      }
    }

    return [];
  }

  async getParent(element: TreeNode): Promise<TreeNode | undefined> {
    if (element.kind === "repo") return { kind: "yuque-root", connected: this.connected };
    if (element.kind === "doc" || element.kind === "loading" || element.kind === "error")
      return undefined; // simplify
    return undefined;
  }
}
