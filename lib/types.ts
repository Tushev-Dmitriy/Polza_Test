export type RawCompany = {
  id?: unknown;
  name?: unknown;
  category?: unknown;
  city?: unknown;
  address?: unknown;
  rating?: unknown;
  reviews_count?: unknown;
  site?: unknown;
  phone?: unknown;
};

export type CompanyInput = {
  sourceId: string;
  name: string;
  category: string;
  city: string;
  address: string;
  rating: number | null;
  reviewsCount: number;
  site: string | null;
  phone: string | null;
  dedupeKey: string;
};

export type ValidationResult =
  | { ok: true; value: CompanyInput; warnings: string[] }
  | { ok: false; reasons: string[] };

export type Company = {
  id: string;
  sourceId: string;
  name: string;
  category: string;
  city: string;
  address: string;
  rating: string | null;
  reviewsCount: number;
  site: string | null;
  phone: string | null;
};
