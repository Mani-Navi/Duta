-- Performance indexes for cluster deduplication queries
CREATE INDEX IF NOT EXISTS idx_articles_cluster_id
    ON articles(cluster_id);

CREATE INDEX IF NOT EXISTS idx_articles_published_at
    ON articles(published_at DESC);

CREATE INDEX IF NOT EXISTS idx_sources_credibility
    ON sources(credibility DESC);

CREATE INDEX IF NOT EXISTS idx_articles_breaking
    ON articles(breaking) WHERE breaking = true;