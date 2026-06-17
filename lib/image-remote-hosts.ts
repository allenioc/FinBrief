/** Shared allowlist for Next.js Image optimization (also used client-side). */
export type ImageRemotePattern = {
  protocol: "https" | "http";
  hostname: string;
  pathname: string;
};

export const IMAGE_REMOTE_PATTERNS: ImageRemotePattern[] = [
  { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
  { protocol: "https", hostname: "s.yimg.com", pathname: "/**" },
  { protocol: "https", hostname: "media.zenfs.com", pathname: "/**" },
  { protocol: "https", hostname: "image.cnbcfm.com", pathname: "/**" },
  { protocol: "https", hostname: "images.wsj.net", pathname: "/**" },
  { protocol: "https", hostname: "images.barrons.com", pathname: "/**" },
  { protocol: "https", hostname: "images.marketwatch.com", pathname: "/**" },
  { protocol: "https", hostname: "static.seekingalpha.com", pathname: "/**" },
  { protocol: "https", hostname: "images.reuters.com", pathname: "/**" },
  { protocol: "https", hostname: "www.reuters.com", pathname: "/**" },
  { protocol: "https", hostname: "assets.bwbx.io", pathname: "/**" },
  { protocol: "https", hostname: "www.bloomberg.com", pathname: "/**" },
  { protocol: "https", hostname: "i.guim.co.uk", pathname: "/**" },
  { protocol: "https", hostname: "media.cnn.com", pathname: "/**" },
  { protocol: "https", hostname: "cdn.cnn.com", pathname: "/**" },
  { protocol: "https", hostname: "static.foxnews.com", pathname: "/**" },
  { protocol: "https", hostname: "images.foxnews.com", pathname: "/**" },
  { protocol: "https", hostname: "a57.foxnews.com", pathname: "/**" },
  { protocol: "https", hostname: "static01.nyt.com", pathname: "/**" },
  { protocol: "https", hostname: "img.etimg.com", pathname: "/**" },
  { protocol: "https", hostname: "economictimes.indiatimes.com", pathname: "/**" },
  { protocol: "https", hostname: "lh3.googleusercontent.com", pathname: "/**" },
  { protocol: "https", hostname: "encrypted-tbn0.gstatic.com", pathname: "/**" },
  { protocol: "https", hostname: "i0.wp.com", pathname: "/**" },
  { protocol: "https", hostname: "i1.wp.com", pathname: "/**" },
  { protocol: "https", hostname: "i2.wp.com", pathname: "/**" },
  { protocol: "https", hostname: "platform.theverge.com", pathname: "/**" },
  { protocol: "https", hostname: "cdn.arstechnica.net", pathname: "/**" },
  { protocol: "https", hostname: "variety.com", pathname: "/**" },
  { protocol: "https", hostname: "deadline.com", pathname: "/**" },
  { protocol: "https", hostname: "**.wp.com", pathname: "/**" },
  { protocol: "https", hostname: "**.reuters.com", pathname: "/**" },
  { protocol: "https", hostname: "**.yimg.com", pathname: "/**" },
  { protocol: "https", hostname: "**.bloomberg.com", pathname: "/**" },
];

function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase();
}

function hostnameMatchesPattern(hostname: string, pattern: string): boolean {
  const host = normalizeHostname(hostname);
  const value = normalizeHostname(pattern);
  if (value.startsWith("*.")) {
    const suffix = value.slice(1);
    return host.endsWith(suffix) || host === value.slice(2);
  }
  if (value.startsWith("**.")) {
    const suffix = value.slice(1);
    return host.endsWith(suffix) || host === value.slice(3);
  }
  return host === value;
}

export function parseHttpImageUrl(value: string): URL | null {
  if (!value?.trim()) return null;
  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function isOptimizableRemoteImage(value: string): boolean {
  if (value.startsWith("/")) return true;
  const parsed = parseHttpImageUrl(value);
  if (!parsed) return false;
  return IMAGE_REMOTE_PATTERNS.some(
    (pattern) =>
      pattern.protocol === parsed.protocol.replace(":", "") &&
      hostnameMatchesPattern(parsed.hostname, pattern.hostname)
  );
}

export function isDisplayableRemoteImage(value: string): boolean {
  return value.startsWith("/") || parseHttpImageUrl(value) !== null;
}
