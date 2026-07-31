-- 1. Топ-5 категорий по числу компаний.
SELECT
    category,
    COUNT(*) AS companies_count
FROM companies
GROUP BY category
ORDER BY companies_count DESC, category
LIMIT 5;

-- 2. Средний рейтинг по городам среди компаний с 10+ отзывами.
-- Компании без рейтинга исключаются из AVG стандартным поведением PostgreSQL.
SELECT
    city,
    ROUND(AVG(rating), 2) AS average_rating,
    COUNT(*) AS companies_count
FROM companies
WHERE reviews_count >= 10
  AND rating IS NOT NULL
GROUP BY city
ORDER BY average_rating DESC, city;

-- 3. Доля компаний с сайтом по категориям.
SELECT
    category,
    COUNT(*) AS companies_count,
    COUNT(*) FILTER (WHERE site IS NOT NULL) AS companies_with_site,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE site IS NOT NULL) / COUNT(*),
        2
    ) AS website_share_percent
FROM companies
GROUP BY category
ORDER BY website_share_percent DESC, category;
