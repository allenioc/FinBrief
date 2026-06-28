import type { Brief } from "./types";

/** Shared quality gates for Article Brief explanation copy. */

export const EXPLANATION_COPY_VERSION = 6;

/** Source fields used to regenerate Article Brief explanations. Saved summary/analysis fields are not trusted. */
export function stripSavedExplanationFields(brief: Brief): Brief {
  return {
    ...brief,
    summary: "",
    thirtySecondVersion: "",
    whatHappened: "",
    whyItMatters: "",
    whoIsAffected: "",
    bullCase: "",
    bearCase: "",
    neutralView: "",
    risks: [],
    thingsToWatch: [],
    explanationVersion: undefined,
  };
}

export function resolveProviderExcerpt(brief: Pick<Brief, "excerpt" | "whatHappened">): string {
  const excerpt = brief.excerpt?.trim() ?? "";
  if (excerpt && excerpt !== "No summary available from provider.") {
    return excerpt;
  }
  return brief.whatHappened?.trim() ?? "";
}

export function hasTrustedExplanationCopy(brief: Brief): boolean {
  return (
    typeof brief.explanationVersion === "number" &&
    brief.explanationVersion >= EXPLANATION_COPY_VERSION &&
    Boolean(brief.summary?.trim()) &&
    !isBadBriefCopy(brief.summary, brief.headline)
  );
}

export const PROMOTIONAL_COPY_PATTERNS = [
  /\bfind winning stocks\b/i,
  /\bwith just minutes per day\b/i,
  /\bmotley fool\b/i,
  /\bstock advisor\b/i,
  /\bclick here\b/i,
  /\bsign up(?:\s+(?:now|today|free))?\b/i,
  /\bsubscribe(?:\s+(?:now|today|free))?\b/i,
  /\bfree newsletter\b/i,
  /\blimited[- ]time offer\b/i,
  /\b(?:sponsored|advertisement|advertorial)\b/i,
  /\bdownload (?:our|the) app\b/i,
  /\bget access to\b/i,
  /\bjoin now\b/i,
  /\bstart your free trial\b/i,
  /\bsimply wall st\b/i,
  /\binvesting ideas\b/i,
  /\bjoin\s+\d[\d,.]*\s+million\b/i,
  /\b\d[\d,.]*\s+million\s+investors?\b/i,
  /\bfor free\b/i,
  /\bfree\b.*\b(?:newsletter|signup|sign up|trial|investing|membership)\b/i,
  /\bpremium membership\b/i,
  /\bstock picks?\b/i,
  /\bunlock premium\b/i,
  /\btry it free\b/i,
];

const GENERIC_BRIEF_PATTERNS = [
  /headline-driven moves can reverse quickly/i,
  /provider descriptions may omit key context/i,
  /follow-up reports may change the interpretation/i,
  /next management or policy update/i,
  /revisions from major sources/i,
  /price reaction in related assets/i,
  /this could shift expectations for the parties involved/i,
  /the development sits inside a finance story with implications/i,
  /could shift expectations for the companies involved/i,
  /early headlines often move prices before timelines/i,
  /a neutral stance keeps room for both relief and disappointment/i,
  /if later disclosures validate the reporting and no major negative surprises emerge/i,
  /watch for the next confirmed update on this story/i,
  /the reported detail gives the update its immediate relevance/i,
  /reporting names the institution, figure, or affected group that gives the update its immediate relevance/i,
  /reporting highlights the institution, figure, or policy detail that drives the update/i,
  /reporting advances .+ with a new update/i,
  /the reported detail anchors why the update matters now/i,
];

