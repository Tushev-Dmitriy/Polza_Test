import { createHash } from "node:crypto";
import type { RawCompany, ValidationResult } from "./types";

const SOURCE_ID_PATTERN = /^c_\d{6}$/;
const HTTP_URL_PATTERN = /^https?:\/\/[^\s]+$/i;
const MOJIBAKE_PATTERN = /(?:Р.|С.){3}/;
const CITY_ALIASES = new Map([
  ["moscow", "Москва"],
  ["москва", "Москва"],
  ["санкат-петербург", "Санкт-Петербург"],
]);

export function cleanText(value: unknown): string {
  if (typeof value !== "string" && typeof value !== "number") return "";
  return String(value).trim().replace(/\s+/g, " ");
}

export function emptyToNull(value: unknown): string | null {
  const cleaned = cleanText(value);
  return cleaned === "" ? null : cleaned;
}

export function normalizeForKey(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ru")
    .replace(/[«»"'`]/g, "")
    .replace(/[^a-zа-яё0-9]+/gi, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeCity(value: string): { value: string; warning?: string } {
  const canonical = CITY_ALIASES.get(value.toLocaleLowerCase("ru"));
  return canonical && canonical !== value
    ? { value: canonical, warning: `city "${value}" normalized to "${canonical}"` }
    : { value };
}

export function createDedupeKey(name: string, city: string, address: string): string {
  return createHash("sha256")
    .update([name, city, address].map(normalizeForKey).join("|"))
    .digest("hex");
}

function parseRating(value: unknown): { value: number | null; warning?: string; error?: string } {
  if (value === null || value === undefined || cleanText(value) === "") return { value: null };
  const raw = String(value).trim();
  const normalized = raw.replace(",", ".");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return { value: null, error: `rating "${raw}" is not numeric` };
  if (parsed < 0 || parsed > 5) return { value: null, error: `rating ${raw} is outside 0..5` };
  return {
    value: parsed,
    warning: raw !== normalized ? `rating "${raw}" normalized to "${normalized}"` : undefined,
  };
}

function parseReviews(value: unknown): { value: number; error?: string } {
  const raw = cleanText(value);
  if (!/^\d+$/.test(raw)) return { value: 0, error: `reviews_count "${raw}" is not a non-negative integer` };
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed)
    ? { value: parsed }
    : { value: 0, error: `reviews_count "${raw}" is outside the safe integer range` };
}

export function validateCompany(raw: RawCompany): ValidationResult {
  const sourceId = cleanText(raw.id);
  const name = cleanText(raw.name);
  const category = cleanText(raw.category);
  const rawCity = cleanText(raw.city);
  const normalizedCity = normalizeCity(rawCity);
  const city = normalizedCity.value;
  const address = cleanText(raw.address);
  const site = emptyToNull(raw.site);
  const phone = emptyToNull(raw.phone);
  const reasons: string[] = [];
  const warnings: string[] = [];
  if (normalizedCity.warning) warnings.push(normalizedCity.warning);

  if (!SOURCE_ID_PATTERN.test(sourceId)) reasons.push(`invalid id "${sourceId}"`);
  if (!name) reasons.push("name is blank");
  if (!category) reasons.push("category is blank");
  if (!city) reasons.push("city is blank");
  if (!address) reasons.push("address is blank");
  if (MOJIBAKE_PATTERN.test(name) || MOJIBAKE_PATTERN.test(city)) {
    reasons.push("text contains broken character encoding (mojibake)");
  }

  const rating = parseRating(raw.rating);
  const reviews = parseReviews(raw.reviews_count);
  if (rating.error) reasons.push(rating.error);
  if (rating.warning) warnings.push(rating.warning);
  if (reviews.error) reasons.push(reviews.error);
  if (site && !HTTP_URL_PATTERN.test(site)) reasons.push(`site "${site}" is not an http(s) URL`);

  if (reasons.length > 0) return { ok: false, reasons };

  return {
    ok: true,
    warnings,
    value: {
      sourceId,
      name,
      category,
      city,
      address,
      rating: rating.value,
      reviewsCount: reviews.value,
      site,
      phone,
      dedupeKey: createDedupeKey(name, city, address),
    },
  };
}
