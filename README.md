# Cloud Notes for VSCode — 語雀整合工具

在 VSCode 中瀏覽、搜尋語雀知識庫，並透過 **Claude Code** 的 MCP 協定用自然語言讀寫筆記。

## 功能

- **VSCode 側邊欄** — 瀏覽語雀知識庫與文檔樹，點擊即跳轉瀏覽器
- **Claude Code MCP Server** — 10 個 MCP 工具，讓 AI 直接操作語雀筆記
- **Lake 格式轉換** — 自動將語雀內部 Lake HTML 轉換為 Markdown

## 安裝

```bash
git clone https://github.com/chirencheng-btfcd/vscode-yuque.git
cd vscode-yuque
npm install
npm run build
```

## 設定

### 1. 取得語雀憑證

在瀏覽器中登入 [yuque.com](https://www.yuque.com)，開啟 DevTools → Application → Cookies → `www.yuque.com`，找到以下兩個值：

- `_yuque_session`（HttpOnly）
- `ctoken`（或 `yuque_ctoken`）

### 2. 寫入憑證檔

```bash
# 建立 ~/.yuque-mcp-auth.json
echo '{
  "cookieHeader": "_yuque_session=xxx; ctoken=yyy",
  "csrfToken": "yyy",
  "login": "你的語雀使用者名稱"
}' > ~/.yuque-mcp-auth.json
```

> **注意**：此檔案包含敏感資訊，請勿上傳或分享。已加入 `.gitignore`。

### 3. 設定 Claude Code MCP

在專案根目錄建立 `.claude/settings.json`：

```json
{
  "mcpServers": {
    "cloud-notes": {
      "command": "node",
      "args": ["d:/path/to/vscode-yuque/dist/cli.js"]
    }
  }
}
```

或在 VSCode 中執行 `Cloud Notes: Configure MCP for Claude Code` 指令。

## 使用

### Claude Code（MCP）

在 Claude Code 對話中直接說：

- 「幫我列出我的語雀知識庫」
- 「在資料結構知識庫中建立一篇筆記，標題是 01 背包模板」
- 「搜尋語雀中關於圖論的筆記」
- 「在 XXX 文檔末尾追加今天學習的內容」

Claude Code 會自動呼叫對應的 MCP 工具完成操作。

### VSCode 擴展

1. 按 **F5** 啟動 Extension Development Host
2. 側邊欄出現「Cloud Notes」面板
3. 執行 `Cloud Notes: Login to Yuque` 設定憑證
4. 展開知識庫瀏覽文檔，點擊在瀏覽器中開啟

## MCP 工具列表

| 工具名稱 | 功能 |
|---------|------|
| `yuque_list_workspaces` | 列出知識庫 |
| `yuque_list_docs` | 列出文檔 |
| `yuque_get_doc` | 讀取文檔內容（Markdown） |
| `yuque_create_doc` | 建立新文檔 |
| `yuque_update_doc` | 更新文檔（含版本衝突檢測） |
| `yuque_append_doc` | 在文末追加內容 |
| `yuque_delete_doc` | 刪除文檔 |
| `yuque_get_toc` | 獲取知識庫目錄樹 |
| `yuque_search` | 搜尋文檔 |
| `yuque_get_user` | 獲取使用者資訊 |

## 技術棧

- TypeScript + esbuild
- VSCode Extension API（TreeView）
- MCP SDK（@modelcontextprotocol/sdk）
- 原生 fetch（零 HTTP 依賴）

## 授權

MIT License
