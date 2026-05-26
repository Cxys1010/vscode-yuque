/** YuqueWorkspace — implements ICloudWorkspace for Yuque (internal API, cookie auth) */
import type { ICloudWorkspace, Workspace, DocSummary, DocDetail, CreateDocParams, UpdateDocParams, AppendDocParams, TocNode } from "../shared/workspace";
import { VersionConflictError } from "../shared/errors";
import { YuqueClient } from "./client";
import { extractMarkdown } from "./lake";
import type { YuqueDocDetail } from "./types";

export class YuqueWorkspace implements ICloudWorkspace {
  readonly platform = "yuque";
  private bookIdCache = new Map<string, number>(); // namespace -> book_id

  constructor(private client: YuqueClient) {}

  async getUser(): Promise<{ login: string; name: string; avatar?: string }> {
    const u = await this.client.getUser();
    return { login: u.login, name: u.name, avatar: u.avatar_url };
  }

  async listWorkspaces(): Promise<Workspace[]> {
    const books = await this.client.listBooks();
    return books.map(b => {
      const ns = `${b.type === "Book" ? "book" : "design"}/${b.id}`;
      this.bookIdCache.set(ns, b.id);
      return {
        id: String(b.id),
        name: b.name,
        namespace: ns,
        type: b.type === "Book" ? "personal" : "team",
      };
    });
  }

  private parseBookId(namespace: string): number {
    const cached = this.bookIdCache.get(namespace);
    if (cached) return cached;
    // namespace format: "book/74007832"
    const parts = namespace.split("/");
    if (parts.length >= 2) {
      const id = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(id)) return id;
    }
    throw new Error(`Invalid namespace: ${namespace}. Expected format: 'book/{id}'`);
  }

  async listDocs(namespace: string): Promise<DocSummary[]> {
    const bookId = this.parseBookId(namespace);
    const docs = await this.client.listDocs(bookId);
    return docs.map(d => ({
      id: String(d.id),
      title: d.title,
      slug: d.slug,
      updatedAt: d.content_updated_at || d.updated_at,
      url: `https://www.yuque.com/${bookId}/${d.slug}`,
    }));
  }

  private docToDetail(doc: YuqueDocDetail, bookId: number): DocDetail {
    return {
      id: String(doc.id),
      title: doc.title,
      slug: doc.slug,
      updatedAt: doc.content_updated_at || doc.updated_at,
      url: `https://www.yuque.com/${bookId}/${doc.slug}`,
      body: extractMarkdown(doc),
      format: "markdown",
      version: doc.content_updated_at || doc.updated_at,
    };
  }

  async getDoc(namespace: string, slug: string): Promise<DocDetail> {
    // We need to find the doc_id from the slug first
    const bookId = this.parseBookId(namespace);
    const docs = await this.client.listDocs(bookId);
    const found = docs.find(d => d.slug === slug);
    if (!found) throw new Error(`Document not found: ${namespace}/${slug}`);

    const doc = await this.client.getDoc(found.id, bookId);
    return this.docToDetail(doc, bookId);
  }

  async createDoc(namespace: string, params: CreateDocParams): Promise<DocDetail> {
    const bookId = this.parseBookId(namespace);
    // Step 1: Create the document
    const doc = await this.client.createDoc({
      title: params.title,
      body: params.body,
      book_id: bookId,
      format: "markdown",
    });
    // Step 2: Immediately update to add the doc to the book's TOC
    // (internal API requires an update after create for TOC registration)
    const updated = await this.client.updateDoc(doc.id, {
      title: params.title,
      body: params.body,
      book_id: bookId,
      format: "markdown",
    });
    return this.docToDetail(updated, bookId);
  }

  async updateDoc(namespace: string, slug: string, params: UpdateDocParams): Promise<DocDetail> {
    const bookId = this.parseBookId(namespace);

    // Find doc by slug
    const docs = await this.client.listDocs(bookId);
    const found = docs.find(d => d.slug === slug);
    if (!found) throw new Error(`Document not found: ${namespace}/${slug}`);

    // Optimistic locking check
    const current = await this.client.getDoc(found.id, bookId);
    const currentVersion = current.content_updated_at || current.updated_at;
    if (currentVersion !== params.expectedVersion) {
      throw new VersionConflictError(currentVersion, params.expectedVersion);
    }

    const doc = await this.client.updateDoc(found.id, {
      title: params.title,
      body: params.body,
      book_id: bookId,
      format: "markdown",
    });
    return this.docToDetail(doc, bookId);
  }

  async appendDoc(namespace: string, slug: string, params: AppendDocParams): Promise<DocDetail> {
    const bookId = this.parseBookId(namespace);

    const docs = await this.client.listDocs(bookId);
    const found = docs.find(d => d.slug === slug);
    if (!found) throw new Error(`Document not found: ${namespace}/${slug}`);

    const current = await this.client.getDoc(found.id, bookId);
    const currentVersion = current.content_updated_at || current.updated_at;
    if (currentVersion !== params.expectedVersion) {
      throw new VersionConflictError(currentVersion, params.expectedVersion);
    }

    const sep = params.separator || "\n\n";
    const newBody = extractMarkdown(current) + sep + params.content;

    const doc = await this.client.updateDoc(found.id, {
      body: newBody,
      book_id: bookId,
      format: "markdown",
    });
    return this.docToDetail(doc, bookId);
  }

  async deleteDoc(namespace: string, slug: string): Promise<void> {
    const bookId = this.parseBookId(namespace);
    const docs = await this.client.listDocs(bookId);
    const found = docs.find(d => d.slug === slug);
    if (!found) throw new Error(`Document not found: ${namespace}/${slug}`);
    await this.client.deleteDoc(found.id, bookId);
  }

  async search(query: string): Promise<DocSummary[]> {
    const results = await this.client.search(query);
    return results.map(r => ({
      id: String(r.id),
      title: r.title,
      slug: r.slug,
      updatedAt: r.updated_at,
      url: `https://www.yuque.com/${r.book_id}/${r.slug}`,
    }));
  }

  async getToc(namespace: string): Promise<TocNode[]> {
    const bookId = this.parseBookId(namespace);
    const toc = await this.client.getToc(bookId);
    return toc.map(n => ({
      uuid: n.uuid,
      title: n.title,
      url: n.url || "",
      slug: n.url || "",
      level: n.level,
      children: n.child_uuid ? [n.child_uuid] : [],
    }));
  }
}
