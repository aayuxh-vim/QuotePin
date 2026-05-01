import fs from "fs";
import { spawnSync } from "child_process";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const cwd = process.cwd();
const text = fs.readFileSync(`${cwd}/.env.local`, "utf8");
const vars = {};
for (const line of text.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  let v = m[2].trim();
  if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
  vars[m[1]] = v;
}

async function main() {
  const keys = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"];
  for (const target of ["production", "preview"]) {
    for (const key of keys) {
      const val = vars[key];
      if (!val) {
        console.error(`Missing ${key} in .env.local`);
        process.exit(1);
      }
      const r = spawnSync(
        "vercel",
        ["env", "add", key, target, "--value", val, "--yes", "--force", "--non-interactive"],
        { cwd, stdio: "inherit", shell: true }
      );
      if (r.status !== 0) process.exit(r.status ?? 1);
      await sleep(2000);
    }
  }
  console.log("Done.");
}

main();
