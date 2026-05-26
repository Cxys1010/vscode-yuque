/** VSCode command handlers */
import * as vscode from "vscode";
import type { ICloudWorkspace, DocSummary } from "../api/shared/workspace";
import { saveCredentials } from "../api/shared/config";

let treeProvider: any = null;

export function setTreeProvider(tp: any): void {
  treeProvider = tp;
}

/** Parse document.cookie string into key-value pairs */
function parseCookieString(cookieStr: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const part of cookieStr.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key) result[key] = rest.join("=");
  }
  return result;
}

// ── Login Webview ────────────────────────────────────
function createLoginWebview(): vscode.WebviewPanel {
  const panel = vscode.window.createWebviewPanel(
    "yuqueLogin", "语雀登录", vscode.ViewColumn.One,
    { enableScripts: true, retainContextWhenHidden: true },
  );

  panel.webview.html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';
             frame-src https://www.yuque.com;">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); }
    .container { display:flex; height:100vh; }
    .iframe-panel { flex:1; }
    .iframe-panel iframe { width:100%; height:100%; border:none; }
    .sidebar { width:340px; padding:24px; border-left:1px solid var(--vscode-panel-border); display:flex; flex-direction:column; gap:16px; }
    .sidebar h2 { font-size:18px; }
    .sidebar p { font-size:13px; color:var(--vscode-descriptionForeground); line-height:1.6; }
    .sidebar ol { padding-left:18px; font-size:13px; color:var(--vscode-descriptionForeground); line-height:1.8; }
    textarea { width:100%; height:90px; background:var(--vscode-input-background); color:var(--vscode-input-foreground); border:1px solid var(--vscode-input-border); border-radius:4px; padding:8px; font-size:12px; resize:vertical; font-family:monospace; }
    button { padding:8px 16px; background:var(--vscode-button-background); color:var(--vscode-button-foreground); border:none; border-radius:3px; cursor:pointer; font-size:13px; }
    button:hover { background:var(--vscode-button-hoverBackground); }
    input { flex:1; padding:8px; background:var(--vscode-input-background); color:var(--vscode-input-foreground); border:1px solid var(--vscode-input-border); border-radius:3px; font-size:13px; }
    .status { font-size:12px; padding:6px 10px; border-radius:3px; }
    .ok { background:#1a3a1a; color:#4ec94e; }
    .err { background:#3a1a1a; color:#f44; }
  </style>
</head>
<body>
  <div class="container">
    <div class="iframe-panel">
      <iframe src="https://www.yuque.com/login"></iframe>
    </div>
    <div class="sidebar">
      <h2>登录语雀</h2>
      <p><strong>方式一：在左侧页面登录</strong></p>
      <ol>
        <li>在左侧窗口扫码或输密码登录</li>
        <li>登录后按 F12 打开 DevTools</li>
        <li>Console 中输入 <code>document.cookie</code></li>
        <li>复制输出粘贴到下方</li>
      </ol>
      <p style="margin-top:12px;"><strong>方式二：从已有浏览器</strong></p>
      <p>DevTools → Application → Cookies → 分别复制 <code>_yuque_session</code> 和 <code>ctoken</code> 的值</p>
      <textarea id="cookieInput" placeholder="粘贴 document.cookie 或单独填写下方的 Cookie 值"></textarea>
      <div style="display:flex;gap:8px;">
        <input id="loginInput" placeholder="语雀用户名" />
        <button id="saveBtn">保存凭证</button>
      </div>
      <div id="status"></div>
    </div>
  </div>
  <script>
    const vscode = acquireVsCodeApi();
    document.getElementById("saveBtn").addEventListener("click", () => {
      const cookieStr = document.getElementById("cookieInput").value.trim();
      const login = document.getElementById("loginInput").value.trim();
      if (!cookieStr) { showStatus('err','请先粘贴 Cookie'); return; }
      if (!login) { showStatus('err','请输入语雀用户名'); return; }
      vscode.postMessage({ command: "saveCredentials", cookieStr, login });
    });
    function showStatus(cls, msg) {
      document.getElementById("status").innerHTML = '<div class="'+cls+'">'+msg+'</div>';
    }
    window.addEventListener("message", (e) => {
      if (e.data.command === "saved") showStatus("ok","凭证已保存！可关闭此窗口。");
      else if (e.data.command === "error") showStatus("err", e.data.message);
    });
  </script>
</body>
</html>`;

  panel.webview.onDidReceiveMessage(async (msg) => {
    if (msg.command === "saveCredentials") {
      try {
        const cookies = parseCookieString(msg.cookieStr as string);
        const csrfToken = cookies["ctoken"] || cookies["yuque_ctoken"];
        if (!csrfToken) {
          panel.webview.postMessage({ command: "error", message: "未找到 CSRF Token (ctoken / yuque_ctoken)" });
          return;
        }
        await saveCredentials({ cookieHeader: msg.cookieStr as string, csrfToken, login: msg.login as string });
        panel.webview.postMessage({ command: "saved" });
        vscode.window.showInformationMessage("语雀凭证已保存！");
        treeProvider?.refresh();
      } catch (err) {
        panel.webview.postMessage({ command: "error", message: (err as Error).message });
      }
    }
  });

  return panel;
}

// ── Register all commands ────────────────────────────
export function registerCommands(
  context: vscode.ExtensionContext,
  workspaces: () => ICloudWorkspace[],
): void {
  // Login
  context.subscriptions.push(
    vscode.commands.registerCommand("cloudNotes.loginYuque", () => createLoginWebview()),
    vscode.commands.registerCommand("cloudNotes.setupYuque", () => vscode.commands.executeCommand("cloudNotes.loginYuque")),
  );

  // Refresh
  context.subscriptions.push(
    vscode.commands.registerCommand("cloudNotes.refresh", () => treeProvider?.refresh()),
  );

  // Open Note → open in browser
  context.subscriptions.push(
    vscode.commands.registerCommand("cloudNotes.openNote", (data: DocSummary) => {
      if (data.url) vscode.env.openExternal(vscode.Uri.parse(data.url));
    }),
  );

  // Open in Browser
  context.subscriptions.push(
    vscode.commands.registerCommand("cloudNotes.openInBrowser", async (data: any) => {
      const url = data?.url || (data?.namespace ? `https://www.yuque.com/${data.namespace}/${data.slug}` : "");
      if (url) await vscode.env.openExternal(vscode.Uri.parse(url));
    }),
  );

  // Create Note
  context.subscriptions.push(
    vscode.commands.registerCommand("cloudNotes.createNote", async (repoNode: { data: { namespace: string } }) => {
      const ws = workspaces().find(w => w.platform === "yuque");
      if (!ws) return;
      const title = await vscode.window.showInputBox({ prompt: "New document title", placeHolder: "My New Note" });
      if (!title) return;
      try {
        const doc = await ws.createDoc(repoNode.data.namespace, { title, body: `# ${title}\n\n` });
        vscode.window.showInformationMessage(`Created: ${doc.title}`);
        treeProvider?.refresh();
        vscode.env.openExternal(vscode.Uri.parse(doc.url));
      } catch (err) {
        vscode.window.showErrorMessage(`Create failed: ${(err as Error).message}`);
      }
    }),
  );

  // Delete Note
  context.subscriptions.push(
    vscode.commands.registerCommand("cloudNotes.deleteNote", async (docNode: { data: DocSummary; namespace: string }) => {
      const ws = workspaces().find(w => w.platform === "yuque");
      if (!ws) return;
      const confirm = await vscode.window.showWarningMessage(
        `Delete "${docNode.data.title}"?`, { modal: true }, "Delete",
      );
      if (confirm !== "Delete") return;
      try {
        await ws.deleteDoc(docNode.namespace, docNode.data.slug);
        vscode.window.showInformationMessage(`Deleted: ${docNode.data.title}`);
        treeProvider?.refresh();
      } catch (err) {
        vscode.window.showErrorMessage(`Delete failed: ${(err as Error).message}`);
      }
    }),
  );

  // Copy Link
  context.subscriptions.push(
    vscode.commands.registerCommand("cloudNotes.copyLink", async (data: any) => {
      const url = data?.url || (data?.namespace ? `https://www.yuque.com/${data.namespace}/${data.slug}` : "");
      if (url) { await vscode.env.clipboard.writeText(url); vscode.window.showInformationMessage("Link copied"); }
    }),
  );

  // Configure MCP
  context.subscriptions.push(
    vscode.commands.registerCommand("cloudNotes.configureMcp", async () => {
      const config = JSON.stringify({
        mcpServers: { "cloud-notes": { command: "node", args: [context.asAbsolutePath("dist/cli.js")] } },
      }, null, 2);

      const choice = await vscode.window.showQuickPick(
        [
          { label: ".claude/settings.json", description: "Project-level Claude Code settings" },
          { label: ".vscode/mcp.json", description: "VSCode MCP configuration" },
        ],
        { placeHolder: "Where to save MCP configuration?" },
      );
      if (!choice) return;

      const folders = vscode.workspace.workspaceFolders;
      if (!folders) { vscode.window.showErrorMessage("No workspace open."); return; }

      const { writeFile } = await import("fs/promises");
      const path = await import("path");
      await writeFile(path.join(folders[0].uri.fsPath, choice.label), config, "utf-8");
      vscode.window.showInformationMessage(`MCP config written to ${choice.label}`);
    }),
  );
}
