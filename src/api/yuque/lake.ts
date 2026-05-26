/** Lake JSON AST ⇄ Markdown converter */
// Lake format is Yuque's proprietary JSON-based document format.
// This module converts between Lake and Markdown.
// Full spec: https://www.yuque.com/yuque/developer/lt69uo

interface LakeInlineNode {
  type: string;
  text?: string;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
}

interface LakeBlockNode {
  type: string;
  content?: LakeInlineNode[] | LakeBlockNode[];
  attrs?: Record<string, unknown>;
}

interface LakeDoc {
  type: "doc";
  content: LakeBlockNode[];
}

export function lakeToMarkdown(doc: LakeDoc): string {
  if (!doc || !doc.content) return "";
  return doc.content.map(blockToMarkdown).join("\n\n");
}

function blockToMarkdown(node: LakeBlockNode): string {
  switch (node.type) {
    case "paragraph":
      return inlinesToMarkdown((node.content || []) as LakeInlineNode[]);

    case "heading": {
      const level = (node.attrs?.level as number) || 1;
      const prefix = "#".repeat(Math.min(level, 6));
      return `${prefix} ${inlinesToMarkdown((node.content || []) as LakeInlineNode[])}`;
    }

    case "bullet_list":
      return (node.content as LakeBlockNode[] || [])
        .map(item => `- ${listItemToMarkdown(item)}`)
        .join("\n");

    case "ordered_list":
      return (node.content as LakeBlockNode[] || [])
        .map((item, i) => `${i + 1}. ${listItemToMarkdown(item)}`)
        .join("\n");

    case "task_list":
      return (node.content as LakeBlockNode[] || [])
        .map(item => {
          const checked = item.attrs?.checked ? "x" : " ";
          return `- [${checked}] ${listItemToMarkdown(item)}`;
        })
        .join("\n");

    case "code_block": {
      const lang = (node.attrs?.language as string) || "";
      const code = inlinesToMarkdown((node.content || []) as LakeInlineNode[]);
      return `\`\`\`${lang}\n${code}\n\`\`\``;
    }

    case "blockquote":
      return (node.content as LakeBlockNode[] || [])
        .map(b => `> ${blockToMarkdown(b)}`)
        .join("\n\n");

    case "horizontal_rule":
      return "---";

    case "image":
      return `![${node.attrs?.alt || ""}](${node.attrs?.src || ""})`;

    default:
      if (Array.isArray(node.content) && node.content.length > 0 && "type" in (node.content as any[])[0]) {
        return (node.content as LakeBlockNode[]).map(blockToMarkdown).join("\n\n");
      }
      return inlinesToMarkdown((node.content || []) as LakeInlineNode[]);
  }
}

function listItemToMarkdown(node: LakeBlockNode): string {
  const blocks = node.content as LakeBlockNode[] | undefined;
  if (!blocks || blocks.length === 0) return "";
  // First block is the list item text
  const first = blockToMarkdown(blocks[0]);
  if (blocks.length === 1) return first;
  const rest = blocks.slice(1).map(b => `    ${blockToMarkdown(b)}`).join("\n");
  return `${first}\n${rest}`;
}

function inlinesToMarkdown(nodes: LakeInlineNode[]): string {
  return nodes.map(node => {
    let text = node.text || "";

    if (node.type === "hard_break") return "\n";
    if (node.type === "emoji") return node.attrs?.shortname as string || "";

    // Apply marks (bold, italic, code, link, etc.)
    if (node.marks) {
      for (const mark of node.marks) {
        switch (mark.type) {
          case "strong": text = `**${text}**`; break;
          case "em": text = `*${text}*`; break;
          case "code": text = `\`${text}\``; break;
          case "strike": text = `~~${text}~~`; break;
          case "link": text = `[${text}](${mark.attrs?.href || ""})`; break;
          case "underline": text = `<u>${text}</u>`; break;
        }
      }
    }
    return text;
  }).join("");
}

/** Convert Markdown string to Lake HTML format (used for creating/updating docs).
 *  This is a simplified converter — for full fidelity, use Yuque's own conversion. */
export function markdownToLakeHtml(markdown: string): string {
  // For now, use a simple approach: wrap markdown in HTML-friendly format
  // Full Markdown→Lake conversion requires a proper AST parser (remark/unified)
  // This is a stub that will be replaced once Phase 0 confirms the API format.
  return markdown
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n\n/g, "</p><p>")
    .replace(/^/, "<p>")
    .replace(/$/, "</p>");
}

