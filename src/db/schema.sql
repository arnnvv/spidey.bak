CREATE TYPE crawl_status AS ENUM (
    'pending',
    'crawling',
    'crawled',
    'failed'
);

CREATE TABLE urls (
    id             SERIAL PRIMARY KEY,
    url            TEXT        NOT NULL UNIQUE,
    status         crawl_status NOT NULL DEFAULT 'pending',
    content        TEXT,
    error_message  TEXT,
    crawled_at     TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_urls_status ON urls (status);
