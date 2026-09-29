// PostToolUse (Write): formatea con Prettier y ESLint --fix el archivo creado.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

let raw = "";
for await (const chunk of process.stdin) raw += chunk;

const input = JSON.parse(raw || "{}");
const file = input.tool_response?.filePath ?? input.tool_input?.file_path;
const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();

if (!file || !existsSync(file)) process.exit(0);
// Solo archivos dentro de este proyecto, sin node_modules/.next
const rel = path.relative(root, file);
if (rel.startsWith("..") || /(^|\/)(node_modules|\.next)\//.test(rel)) process.exit(0);

const run = (bin, args) => {
  try {
    execFileSync(path.join(root, "node_modules/.bin", bin), args, { cwd: root, stdio: "pipe" });
  } catch (e) {
    process.stderr.write(`${bin}: ${e.stdout ?? ""}${e.stderr ?? ""}`);
  }
};

run("prettier", ["--write", "--ignore-unknown", file]);
if (/\.(jsx?|tsx?|mjs|cjs)$/.test(file)) run("eslint", ["--fix", file]);
