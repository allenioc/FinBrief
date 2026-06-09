/**
 * Tiered cache for saved news editions.
 *
 * Read order: in-memory -> KV (Upstash / Vercel KV REST, if configured) -> file.
 * Writes go to every available tier.
 *
 * Persistence notes:
 * - Memory: fastest, but lost on redeploy/cold start.
 * - File: survives warm restarts. Locally it lives in `.news-cache/` and survives
 *   dev restarts; on Vercel it lives in `/tmp` and does NOT survive redeploys.
 * - KV: the only tier that reliably survives Vercel redeploys. Configure
 *   KV_REST_API_URL + KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_URL/_TOKEN).
 */
import { promises as fs } from "fs";
import path from "path";

export type CacheTier = "memory" | "kv" | "file";

const memory = new Map<string, unknown>();

const KV_URL = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL ?? "";
const KV_TOKEN = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN ?? "";
const KV_KEY_PREFIX = "finbrief:";
const KV_TTL_SECONDS = 7 * 24 * 60 * 60;

export function hasDurableCache(): boolean {
  return Boolean(KV_URL && KV_TOKEN);
}

export function cacheBackendDescription(): string {
  return hasDurableCache()
    ? "kv (persistent across redeploys)"
    : "memory+file only — NOT reliable across redeploys. Set KV_REST_API_URL and KV_REST_API_TOKEN (Vercel KV / Upstash) for durable editions.";
}

function fileCacheDir(): string {
  // Vercel's filesystem is read-only except /tmp.
  if (process.env.VERCEL) return path.join("/tmp", "finbrief-news-cache");
  return path.join(process.cwd(), ".news-cache");
}

function hashKey(key: string): string {
  let hash = 5381;
  for (let i = 0; i < key.length; i += 1) {
    hash = ((hash << 5) + hash + key.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

function filePathForKey(key: string): string {
  const safe = key.replace(/[^a-z0-9_-]+/gi, "_").slice(0, 120);
  return path.join(fileCacheDir(), `${safe}.${hashKey(key)}.json`);
}

async function kvGet<T>(key: string): Promise<T | null> {
  try {
    const response = await fetch(`${KV_URL}/get/${encodeURIComponent(KV_KEY_PREFIX + key)}`, {
      headers: { authorization: `Bearer ${KV_TOKEN}` },
      cache: "no-store",
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { result: string | null };
    if (!body.result) return null;
    return JSON.parse(body.result) as T;
  } catch {
    return null;
  }
}

async function kvSet(key: string, value: unknown): Promise<void> {
  try {
    await fetch(KV_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${KV_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(["SET", KV_KEY_PREFIX + key, JSON.stringify(value), "EX", KV_TTL_SECONDS]),
      cache: "no-store",
    });
  } catch {
    // Best effort: memory/file tiers still hold the value.
  }
}

async function fileGet<T>(key: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePathForKey(key), "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function fileSet(key: string, value: unknown): Promise<void> {
  try {
    await fs.mkdir(fileCacheDir(), { recursive: true });
    await fs.writeFile(filePathForKey(key), JSON.stringify(value), "utf8");
  } catch {
    // Best effort: the in-memory tier still holds the value.
  }
}

export async function cacheGet<T>(key: string): Promise<{ value: T; tier: CacheTier } | null> {
  if (memory.has(key)) {
    return { value: memory.get(key) as T, tier: "memory" };
  }
  if (hasDurableCache()) {
    const fromKv = await kvGet<T>(key);
    if (fromKv !== null) {
      memory.set(key, fromKv);
      return { value: fromKv, tier: "kv" };
    }
  }
  const fromFile = await fileGet<T>(key);
  if (fromFile !== null) {
    memory.set(key, fromFile);
    return { value: fromFile, tier: "file" };
  }
  return null;
}

export async function cacheSet(key: string, value: unknown): Promise<void> {
  memory.set(key, value);
  const writes: Array<Promise<void>> = [fileSet(key, value)];
  if (hasDurableCache()) writes.push(kvSet(key, value));
  await Promise.all(writes);
}
