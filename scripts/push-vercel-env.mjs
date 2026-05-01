import fs from "fs";
import { spawnSync } from "child_process";

const cwd = process.cwd();
const path = `${cwd}/.env.local`;
if (!fs.existsSync(path)) {
  console.error("Missing .env.local");
  process.exit(1);
}

const text = fs.readFileSync(path, "utf8");
const vars = {};
for (const line of text.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  vars[m[1]] = v;
}

const keys = [
  "DATABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
];

for (const target of ["production", "preview"]) {
  for (const key of keys) {
    const val = vars[key];
    if (!val) continue;
    if (key === "SUPABASE_SERVICE_ROLE_KEY" && val.startsWith("your-")) continue;
    const r = spawnSync(
      "vercel",
      ["env", "add", key, target, "--value", val, "--yes", "--force", "--non-interactive"],
      { cwd, stdio: "inherit", shell: true }
    );
    if (r.status !== 0) {
      process.exit(r.status ?? 1);
    }
  }
}

console.log("Synced env vars to Vercel (production + preview).");