/** Try to extract markdown from a doc response — handles internal API format */
export function extractMarkdown(doc: {
  body?: string;
  content?: string;      // Lake HTML (for lake-format docs)
  body_asl?: string;
  body_html?: string;
  body_lake?: string;
  format?: string;
}): string {
  // If markdown format with body, use directly
  if (doc.body && (doc.format === "markdown" || doc.format === "md")) {
    return doc.body;
  }

  // Lake HTML content → strip HTML tags for plain text, or return as-is
  if (doc.content && doc.content.startsWith("<!doctype lake>")) {
    return lakeHtmlToMarkdown(doc.content);
  }

  // body_asl JSON AST
  const lakeContent = doc.body_asl || doc.body_lake;
  if (lakeContent) {
    try {
      const lakeDoc: LakeDoc = JSON.parse(lakeContent);
      return lakeToMarkdown(lakeDoc);
    } catch { /* fall through */ }
  }

  // Fallback
  return doc.body || doc.body_html || doc.content || "";
}

/** Convert Lake HTML to Markdown — strips tags, preserves structure */
export function lakeHtmlToMarkdown(html: string): string {
  let md = html;

  // Remove DOCTYPE and meta tags
  md = md.replace(/<!doctype[^>]*>/i, "");
  md = md.replace(/<meta[^>]*>/gi, "");

  // Headings: <h1...>text</h1> → # text
  for (let i = 6; i >= 1; i--) {
    const regex = new RegExp(`<h${i}[^>]*>(.*?)</h${i}>`, "gi");
    md = md.replace(regex, (_, text) => `\n${"#".repeat(i)} ${stripTags(text)}\n`);
  }

  // Ordered lists: <ol...><li...>...</li></ol>
  md = md.replace(/<ol[^>]*>(.*?)<\/ol>/gi, (_, inner) => {
    const items = inner.match(/<li[^>]*>(.*?)<\/li>/gi) || [];
    return items.map((item: string, i: number) => `${i + 1}. ${stripTags(item.replace(/<\/?li[^>]*>/gi, ""))}`).join("\n") + "\n";
  });

  // Unordered lists
  md = md.replace(/<ul[^>]*>(.*?)<\/ul>/gi, (_, inner) => {
    const items = inner.match(/<li[^>]*>(.*?)<\/li>/gi) || [];
    return items.map((item: string) => `- ${stripTags(item.replace(/<\/?li[^>]*>/gi, ""))}`).join("\n") + "\n";
  });

  // Task lists
  md = md.replace(/<task[^>]*>(.*?)<\/task>/gi, (_, inner) => {
    const items = inner.match(/<li[^>]*>(.*?)<\/li>/gi) || [];
    return items.map((item: string) => {
      const checked = /checked/i.test(item);
      return `- [${checked ? "x" : " "}] ${stripTags(item.replace(/<\/?li[^>]*>/gi, ""))}`;
    }).join("\n") + "\n";
  });

  // Code blocks
  md = md.replace(/<pre[^>]*><code[^>]*>(.*?)<\/code><\/pre>/gi, (_, code) => `\n\`\`\`\n${stripTags(code)}\n\`\`\`\n`);

  // Inline code
  md = md.replace(/<code[^>]*>(.*?)<\/code>/gi, (_, code) => `\`${stripTags(code)}\``);

  // Strong/Bold
  md = md.replace(/<strong[^>]*>(.*?)<\/strong>/gi, "**$1**");
  md = md.replace(/<b[^>]*>(.*?)<\/b>/gi, "**$1**");

  // Emphasis
  md = md.replace(/<em[^>]*>(.*?)<\/em>/gi, "*$1*");

  // Paragraphs
  md = md.replace(/<p[^>]*>(.*?)<\/p>/gi, "\n$1\n");

  // Line breaks
  md = md.replace(/<br\s*\/?>/gi, "\n");

  // Images
  md = md.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*>/gi, "![$2]($1)");
  md = md.replace(/<img[^>]*src="([^"]*)"[^>]*>/gi, "![]($1)");

  // Links
  md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, "[$2]($1)");

  // Blockquotes
  md = md.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, (_, text) => {
    return text.split("\n").filter((l: string) => l.trim()).map((l: string) => `> ${stripTags(l)}`).join("\n");
  });

  // Tables
  md = md.replace(/<table[^>]*>(.*?)<\/table>/gi, (_, inner) => {
    const rows = inner.match(/<tr[^>]*>(.*?)<\/tr>/gi) || [];
    return rows.map((row: string) => {
      const cells = row.match(/<t[dh][^>]*>(.*?)<\/t[dh]>/gi) || [];
      return "| " + cells.map((c: string) => stripTags(c.replace(/<\/?t[dh][^>]*>/gi, ""))).join(" | ") + " |";
    }).join("\n") + "\n";
  });

  // Remove remaining tags
  md = md.replace(/<[^>]+>/g, "");

  // Decode entities
  md = md.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"");

  // Clean up excessive newlines
  md = md.replace(/\n{3,}/g, "\n\n");

  return md.trim();
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"");
}
