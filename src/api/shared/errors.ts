/**
 * Typed error classes for the Yuque API client.
 * Used by both the VSCode extension and MCP server.
 */

export class YuqueApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(`Yuque API error ${status}: ${message}`);
    this.name = "YuqueApiError";
  }
}

export class FatalAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FatalAuthError";
  }
}

export class VersionConflictError extends Error {
  constructor(public readonly remoteVersion: string, public readonly expectedVersion: string) {
    super(`Document was modified remotely. Re-read the latest content and try again.`);
    this.name = "VersionConflictError";
  }
}

export class NotConfiguredError extends Error {
  constructor(platform: string) {
    super(`${platform} credentials not configured. Run setup command first.`);
    this.name = "NotConfiguredError";
  }
}
