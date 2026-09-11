import { build as buildWeb } from "vite";
import { build } from "esbuild";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { createRequire, isBuiltin } from "node:module";
import { resolve, dirname, extname } from "node:path";
import { existsSync } from "node:fs";
import react from "@vitejs/plugin-react";
await buildWeb({
  configFile: false,
  root: "apps/web",
  plugins: [react()],
  build: { outDir: "../../dist/web", emptyOutDir: true },
});
// Resolve through Node rather than native directory scanning; works in restricted Windows workspaces.
const nodeResolver = {
  name: "node-file-resolution",
  setup(builder) {
    builder.onResolve({ filter: /.*/ }, (args) => {
      if (
        isBuiltin(args.path) ||
        ["bufferutil", "utf-8-validate", "supports-color"].includes(args.path)
      )
        return { path: args.path, external: true };
      const base = args.importer ? dirname(args.importer) : process.cwd();
      let path;
      if (args.kind === "entry-point" || args.path.startsWith(".") || args.path.startsWith("/")) {
        const candidate = resolve(base, args.path);
        path = [
          candidate,
          candidate + ".ts",
          candidate + ".tsx",
          candidate + ".js",
          resolve(candidate, "index.ts"),
          resolve(candidate, "index.js"),
        ].find((p) => existsSync(p) && extname(p));
      }
      path ??= createRequire(resolve(base, "package.json")).resolve(args.path);
      return { path, namespace: "node-file" };
    });
    builder.onLoad({ filter: /.*/, namespace: "node-file" }, async (args) => ({
      contents: await readFile(args.path, "utf8"),
      loader: extname(args.path) === ".json" ? "json" : extname(args.path) === ".ts" ? "ts" : "js",
    }));
  },
};
await build({
  entryPoints: ["apps/server/src/index.ts"],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  outfile: "dist/server.cjs",
  plugins: [nodeResolver],
});
await mkdir("dist", { recursive: true });
await writeFile("dist/server.js", 'require("./server.cjs");\n');
await writeFile("dist/web.config", await readFile("deployment/web.config", "utf8"));
await writeFile(
  "dist/package.json",
  JSON.stringify(
    {
      name: "naija-feud-release",
      private: true,
      scripts: { start: "node server.cjs" },
      engines: { node: ">=22.13.0" },
    },
    null,
    2,
  ),
);
