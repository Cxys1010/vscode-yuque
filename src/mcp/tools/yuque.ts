/** Register all Yuque MCP tools on a McpServer */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ICloudWorkspace } from "../../api/shared/workspace";
import { VersionConflictError, FatalAuthError, NotConfiguredError } from "../../api/shared/errors";

export function registerWorkspaceTools(server: McpServer, ws: ICloudWorkspace) {
  const prefix = ws.platform;

  // ─── list_workspaces ──────────────────────────────
  server.tool(
    `${prefix}_list_workspaces`,
    `List all ${prefix} knowledge bases / workspaces. Returns id, name, namespace, and type for each.`,
    {
      type: z.enum(["personal", "team", "all"]).optional().default("all")
        .describe("Filter by workspace type"),
    },
    async ({ type }) => {
      const all = await ws.listWorkspaces();
      const filtered = type === "all" ? all : all.filter(w => w.type === type);
      return {
        content: [{ type: "text", text: JSON.stringify(filtered, null, 2) }],
      };
    },
  );

  // ─── list_docs ────────────────────────────────────
  server.tool(
    `${prefix}_list_docs`,
    `List all documents in a ${prefix} knowledge base. The namespace is like 'username/repo-slug'.`,
    {
      namespace: z.string().describe("Knowledge base namespace, e.g. 'my-team/my-wiki'"),
    },
    async ({ namespace }) => {
      const docs = await ws.listDocs(namespace);
      return {
        content: [{ type: "text", text: JSON.stringify(docs, null, 2) }],
      };
    },
  );

  // ─── get_doc ──────────────────────────────────────
  server.tool(
    `${prefix}_get_doc`,
    `Get the full content of a ${prefix} document as Markdown. ` +
    `The returned 'version' field (updatedAt timestamp) MUST be saved for conflict detection when updating.`,
    {
      namespace: z.string().describe("Knowledge base namespace"),
      slug: z.string().describe("Document slug from the URL"),
    },
    async ({ namespace, slug }) => {
      const doc = await ws.getDoc(namespace, slug);
      return {
        content: [{ type: "text", text: JSON.stringify({
          title: doc.title,
          slug: doc.slug,
          namespace,
          updatedAt: doc.updatedAt,
          version: doc.version,
          url: doc.url,
          format: "markdown",
          body: doc.body,
        }, null, 2) }],
      };
    },
  );

  // ─── create_doc ───────────────────────────────────
  server.tool(
    `${prefix}_create_doc`,
    `Create a new ${prefix} document. The body must be valid Markdown.`,
    {
      namespace: z.string().describe("Knowledge base namespace"),
      title: z.string().describe("Document title"),
      body: z.string().describe("Document content in Markdown format"),
    },
    async ({ namespace, title, body }) => {
      const doc = await ws.createDoc(namespace, { title, body });
      return {
        content: [{ type: "text", text: JSON.stringify({
          status: "created",
          title: doc.title,
          slug: doc.slug,
          url: doc.url,
        }, null, 2) }],
      };
    },
  );

  // ─── update_doc ───────────────────────────────────
  server.tool(
    `${prefix}_update_doc`,
    `Replace the ENTIRE content of a ${prefix} document. ` +
    `⚠️ CRITICAL: This is a FULL replacement. You MUST: ` +
    `1. First call ${prefix}_get_doc to read the current content ` +
    `2. Copy the 'version' field from the response ` +
    `3. Make your edits to the body ` +
    `4. Pass the original 'version' as 'expectedVersion' ` +
    `If the document was modified by someone else since you read it, the update will be REJECTED with VERSION_CONFLICT. ` +
    `For short documents this is fine. For appending content to long docs, use ${prefix}_append_doc instead.`,
    {
      namespace: z.string().describe("Knowledge base namespace"),
      slug: z.string().describe("Document slug"),
      body: z.string().describe("COMPLETE new document content in Markdown. Must include ALL content, not just changes."),
      expectedVersion: z.string().describe("The 'version' field from your last ${prefix}_get_doc call. Used to detect conflicts."),
      title: z.string().optional().describe("Optional new title"),
    },
    async ({ namespace, slug, body, expectedVersion, title }) => {
      try {
        const doc = await ws.updateDoc(namespace, slug, { body, expectedVersion, title });
        return { content: [{ type: "text", text: JSON.stringify({
          status: "updated",
          title: doc.title,
          slug: doc.slug,
          url: doc.url,
          newVersion: doc.version,
        }, null, 2) }] };
      } catch (err) {
        if (err instanceof VersionConflictError) {
          return { content: [{ type: "text", text: JSON.stringify({
            error: "VERSION_CONFLICT",
            message: "Document was modified since you last read it. Please call get_doc again to get the latest version, then re-apply your changes.",
            remoteVersion: err.remoteVersion,
            yourVersion: err.expectedVersion,
          }, null, 2) }] };
        }
        throw err;
      }
    },
  );

  // ─── append_doc ───────────────────────────────────
  server.tool(
    `${prefix}_append_doc`,
    `Append content to the END of a ${prefix} document. ` +
    `Use this instead of update_doc when adding new sections, logs, or summaries to a long document. ` +
    `This reads the current content, appends your new content, and writes back — all in one operation. ` +
    `Still requires expectedVersion for conflict detection.`,
    {
      namespace: z.string().describe("Knowledge base namespace"),
      slug: z.string().describe("Document slug"),
      content: z.string().describe("Content to append in Markdown format"),
      expectedVersion: z.string().describe("The 'version' field from get_doc"),
      separator: z.string().optional().default("\n\n").describe("Text inserted between old and new content"),
    },
    async ({ namespace, slug, content, expectedVersion, separator }) => {
      try {
        const doc = await ws.appendDoc(namespace, slug, { content, expectedVersion, separator });
        return { content: [{ type: "text", text: JSON.stringify({
          status: "appended",
          title: doc.title,
          slug: doc.slug,
          newVersion: doc.version,
        }, null, 2) }] };
      } catch (err) {
        if (err instanceof VersionConflictError) {
          return { content: [{ type: "text", text: JSON.stringify({
            error: "VERSION_CONFLICT",
            message: "Document was modified since last read. Call get_doc to get the latest version and retry.",
          }, null, 2) }] };
        }
        throw err;
      }
    },
  );

  // ─── delete_doc ───────────────────────────────────
  server.tool(
    `${prefix}_delete_doc`,
    `Delete a ${prefix} document. This is IRREVERSIBLE.`,
    {
      namespace: z.string().describe("Knowledge base namespace"),
      slug: z.string().describe("Document slug"),
    },
    async ({ namespace, slug }) => {
      await ws.deleteDoc(namespace, slug);
      return {
        content: [{ type: "text", text: JSON.stringify({ status: "deleted", namespace, slug }, null, 2) }],
      };
    },
  );

  // ─── get_toc ──────────────────────────────────────
  server.tool(
    `${prefix}_get_toc`,
    `Get the full table of contents (document tree) for a ${prefix} knowledge base. ` +
    `Returns a tree structure with uuid, title, slug, level, and children.`,
    {
      namespace: z.string().describe("Knowledge base namespace"),
    },
    async ({ namespace }) => {
      if (!ws.getToc) {
        return { content: [{ type: "text", text: JSON.stringify({ error: "TOC not supported for this platform" }) }] };
      }
      const toc = await ws.getToc(namespace);
      return { content: [{ type: "text", text: JSON.stringify(toc, null, 2) }] };
    },
  );

  // ─── search ───────────────────────────────────────
  server.tool(
    `${prefix}_search`,
    `Search for ${prefix} documents by keyword.`,
    {
      query: z.string().describe("Search query"),
    },
    async ({ query }) => {
      const results = await ws.search(query);
      return {
        content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
      };
    },
  );

  // ─── get_user ─────────────────────────────────────
  server.tool(
    `${prefix}_get_user`,
    `Get the currently authenticated ${prefix} user info. Useful for debugging auth issues.`,
    {},
    async () => {
      const user = await ws.getUser();
      return {
        content: [{ type: "text", text: JSON.stringify(user, null, 2) }],
      };
    },
  );
}
