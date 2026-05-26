/** Yuque internal API client (cookie-based auth, no Super Membership required) */
import { YuqueAuthProvider } from "./auth";
import { YuqueApiError, FatalAuthError } from "../shared/errors";
import { logger } from "../shared/logger";
import type {
  YuqueUser, YuqueBook, YuqueDocSummary, YuqueDocDetail,
  YuqueTocNode, CreateDocRequest, UpdateDocRequest, ApiResponse, TocResponse,
} from "./types";

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
const MIN_INTERVAL_MS = 300;

export class YuqueClient {
  private lastRequestTime = 0;

  constructor(private auth: YuqueAuthProvider) {}

  private sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
  }

  private async enforceRateLimit(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestTime;
    if (elapsed < MIN_INTERVAL_MS) {
      await this.sleep(MIN_INTERVAL_MS - elapsed);
    }
  }

  private async request<T>(
    path: string, options?: RequestInit, retryCount = 0,
  ): Promise<T> {
    await this.enforceRateLimit();

    const startTime = Date.now();
    const reqId = Math.random().toString(36).slice(2, 8);
    const method = options?.method || "GET";
    const url = `${this.auth.getBaseUrl()}${path}`;

    logger.debug(`[${reqId}] REQUEST ${method} ${path}`, { retryCount });

    try {
      const res = await fetch(url, {
        ...options,
        headers: {
          ...this.auth.buildHeaders(),
          ...(options?.body ? { "Content-Type": "application/json;charset=UTF-8" } : {}),
          ...options?.headers,
        },
      });
      this.lastRequestTime = Date.now();
      const elapsed = Date.now() - startTime;

      logger.debug(`[${reqId}] RESPONSE ${res.status} (${elapsed}ms)`);

      // 429 → exponential backoff
      if (res.status === 429 && retryCount < MAX_RETRIES) {
        logger.info(`[${reqId}] RATE_LIMITED retry=${retryCount}`);
        await this.sleep(BASE_DELAY_MS * Math.pow(2, retryCount));
        return this.request<T>(path, options, retryCount + 1);
      }

      // 401 → fatal
      if (res.status === 401) {
        logger.error(`[${reqId}] AUTH_EXPIRED`);
        throw new FatalAuthError("Cookie expired. Please re-login to Yuque.");
      }

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new YuqueApiError(res.status, text);
      }

      return res.json() as Promise<T>;
    } catch (err) {
      if (err instanceof FatalAuthError) throw err;
      if (err instanceof YuqueApiError) throw err;

      logger.error(`[${reqId}] FAILED`, { error: (err as Error).message, retryCount });
      if (retryCount < MAX_RETRIES) {
        await this.sleep(BASE_DELAY_MS * Math.pow(2, retryCount));
        return this.request<T>(path, options, retryCount + 1);
      }
      throw err;
    }
  }

  // ─── User ─────────────────────────────────────────
  async getUser(): Promise<YuqueUser> {
    const r = await this.request<ApiResponse<YuqueUser>>("/api/mine");
    return r.data;
  }

  // ─── Books (Knowledge Bases) ──────────────────────
  async listBooks(): Promise<YuqueBook[]> {
    const r = await this.request<ApiResponse<YuqueBook[]>>("/api/mine/books");
    return r.data;
  }

  async getBook(id: number): Promise<YuqueBook> {
    const books = await this.listBooks();
    const book = books.find(b => b.id === id);
    if (!book) throw new YuqueApiError(404, `Book ${id} not found`);
    return book;
  }

  // ─── Docs ─────────────────────────────────────────
  async listDocs(bookId: number): Promise<YuqueDocSummary[]> {
    const r = await this.request<ApiResponse<YuqueDocSummary[]>>(`/api/docs?book_id=${bookId}`);
    return r.data;
  }

  async getDoc(docId: number, bookId: number): Promise<YuqueDocDetail> {
    const r = await this.request<{ data: YuqueDocDetail; meta?: unknown }>(`/api/docs/${docId}?book_id=${bookId}`);
    return r.data;
  }

  async createDoc(params: CreateDocRequest): Promise<YuqueDocDetail> {
    const r = await this.request<ApiResponse<YuqueDocDetail>>("/api/docs", {
      method: "POST",
      body: JSON.stringify({ ...params, format: params.format || "markdown" }),
    });
    return r.data;
  }

  async updateDoc(docId: number, params: UpdateDocRequest): Promise<YuqueDocDetail> {
    const r = await this.request<ApiResponse<YuqueDocDetail>>(`/api/docs/${docId}`, {
      method: "PUT",
      body: JSON.stringify({ ...params, format: params.format || "markdown" }),
    });
    return r.data;
  }

  async deleteDoc(docId: number, bookId: number): Promise<void> {
    await this.request(`/api/docs/${docId}?book_id=${bookId}`, { method: "DELETE" });
  }

  // ─── TOC ──────────────────────────────────────────
  async getToc(bookId: number): Promise<YuqueTocNode[]> {
    const r = await this.request<TocResponse>(`/api/books/${bookId}/toc`);
    return r.data.toc;
  }

  // ─── Search ───────────────────────────────────────
  async search(query: string): Promise<YuqueDocSummary[]> {
    const r = await this.request<ApiResponse<YuqueDocSummary[]>>(
      `/api/search?q=${encodeURIComponent(query)}&type=doc`,
    );
    return r.data;
  }
}
