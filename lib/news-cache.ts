/**
 * Tiered cache for saved news editions.
 *
 * Read order: in-memory -> Redis (REDIS_URL) -> KV REST (optional) -> file.
 * Writes go to every available tier.
 *
 * Persistence notes:
 * - Memory: fastest, but lost on redeploy/cold start.
 * - File: survives warm restarts. Locally it lives in `.news-cache/` and survives
 *   dev restarts; on Vercel it lives in `/tmp` and does NOT survive redeploys.
 * - Redis: durable across redeploys when REDIS_URL is configured (Vercel Redis).
 * - KV REST: optional Upstash/Vercel KV REST fallback via KV_REST_API_URL + token.
 */
import { promises as fs } from "fs";
import path from "path";
import { createClient, type RedisClientType } from "redis";

export type CacheTier = "memory" | "redis" | "kv" | "file";

const memory = new Map<string, unknown>();

const REDIS_URL = process.env.REDIS_URL ?? "";
const KV_URL = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL ?? "";
const KV_TOKEN = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN ?? "";
const DURABLE_KEY_PREFIX = "finbrief:";
const KV_TTL_SECONDS = 7 * 24 * 60 * 60;
const WEEKLY_KV_TTL_SECONDS = 14 * 24 * 60 * 60;

let redisClient: RedisClientType | null = null;
let redisConnectPromise: Promise<RedisClientType | null> | null = null;

export function isWeeklyPersistenceKey(key: string): boolean {
  return (
    key.startsWith("weekly-archive::") ||
    key.startsWith("weekly-day::") ||
    key.startsWith("edition-by-date::")
  );
}

function hasRestKv(): boolean {
  return Boolean(KV_URL && KV_TOKEN);
}

export function hasDurableCache(): boolean {
  return Boolean(REDIS_URL || hasRestKv());
}

export async function isDurableCacheAvailable(): Promise<boolean> {
  if (REDIS_URL) {
    const client = await getRedisClient();
    if (!client) return false;
    try {
      const response = await client.ping();
      return response === "PONG";
    } catch {
      return false;
    }
  }
  return hasRestKv();
}

export function cacheBackendDescription(): string {
  if (REDIS_URL) return "redis (persistent across redeploys)";
  if (hasRestKv()) return "kv-rest (persistent across redeploys)";
  return "memory+file only — NOT reliable across redeploys. Set REDIS_URL (Vercel Redis) or KV_REST_API_URL + KV_REST_API_TOKEN for durable editions.";
}

async function getRedisClient(): Promise<RedisClientType | null> {
  if (!REDIS_URL) return null;
  if (redisClient?.isOpen) return redisClient;
  if (!redisConnectPromise) {
    redisConnectPromise = (async () => {
      try {
        const client = createClient({ url: REDIS_URL });
        client.on("error", () => {
          // Never log REDIS_URL or connection details.
        });
        await client.connect();
        redisClient = client;
        return client;
      } catch {
        redisConnectPromise = null;
        return null;
      }
    })();
  }
  return redisConnectPromise;
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

function durableStorageKey(key: string): string {
  return DURABLE_KEY_PREFIX + key;
}

async function redisGet<T>(key: string): Promise<T | null> {
  const client = await getRedisClient();
  if (!client) return null;
  try {
    const raw = await client.get(durableStorageKey(key));
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function redisSet(key: string, value: unknown, ttlSeconds = KV_TTL_SECONDS): Promise<void> {
  const client = await getRedisClient();
  if (!client) return;
  try {
    await client.set(durableStorageKey(key), JSON.stringify(value), { EX: ttlSeconds });
  } catch {
    // Best effort: memory/file tiers still hold the value.
  }
}

async function kvGet<T>(key: string): Promise<T | null> {
  try {
    const response = await fetch(`${KV_URL}/get/${encodeURIComponent(durableStorageKey(key))}`, {
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

async function kvSet(key: string, value: unknown, ttlSeconds = KV_TTL_SECONDS): Promise<void> {
  try {
    await fetch(KV_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${KV_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(["SET", durableStorageKey(key), JSON.stringify(value), "EX", ttlSeconds]),
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

async function readDurable<T>(key: string): Promise<{ value: T; tier: "redis" | "kv" } | null> {
  if (REDIS_URL) {
    const fromRedis = await redisGet<T>(key);
    if (fromRedis !== null) {
      return { value: fromRedis, tier: "redis" };
    }
  }
  if (hasRestKv()) {
    const fromKv = await kvGet<T>(key);
    if (fromKv !== null) {
      return { value: fromKv, tier: "kv" };
    }
  }
  return null;
}

async function writeDurable(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const writes: Array<Promise<void>> = [];
  if (REDIS_URL) writes.push(redisSet(key, value, ttlSeconds));
  if (hasRestKv()) writes.push(kvSet(key, value, ttlSeconds));
  if (writes.length > 0) await Promise.all(writes);
}

export async function cacheGet<T>(key: string): Promise<{ value: T; tier: CacheTier } | null> {
  if (memory.has(key)) {
    return { value: memory.get(key) as T, tier: "memory" };
  }
  if (hasDurableCache()) {
    const fromDurable = await readDurable<T>(key);
    if (fromDurable !== null) {
      memory.set(key, fromDurable.value);
      return fromDurable;
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
  if (hasDurableCache()) {
    const ttl = isWeeklyPersistenceKey(key) ? WEEKLY_KV_TTL_SECONDS : KV_TTL_SECONDS;
    writes.push(writeDurable(key, value, ttl));
  }
  await Promise.all(writes);
}
