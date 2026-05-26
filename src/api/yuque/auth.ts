/** Auth providers for Yuque — Cookie (free users) + Token (super members, reserved) */
import { loadCredentials, YuqueCredentials } from "../shared/config";
import { NotConfiguredError } from "../shared/errors";

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
};

export interface YuqueAuthProvider {
  buildHeaders(extra?: Record<string, string>): Record<string, string>;
  getBaseUrl(): string;
  isConfigured(): boolean;
}

/** Cookie-based auth for free users. Cookies loaded fresh on each call (hot-reload). */
export class CookieAuthProvider implements YuqueAuthProvider {
  private baseUrl: string;

  constructor(baseUrl = "https://www.yuque.com") {
    this.baseUrl = baseUrl;
  }

  isConfigured(): boolean {
    return loadCredentials() !== null;
  }

  private getCreds(): YuqueCredentials {
    const creds = loadCredentials();
    if (!creds) throw new NotConfiguredError("Yuque");
    return creds;
  }

  buildHeaders(extra?: Record<string, string>): Record<string, string> {
    const c = this.getCreds();
    return {
      "Cookie": c.cookieHeader,
      "x-csrf-token": c.csrfToken,
      "Referer": `${this.baseUrl}/`,
      "Origin": this.baseUrl,
      ...BROWSER_HEADERS,
      ...extra,
    };
  }

  getBaseUrl(): string { return this.baseUrl; }
}

/** Token-based auth for super members (reserved for future use). */
export class TokenAuthProvider implements YuqueAuthProvider {
  private apiBase = "https://www.yuque.com/api/v2";

  constructor(private token: string) {}

  isConfigured(): boolean { return !!this.token; }

  buildHeaders(extra?: Record<string, string>): Record<string, string> {
    return {
      "X-Auth-Token": this.token,
      "Content-Type": "application/json",
      "User-Agent": "vscode-yuque",
      ...extra,
    };
  }

  getBaseUrl(): string { return this.apiBase; }
}

export function createAuthProvider(token?: string, baseUrl?: string): YuqueAuthProvider {
  if (token) return new TokenAuthProvider(token);
  return new CookieAuthProvider(baseUrl);
}
