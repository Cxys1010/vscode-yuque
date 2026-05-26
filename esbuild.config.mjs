import * as esbuild from "esbuild";
import { readFileSync } from "fs";

const watch = process.argv.includes("--watch");

/** @type {esbuild.BuildOptions} */
const base = {
  bundle: true,
  platform: "node",
  target: "node18",
  format: "cjs",
  sourcemap: true,
  external: [
    "vscode",           // provided by VSCode host
  ],
  tsconfig: "tsconfig.json",
};

const extensionConfig = {
  ...base,
  entryPoints: ["src/extension.ts"],
  outfile: "dist/extension.js",
};

const mcpConfig = {
  ...base,
  entryPoints: ["src/cli.ts"],
  outfile: "dist/cli.js",
  banner: {
    js: "#!/usr/bin/env node",
  },
};

async function build() {
  try {
    await Promise.all([
      esbuild.build(extensionConfig),
      esbuild.build(mcpConfig),
    ]);
    // Make cli.js executable on Unix
    const cliPath = "dist/cli.js";
    try {
      const { chmod } = await import("fs/promises");
      await chmod(cliPath, 0o755);
    } catch { /* not fatal on Windows */ }
    console.log("Build complete: extension.js + cli.js");
  } catch (err) {
    console.error("Build failed:", err);
    process.exit(1);
  }
}

if (watch) {
  const ctx = await Promise.all([
    esbuild.context(extensionConfig),
    esbuild.context(mcpConfig),
  ]);
  await Promise.all(ctx.map(c => c.watch()));
  console.log("Watching for changes...");
} else {
  build();
}
