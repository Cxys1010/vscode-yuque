/** Unified cloud workspace interface — Yuque, Notion, SiYuan all implement this */
export interface DocSummary {
  id: string;
  title: string;
  slug: string;
  updatedAt: string;
  url: string;
}

export interface DocDetail extends DocSummary {
  body: string;
  format: "markdown";
  version: string;
}

export interface Workspace {
  id: string;
  name: string;
  namespace: string;
  type: "personal" | "team";
}

export interface CreateDocParams {
  title: string;
  body: string;
}

export interface UpdateDocParams {
  body: string;
  expectedVersion: string;
  title?: string;
}

export interface AppendDocParams {
  content: string;
  expectedVersion: string;
  separator?: string;
}

export interface TocNode {
  uuid: string;
  title: string;
  url: string;
  slug: string;
  level: number;
  children: string[];
}

export interface ICloudWorkspace {
  readonly platform: string;
  getUser(): Promise<{ login: string; name: string; avatar?: string }>;
  listWorkspaces(): Promise<Workspace[]>;
  listDocs(namespace: string): Promise<DocSummary[]>;
  getDoc(namespace: string, slug: string): Promise<DocDetail>;
  createDoc(namespace: string, params: CreateDocParams): Promise<DocDetail>;
  updateDoc(namespace: string, slug: string, params: UpdateDocParams): Promise<DocDetail>;
  appendDoc(namespace: string, slug: string, params: AppendDocParams): Promise<DocDetail>;
  deleteDoc(namespace: string, slug: string): Promise<void>;
  search(query: string): Promise<DocSummary[]>;
  getToc?(namespace: string): Promise<TocNode[]>;
}
