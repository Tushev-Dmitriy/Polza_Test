import { cache } from "react";
import { db } from "./db";
import type { Company } from "./types";

export const PAGE_SIZE = 50;

export type CompanyFilters = {
  search: string;
  city: string;
  page: number;
};

type DbCompany = {
  id: string;
  source_id: string;
  name: string;
  category: string;
  city: string;
  address: string;
  rating: string | null;
  reviews_count: number;
  site: string | null;
  phone: string | null;
};

export const getCompaniesPage = cache(async (filters: CompanyFilters) => {
  const offset = (filters.page - 1) * PAGE_SIZE;
  const values: unknown[] = [];
  const conditions: string[] = [];

  if (filters.search) {
    values.push(`%${filters.search}%`);
    conditions.push(`name ILIKE $${values.length}`);
  }
  if (filters.city) {
    values.push(filters.city);
    conditions.push(`city = $${values.length}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const listValues = [...values, PAGE_SIZE, offset];

  const [companiesResult, countResult, citiesResult, statsResult] = await Promise.all([
    db.query<DbCompany>(
      `SELECT id::text, source_id, name, category, city, address,
              rating::text, reviews_count, site, phone
       FROM companies
       ${where}
       ORDER BY name, id
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      listValues,
    ),
    db.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM companies ${where}`, values),
    db.query<{ city: string }>("SELECT DISTINCT city FROM companies ORDER BY city"),
    db.query<{ total: string; cities: string; categories: string }>(
      `SELECT COUNT(*)::text AS total,
              COUNT(DISTINCT city)::text AS cities,
              COUNT(DISTINCT category)::text AS categories
       FROM companies`,
    ),
  ]);

  const companies: Company[] = companiesResult.rows.map((row) => ({
    id: row.id,
    sourceId: row.source_id,
    name: row.name,
    category: row.category,
    city: row.city,
    address: row.address,
    rating: row.rating,
    reviewsCount: row.reviews_count,
    site: row.site,
    phone: row.phone,
  }));

  return {
    companies,
    count: Number(countResult.rows[0].count),
    cities: citiesResult.rows.map((row) => row.city),
    stats: {
      total: Number(statsResult.rows[0].total),
      cities: Number(statsResult.rows[0].cities),
      categories: Number(statsResult.rows[0].categories),
    },
  };
});
