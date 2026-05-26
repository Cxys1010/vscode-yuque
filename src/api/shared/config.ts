/** Credential config: reads/writes ~/.yuque-mcp-auth.json */
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export interface YuqueCredentials {
  /** Raw cookie header value (e.g. "_yuque_session=xxx; ctoken=yyy") */
  cookieHeader: string;
  /** CSRF token (from ctoken or yuque_ctoken cookie) */
  csrfToken: string;
  /** Yuque username/login */
  login: string;
}

const AUTH_FILE = path.join(os.homedir(), ".yuque-mcp-auth.json");

export function loadCredentials(): YuqueCredentials | null {
  try {
    const raw = fs.readFileSync(AUTH_FILE, "utf-8");
    const data = JSON.parse(raw) as YuqueCredentials;
    if (!data.cookieHeader || !data.csrfToken) return null;
    return data;
  } catch { return null; }
}

export async function saveCredentials(creds: YuqueCredentials): Promise<void> {
  const { writeFile } = await import("fs/promises");
  await writeFile(AUTH_FILE, JSON.stringify(creds, null, 2), { mode: 0o600 });
}

export function getAuthFilePath(): string { return AUTH_FILE; }
