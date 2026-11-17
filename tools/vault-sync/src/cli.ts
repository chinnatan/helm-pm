// bun tools/vault-sync/src/cli.ts [--once] [--dry-run]
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { makeClient, supabaseStore } from "./store";
import { runCycle, type Config } from "./sync";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const seed = args.has("--seed");
const need = (k: string) => process.env[k] || (console.error(`ต้องตั้ง env ${k}`), process.exit(2));

const vaultDir = need("VAULT_DIR");
const store = supabaseStore(makeClient(need("SUPABASE_URL"), need("SUPABASE_SERVICE_KEY")), need("WORKSPACE_ID"));
const interval = Number(process.env.POLL_INTERVAL_SEC || 60) * 1000;
const stateDir = process.env.STATE_DIR || join(import.meta.dirname, "..", ".state");
const aliasFile = process.env.ALIAS_FILE || join(import.meta.dirname, "..", "aliases.json");
const config: Config = existsSync(aliasFile)
  ? { customers: {}, features: {}, ...JSON.parse(readFileSync(aliasFile, "utf8")) }
  : { customers: {}, features: {} };

mkdirSync(stateDir, { recursive: true });
const lock = join(stateDir, "lock");
const statePath = join(stateDir, "known-keys.json");

// lock: one runner per machine. ponytail: stale lock after a hard kill must be removed by hand (pid check below only covers same host).
if (existsSync(lock)) {
  const pid = Number(readFileSync(lock, "utf8"));
  let alive = true;
  try { process.kill(pid, 0); } catch { alive = false; }
  if (alive) (console.error(`มี vault-sync รันอยู่แล้ว (pid ${pid})`), process.exit(3));
}
if (!dryRun) {
  writeFileSync(lock, String(process.pid));
  const release = () => { try { rmSync(lock); } catch {} };
  process.on("exit", release);
  for (const s of ["SIGINT", "SIGTERM"]) process.on(s, () => process.exit(0));
}

async function once() {
  const known = new Set<string>(existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) : []);
  try {
    const r = await runCycle({ store, vaultDir, config, dryRun, seed, now: new Date(), knownKeys: known });
    console.log(`[${new Date().toISOString()}] push ${r.pushed} pull ${r.pulled}${dryRun ? " (dry-run)" : ""}`);
    for (const a of r.actions) console.log("  *", a);
    for (const w of r.warnings) console.warn("  WARN", w);
    for (const e of r.errors) console.error("  ERROR", e);
    if (!dryRun) writeFileSync(statePath, JSON.stringify([...r.knownKeys].sort()));
  } catch (e) {
    console.error("รอบซิงก์ล้มเหลว:", e);
  }
}

await once();
while (!args.has("--once") && !dryRun && !seed) {
  await new Promise((r) => setTimeout(r, interval));
  await once();
}
