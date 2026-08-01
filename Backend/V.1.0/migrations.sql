-- Performance indexes for cluster deduplication and fast queries

CREATE INDEX IF NOT EXISTS idx_articles_cluster_id
    ON articles(cluster_id);

CREATE INDEX IF NOT EXISTS idx_articles_published_at
    ON articles(published_at DESC);

CREATE INDEX IF NOT EXISTS idx_sources_credibility
    ON sources(credibility DESC);

CREATE INDEX IF NOT EXISTS idx_articles_breaking
    ON articles(breaking) WHERE breaking = true;

-- OPTIMIZED: Composite Index for fast Category queries + Sorting by Date (Prevents CPU Spikes on Railway)
CREATE INDEX IF NOT EXISTS idx_articles_category_published
    ON articles(category, published_at DESC);

-- OPTIMIZED: Index for deduplication native query subqueries
CREATE INDEX IF NOT EXISTS idx_articles_source_published
    ON articles(source_id, published_at DESC);