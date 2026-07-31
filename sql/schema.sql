CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS companies (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    source_id       TEXT NOT NULL UNIQUE,
    name            TEXT NOT NULL,
    category        TEXT NOT NULL,
    city            TEXT NOT NULL,
    address         TEXT NOT NULL,
    rating          NUMERIC(2, 1),
    reviews_count   INTEGER NOT NULL DEFAULT 0,
    site            TEXT,
    phone           TEXT,
    dedupe_key      TEXT NOT NULL UNIQUE,
    source_file     TEXT NOT NULL,
    imported_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT companies_source_id_format CHECK (source_id ~ '^c_[0-9]{6}$'),
    CONSTRAINT companies_rating_range CHECK (rating IS NULL OR rating BETWEEN 0 AND 5),
    CONSTRAINT companies_reviews_nonnegative CHECK (reviews_count >= 0),
    CONSTRAINT companies_name_not_blank CHECK (btrim(name) <> ''),
    CONSTRAINT companies_category_not_blank CHECK (btrim(category) <> ''),
    CONSTRAINT companies_city_not_blank CHECK (btrim(city) <> ''),
    CONSTRAINT companies_address_not_blank CHECK (btrim(address) <> '')
);

CREATE TABLE IF NOT EXISTS import_runs (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    source          TEXT NOT NULL,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at     TIMESTAMPTZ,
    rows_seen       INTEGER NOT NULL DEFAULT 0,
    inserted        INTEGER NOT NULL DEFAULT 0,
    updated         INTEGER NOT NULL DEFAULT 0,
    duplicates      INTEGER NOT NULL DEFAULT 0,
    rejected        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS import_rejections (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    import_run_id   BIGINT NOT NULL REFERENCES import_runs(id) ON DELETE CASCADE,
    source_file     TEXT NOT NULL,
    row_number      INTEGER NOT NULL,
    source_id       TEXT,
    reasons         TEXT[] NOT NULL,
    raw_record      JSONB NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS companies_city_idx ON companies (city);
CREATE INDEX IF NOT EXISTS companies_category_idx ON companies (category);
CREATE INDEX IF NOT EXISTS companies_name_trgm_idx
    ON companies USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS companies_city_name_idx ON companies (city, name);
CREATE INDEX IF NOT EXISTS import_rejections_run_idx
    ON import_rejections (import_run_id);