const META_BRIEF_PATTERNS = [
  /\bthe preview\b/i,
  /\bthis preview\b/i,
  /\bavailable preview\b/i,
  /\bshort preview\b/i,
  /\barticle preview\b/i,
  /\bsource preview\b/i,
  /\bin the excerpt\b/i,
  /\bthis excerpt\b/i,
  /\bthe excerpt\b/i,
  /\bavailable source material\b/i,
  /\bdoes not include the full\b/i,
  /\bfinbrief summarizes\b/i,
  /\blinked source article\b/i,
  /\bfuller source article\b/i,
  /\bfull published article\b/i,
  /\bopen the source link\b/i,
  /\bthe available preview\b/i,
  /\bappears to cover\b/i,
  /\bframes the story around\b/i,
  /\bcaptures the main factual points\b/i,
  /\bavailable reporting preview\b/i,
  /\bpreview excerpt\b/i,
  /\bavailable in this brief\b/i,
  /\bthe short preview\b/i,
  /\bthe article says\b/i,
  /\bread the full source article\b/i,
  /\bthe reporting preview\b/i,
  /\bthe linked source article\b/i,
];

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function normalizeForCompare(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export function stripPromotionalCopy(text: string): string {
  let cleaned = normalizeWhitespace(text);

  cleaned = cleaned
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => {
      const lower = sentence.toLowerCase();
      if (PROMOTIONAL_COPY_PATTERNS.some((pattern) => pattern.test(lower))) return false;
      if (/\bjoin\b/.test(lower) && /\b(?:million|free|investors?)\b/.test(lower)) return false;
      if (/\bsimply wall\b/.test(lower)) return false;
      return true;
    })
    .join(" ");

  for (const pattern of PROMOTIONAL_COPY_PATTERNS) {
    cleaned = cleaned.replace(pattern, " ");
  }
  cleaned = cleaned.replace(/\b(?:read|see)\s+more\s+at\b[^.!?]*/gi, " ");
  cleaned = cleaned.replace(/\bjoin[^.!?]{0,160}\bfor free\b[^.!?]*/gi, " ");
  cleaned = cleaned.replace(/\binvestors?\s+using\s+'s\b[^.!?]*/gi, " ");
  cleaned = cleaned.replace(/\busing\s+'s\b/gi, " ");
  cleaned = cleaned.replace(/\s+'s\s*\./g, ".");
  cleaned = cleaned.replace(/^['"]s\s*\.\s*/i, "");
  return normalizeWhitespace(cleaned);
}

export function stripTruncatedTail(text: string): string {
  let cleaned = normalizeWhitespace(text);
  if (/[.!?]"?$/.test(cleaned)) return cleaned;
  cleaned = cleaned.replace(/\s+\w{1,3}-\s*$/i, "");
  cleaned = cleaned.replace(/\s+(?:de|un|re|pre|dis|non|sub|inter|trans|over|under)$/i, "");
  cleaned = cleaned.replace(/\s+[A-Za-z]{1,2}$/, "");
  return normalizeWhitespace(cleaned);
}

export function isPromotionalCopy(text: string): boolean {
  const lower = text.toLowerCase();
  return PROMOTIONAL_COPY_PATTERNS.some((pattern) => pattern.test(lower));
}

export function isBrokenCopy(text: string): boolean {
  const value = normalizeWhitespace(text);
  if (!value) return true;
  if (/\.\.\.|…/.test(value)) return true;
  if (/\binvestors?\s+using\s+'s\b/i.test(value)) return true;
  if (/\busing\s+'s\b/i.test(value)) return true;
  if (/^['"]s\s*\./i.test(value)) return true;
  if (/\s[-–—]\s*$/.test(value)) return true;
  if (/\b(?:de|un|re|pre|dis|non|sub|inter|trans|over|under)$/i.test(value)) return true;
  if (!/[.!?]"?$/.test(value) && countWords(value) > 8 && value.length > 40) {
    const tail = value.split(/\s+/).pop() ?? "";
    if (tail.length <= 3 && !/[.!?]/.test(tail)) return true;
  }
  return false;
}

export function isSummaryMetaCommentary(text: string): boolean {
  const lower = text.toLowerCase();
  return META_BRIEF_PATTERNS.some((pattern) => pattern.test(lower));
}

export function isGenericBriefCopy(text: string): boolean {
  const lower = text.toLowerCase();
  return GENERIC_BRIEF_PATTERNS.some((pattern) => pattern.test(lower));
}

export function overlapsHeadline(text: string, headline: string): boolean {
  const normalizedText = normalizeForCompare(text);
  const normalizedHeadline = normalizeForCompare(headline);
  if (!normalizedText || !normalizedHeadline) return false;
  if (normalizedText === normalizedHeadline) return true;
  const headlineStart = normalizedHeadline.slice(0, Math.min(40, normalizedHeadline.length));
  return normalizedText.startsWith(headlineStart);
}

export function isPromotionalAmountContext(text: string, amount: string): boolean {
  const lower = text.toLowerCase();
  const amountLower = amount.toLowerCase();
  const idx = lower.indexOf(amountLower);
  if (idx < 0) return false;

  const window = lower.slice(Math.max(0, idx - 90), Math.min(lower.length, idx + amount.length + 90));
  const audienceTerms =
    /\b(?:investors?|users?|members?|subscribers?|customers?|readers?|people|clients?|visitors?)\b/;
  const promoVerbs =
    /\b(?:join|using|sign(?:\s+up)?|subscribe|download|get access|try|start|unlock|access|enroll)\b/;
  const marketingTerms =
    /\b(?:simply wall|investing ideas|for free|newsletter|stock picks?|premium|wall st|membership)\b/;

  if (marketingTerms.test(window)) return true;
  if (audienceTerms.test(window) && promoVerbs.test(window)) return true;
  if (audienceTerms.test(window) && /^\d[\d,.]*\s*m(?:illion)?$/i.test(amount.trim())) return true;
  if (/\bjoin\b/.test(window) && /\bmillion\b/.test(window)) return true;
  return false;
}

export function filterStoryAmounts(amounts: string[], text: string): string[] {
  return amounts.filter((amount) => !isPromotionalAmountContext(text, amount));
}

export function isBadBriefCopy(text: string, headline = ""): boolean {
  if (!text?.trim()) return true;
  if (isBrokenCopy(text)) return true;
  if (isPromotionalCopy(text)) return true;
  if (isGenericBriefCopy(text)) return true;

  for (const block of text.split(/\n\n+/)) {
    const cleaned = normalizeWhitespace(block);
    if (!cleaned) continue;
    if (isSummaryMetaCommentary(cleaned)) return true;
    if (headline && overlapsHeadline(cleaned, headline)) return true;
  }
  return false;
}

export function shouldRebuildBriefCopy(text: string, headline = ""): boolean {
  return isBadBriefCopy(text, headline);
}

export function isLowQualityBriefList(items: string[], headline = ""): boolean {
  if (!items.length) return true;
  const joined = items.join(" ");
  if (isBadBriefCopy(joined, headline)) return true;
  return items.some((item) => isBadBriefCopy(item, headline) || isGenericBriefCopy(item));
}

export function polishBriefCopy(text: string, headline: string, fallback: string): string {
  const trimmed = text?.trim() ?? "";
  if (trimmed && !isBadBriefCopy(trimmed, headline)) return trimmed;
  const rebuilt = fallback?.trim() ?? "";
  if (rebuilt && !isBadBriefCopy(rebuilt, headline)) return rebuilt;
  return rebuilt || trimmed;
}

export function polishBriefList(items: string[], headline: string, fallback: string[]): string[] {
  if (!isLowQualityBriefList(items, headline)) {
    return items.map((item) => normalizeWhitespace(item)).filter(Boolean);
  }
  return fallback.map((item) => normalizeWhitespace(item)).filter(Boolean);
}
