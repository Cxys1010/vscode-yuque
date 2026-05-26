/** Local file logger: ~/.yuque-mcp.log, 5MB rotation, no sensitive data logged */
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const LOG_FILE = path.join(os.homedir(), ".yuque-mcp.log");
const MAX_LOG_SIZE = 5 * 1024 * 1024;

type LogLevel = "INFO" | "ERROR" | "DEBUG";

class Logger {
  private stream: fs.WriteStream | null = null;

  private ensureStream(): fs.WriteStream {
    if (this.stream) return this.stream;
    try {
      const stat = fs.statSync(LOG_FILE);
      if (stat.size > MAX_LOG_SIZE) {
        try { fs.unlinkSync(LOG_FILE + ".old"); } catch { /* */ }
        fs.renameSync(LOG_FILE, LOG_FILE + ".old");
      }
    } catch { /* file doesn't exist */ }
    this.stream = fs.createWriteStream(LOG_FILE, { flags: "a" });
    return this.stream;
  }

  log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    const entry = JSON.stringify({ ts: new Date().toISOString(), level, message, ...data }) + "\n";
    this.ensureStream().write(entry);
  }

  info(msg: string, d?: Record<string, unknown>) { this.log("INFO", msg, d); }
  error(msg: string, d?: Record<string, unknown>) { this.log("ERROR", msg, d); }
  debug(msg: string, d?: Record<string, unknown>) { this.log("DEBUG", msg, d); }
}

export const logger = new Logger();
