/** Yuque internal API response types (cookie-based, no Super Membership required) */

export interface YuqueUser {
  id: number;
  login: string;
  name: string;
  avatar_url?: string;
  description?: string | null;
}

export interface YuqueBook {
  id: number;
  type: "Book" | "Design" | "Column";
  slug: string;
  name: string;
  user_id: number;
  description: string | null;
  items_count: number;
  public: number;
  created_at: string;
  updated_at: string;
  creator_id: number;
}

export interface YuqueDocSummary {
  id: number;
  title: string;
  slug: string;
  book_id: number;
  user_id: number;
  last_editor_id: number;
  description: string | null;
  format: string;
  status: number;
  public: number;
  content_updated_at: string;
  created_at: string;
  updated_at: string;
}

export interface YuqueDocDetail extends YuqueDocSummary {
  body: string;
  body_asl: string;
  body_draft: string;
  body_draft_asl: string;
  content: string;       // Lake HTML content (for lake-format docs)
  cover: string | null;
  custom_description: string | null;
  word_count?: number;
  draft_version: number;
  read_status: number;
  view_status: number;
}

export interface YuqueTocNode {
  type: "TITLE" | "DOC";
  title: string;
  uuid: string;
  url: string | null;
  prev_uuid: string | null;
  sibling_uuid: string | null;
  child_uuid: string | null;
  parent_uuid: string | null;
  doc_id: number | null;
  level: number;
  id: number | null;
  open_window: number;
  visible: number;
}

export interface YuqueSearchResult {
  id: number;
  title: string;
  slug: string;
  summary: string;
  book: { id: number; name: string; slug: string };
  created_at: string;
  updated_at: string;
}

// ── Request types ────────────────────────────────────

export interface CreateDocRequest {
  title: string;
  body: string;
  book_id: number;
  format?: "markdown" | "lake" | "html";
  slug?: string;
  public?: number;
}

export interface UpdateDocRequest {
  title?: string;
  body?: string;
  book_id: number;
  format?: "markdown" | "lake" | "html";
  public?: number;
}

// ── API Response wrapper ──────────────────────────────

export interface ApiResponse<T> {
  data: T;
  meta?: Record<string, unknown>;
  abilities?: Record<string, boolean>;
}

export interface TocResponse {
  data: { toc: YuqueTocNode[] };
}
