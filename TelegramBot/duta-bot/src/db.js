import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import crypto from 'crypto';
import { CONFIG } from './config.js';

if (!fs.existsSync(CONFIG.dataDir)) {
  fs.mkdirSync(CONFIG.dataDir, { recursive: true });
}

const db = new DatabaseSync(CONFIG.dbPath);
const SOURCES_BACKUP_PATH = CONFIG.dataDir + '/sources-backup.json';

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS admins (
    user_id INTEGER PRIMARY KEY,
    username TEXT,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'ADMIN',
    receive_breaking_drafts INTEGER NOT NULL DEFAULT 1,
    receive_ad_suspects INTEGER NOT NULL DEFAULT 0,
    receive_daily_report INTEGER NOT NULL DEFAULT 1,
    allowed_categories TEXT NOT NULL DEFAULT '[]',
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS pending_admin_usernames (
    username TEXT PRIMARY KEY,
    role TEXT NOT NULL DEFAULT 'ADMIN',
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    url_or_handle TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'سیاسی',
    credibility INTEGER NOT NULL DEFAULT 78,
    color TEXT NOT NULL DEFAULT '#007AFF',
    initials TEXT NOT NULL DEFAULT 'DT',
    active INTEGER NOT NULL DEFAULT 1,
    last_fetched_at INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS clusters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    site_cluster_id INTEGER,
    site_article_id INTEGER,
    representative_title TEXT NOT NULL,
    summary TEXT,
    category TEXT NOT NULL DEFAULT 'سیاسی',
    credibility_score INTEGER NOT NULL DEFAULT 75,
    source_count INTEGER NOT NULL DEFAULT 1,
    covered_sources TEXT NOT NULL DEFAULT '[]',
    source_name TEXT NOT NULL DEFAULT 'Duta',
    source_color TEXT NOT NULL DEFAULT '#007AFF',
    source_initials TEXT NOT NULL DEFAULT 'DT',
    short_url TEXT,
    breaking INTEGER NOT NULL DEFAULT 0,
    published_to_channel INTEGER NOT NULL DEFAULT 0,
    channel_message_id INTEGER,
    last_published_score INTEGER DEFAULT 0,
    last_published_sources INTEGER DEFAULT 1,
    telegram_views INTEGER NOT NULL DEFAULT 0,
    telegram_reactions INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_clusters_created ON clusters(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_clusters_site_cid ON clusters(site_cluster_id);
  CREATE INDEX IF NOT EXISTS idx_clusters_msg_id ON clusters(channel_message_id);

  CREATE TABLE IF NOT EXISTS seen_items (
    url_hash TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    source_id INTEGER,
    is_ad INTEGER NOT NULL DEFAULT 0,
    ad_reason TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_seen_created ON seen_items(created_at DESC);

  CREATE TABLE IF NOT EXISTS drafts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cluster_id INTEGER,
    title TEXT NOT NULL,
    summary TEXT,
    category TEXT NOT NULL DEFAULT 'سیاسی',
    credibility_score INTEGER NOT NULL DEFAULT 75,
    source_count INTEGER NOT NULL DEFAULT 1,
    covered_sources TEXT NOT NULL DEFAULT '[]',
    source_name TEXT NOT NULL DEFAULT 'Duta',
    source_color TEXT NOT NULL DEFAULT '#007AFF',
    source_initials TEXT NOT NULL DEFAULT 'DT',
    short_url TEXT,
    breaking INTEGER NOT NULL DEFAULT 0,
    is_ad_suspect INTEGER NOT NULL DEFAULT 0,
    ad_reason TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING',
    locked_by_user_id INTEGER,
    locked_by_name TEXT,
    locked_until INTEGER DEFAULT 0,
    version INTEGER NOT NULL DEFAULT 1,
    last_edited_by TEXT,
    action_by_name TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS draft_messages (
    draft_id INTEGER NOT NULL,
    admin_chat_id INTEGER NOT NULL,
    message_id INTEGER NOT NULL,
    PRIMARY KEY (draft_id, admin_chat_id),
    FOREIGN KEY (draft_id) REFERENCES drafts(id) ON DELETE CASCADE
  );
`);

try {
  db.exec(`ALTER TABLE drafts ADD COLUMN covered_sources TEXT NOT NULL DEFAULT '[]';`);
} catch {}

const defaultSettings = {
  breaking_auto_publish: '0',
  silent_night_enabled: '1',
  inline_url_btn_enabled: '1',
  auto_publish_regular: '1',
  tablo_pinned_msg_id: '0',
  draft_expire_minutes: '30'
};

const insertSettingStmt = db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`);
for (const [k, v] of Object.entries(defaultSettings)) {
  insertSettingStmt.run(k, v);
}

if (CONFIG.superAdminId > 0) {
  db.prepare(`
    INSERT INTO admins (user_id, username, display_name, role, receive_breaking_drafts, receive_ad_suspects, receive_daily_report, created_at)
    VALUES (?, 'superadmin', 'سوپرادمین (مانی)', 'SUPER_ADMIN', 1, 1, 1, ?)
    ON CONFLICT(user_id) DO UPDATE SET role = 'SUPER_ADMIN'
  `).run(Number(CONFIG.superAdminId), Date.now());
}

function syncSourcesToBackupFile() {
  try {
    const all = db.prepare('SELECT * FROM sources ORDER BY id ASC').all();
    fs.writeFileSync(SOURCES_BACKUP_PATH, JSON.stringify(all, null, 2), 'utf-8');
    db.exec('PRAGMA wal_checkpoint(PASSIVE);');
  } catch {}
}

function restoreSourcesFromBackupIfNeeded() {
  try {
    const count = db.prepare('SELECT COUNT(*) AS c FROM sources').get()?.c || 0;
    if (count === 0 && fs.existsSync(SOURCES_BACKUP_PATH)) {
      const backedUp = JSON.parse(fs.readFileSync(SOURCES_BACKUP_PATH, 'utf-8'));
      if (Array.isArray(backedUp) && backedUp.length > 0) {
        const stmt = db.prepare(`
          INSERT OR IGNORE INTO sources (name, url_or_handle, type, category, credibility, color, initials, active, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const s of backedUp) {
          stmt.run(s.name, s.url_or_handle, s.type, s.category, s.credibility, s.color, s.initials, s.active ?? 1, s.created_at || Date.now());
        }
      }
    }
  } catch {}
}
restoreSourcesFromBackupIfNeeded();

export function purgeOrphanManualClusters() {
  try {
    const activeSources = db.prepare('SELECT name, url_or_handle FROM sources WHERE active = 1').all();
    if (activeSources.length === 0) {
      db.prepare('DELETE FROM clusters WHERE published_to_channel = 0 AND site_cluster_id IS NULL').run();
      return;
    }
    const unpublishedManual = db.prepare('SELECT id, source_name, source_initials FROM clusters WHERE published_to_channel = 0 AND site_cluster_id IS NULL').all();
    for (const c of unpublishedManual) {
      const matched = activeSources.some(s => {
        const h = '@' + String(s.url_or_handle || '').replace(/^@/, '').toLowerCase();
        return (
          String(c.source_initials || '').toLowerCase() === h ||
          String(c.source_name || '').toLowerCase().includes(h) ||
          String(c.source_name || '').includes(s.name)
        );
      });
      if (!matched) {
        db.prepare('DELETE FROM clusters WHERE id = ?').run(c.id);
      }
    }
  } catch {}
}
purgeOrphanManualClusters();

export function getSetting(key, fallback = '') {
  const row = db.prepare(`SELECT value FROM settings WHERE key = ?`).get(String(key));
  return row ? row.value : fallback;
}

export function setSetting(key, value) {
  db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(String(key), String(value));
}

export function getBooleanSetting(key, fallback = false) {
  const val = getSetting(key, fallback ? '1' : '0');
  return val === '1' || val === 'true';
}

export function getAdmin(userId) {
  if (!userId) return null;
  const row = db.prepare(`SELECT * FROM admins WHERE user_id = ?`).get(Number(userId));
  if (!row) return null;
  return {
    ...row,
    receiveBreakingDrafts: row.receive_breaking_drafts === 1,
    receiveAdSuspects: row.receive_ad_suspects === 1,
    receiveDailyReport: row.receive_daily_report === 1,
    allowedCategories: safeJsonParse(row.allowed_categories, [])
  };
}

export function verifyAndSyncTelegramUser(fromUser) {
  if (!fromUser || !fromUser.id) return null;
  const uid = Number(fromUser.id);
  const uname = (fromUser.username || '').replace(/^@/, '').toLowerCase();
  const fullName = [fromUser.first_name, fromUser.last_name].filter(Boolean).join(' ').trim() || uname || 'ادمین';

  if (
    (CONFIG.superAdminId > 0 && uid === CONFIG.superAdminId) ||
    (CONFIG.superAdminUsername && uname && uname === CONFIG.superAdminUsername)
  ) {
    return upsertAdmin({ userId: uid, username: uname, displayName: fullName, role: 'SUPER_ADMIN' });
  }

  if (uname) {
    const pending = db.prepare(`SELECT * FROM pending_admin_usernames WHERE username = ?`).get(uname);
    if (pending) {
      db.prepare(`DELETE FROM pending_admin_usernames WHERE username = ?`).run(uname);
      return upsertAdmin({ userId: uid, username: uname, displayName: fullName, role: pending.role || 'ADMIN' });
    }
  }

  const existing = getAdmin(uid);
  if (existing) {
    if (uname && existing.username !== uname) {
      db.prepare(`UPDATE admins SET username = ?, display_name = ? WHERE user_id = ?`).run(uname, fullName, uid);
      return getAdmin(uid);
    }
    return existing;
  }

  return null;
}

export function addPendingAdminByUsername(username) {
  const clean = String(username || '').replace(/^@/, '').trim().toLowerCase();
  if (!clean) return false;
  db.prepare(`
    INSERT OR REPLACE INTO pending_admin_usernames (username, role, created_at)
    VALUES (?, 'ADMIN', ?)
  `).run(clean, Date.now());
  return true;
}

export function getPendingAdminUsernames() {
  return db.prepare(`SELECT * FROM pending_admin_usernames ORDER BY created_at DESC`).all();
}

export function removePendingAdminUsername(username) {
  const clean = String(username || '').replace(/^@/, '').trim().toLowerCase();
  return db.prepare(`DELETE FROM pending_admin_usernames WHERE username = ?`).run(clean).changes > 0;
}

export function isAdmin(userId, username = '') {
  if (!userId) return false;
  if (Number(userId) === CONFIG.superAdminId) return true;
  if (CONFIG.superAdminUsername && username && username.replace(/^@/, '').toLowerCase() === CONFIG.superAdminUsername) {
    return true;
  }
  return !!getAdmin(userId);
}

export function isSuperAdmin(userId, username = '') {
  if (!userId) return false;
  if (Number(userId) === CONFIG.superAdminId) return true;
  if (CONFIG.superAdminUsername && username && username.replace(/^@/, '').toLowerCase() === CONFIG.superAdminUsername) {
    return true;
  }
  const adm = getAdmin(userId);
  return adm?.role === 'SUPER_ADMIN';
}

export function getAllAdmins() {
  return db.prepare(`SELECT * FROM admins ORDER BY role DESC, created_at ASC`).all().map(row => ({
    ...row,
    receiveBreakingDrafts: row.receive_breaking_drafts === 1,
    receiveAdSuspects: row.receive_ad_suspects === 1,
    receiveDailyReport: row.receive_daily_report === 1,
    allowedCategories: safeJsonParse(row.allowed_categories, [])
  }));
}

export function upsertAdmin({ userId, username = '', displayName = 'ادمین', role = 'ADMIN' }) {
  db.prepare(`
    INSERT INTO admins (user_id, username, display_name, role, created_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      username = COALESCE(NULLIF(excluded.username, ''), admins.username),
      display_name = COALESCE(NULLIF(excluded.display_name, ''), admins.display_name),
      role = CASE WHEN admins.role = 'SUPER_ADMIN' THEN 'SUPER_ADMIN' ELSE excluded.role END
  `).run(Number(userId), String(username || ''), String(displayName || 'ادمین'), String(role || 'ADMIN'), Date.now());
  return getAdmin(userId);
}

export function updateAdminPersonalPrefs(userId, patch = {}) {
  const current = getAdmin(userId);
  if (!current) return null;

  const recBreaking = patch.receiveBreakingDrafts !== undefined
    ? (patch.receiveBreakingDrafts ? 1 : 0)
    : (current.receiveBreakingDrafts ? 1 : 0);
  const recAds = patch.receiveAdSuspects !== undefined
    ? (patch.receiveAdSuspects ? 1 : 0)
    : (current.receiveAdSuspects ? 1 : 0);
  const recReport = patch.receiveDailyReport !== undefined
    ? (patch.receiveDailyReport ? 1 : 0)
    : (current.receiveDailyReport ? 1 : 0);
  const allowedCats = patch.allowedCategories !== undefined
    ? JSON.stringify(patch.allowedCategories)
    : String(current.allowed_categories || '[]');

  db.prepare(`
    UPDATE admins
    SET receive_breaking_drafts = ?,
        receive_ad_suspects = ?,
        receive_daily_report = ?,
        allowed_categories = ?
    WHERE user_id = ?
  `).run(recBreaking, recAds, recReport, allowedCats, Number(userId));

  return getAdmin(userId);
}

export function removeAdmin(userId) {
  const adm = getAdmin(userId);
  if (!adm || adm.role === 'SUPER_ADMIN') return false;
  const res = db.prepare(`DELETE FROM admins WHERE user_id = ? AND role != 'SUPER_ADMIN'`).run(Number(userId));
  return res.changes > 0;
}

export function getEligibleAdminsForDraft({ isBreaking = false, isAdSuspect = false, category = null }) {
  return getAllAdmins().filter(adm => {
    if (isAdSuspect && !adm.receiveAdSuspects) return false;
    if (isBreaking && !isAdSuspect && !adm.receiveBreakingDrafts) return false;
    if (category && adm.allowedCategories.length > 0 && !adm.allowedCategories.includes(category)) {
      return false;
    }
    return true;
  });
}

export function getAllSources(onlyActive = false) {
  const sql = onlyActive
    ? `SELECT * FROM sources WHERE active = 1 ORDER BY id DESC`
    : `SELECT * FROM sources ORDER BY id DESC`;
  return db.prepare(sql).all();
}

export function getSourceById(id) {
  return db.prepare(`SELECT * FROM sources WHERE id = ?`).get(Number(id));
}

export function addSource({ name, urlOrHandle, type, category = 'سیاسی', credibility = 78, color = '#007AFF', initials = 'DT' }) {
  const cleanInitials = (initials || name.slice(0, 2)).toUpperCase().slice(0, 12);
  const info = db.prepare(`
    INSERT INTO sources (name, url_or_handle, type, category, credibility, color, initials, active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
    ON CONFLICT(url_or_handle) DO UPDATE SET
      name = excluded.name,
      category = excluded.category,
      credibility = excluded.credibility,
      active = 1
  `).run(
    String(name || '').trim(),
    String(urlOrHandle || '').trim(),
    String(type || 'RSS'),
    String(category || 'سیاسی'),
    Number(credibility || 78),
    String(color || '#007AFF'),
    String(cleanInitials),
    Date.now()
  );
  syncSourcesToBackupFile();
  return getSourceById(Number(info.lastInsertRowid)) || db.prepare(`SELECT * FROM sources WHERE url_or_handle = ?`).get(String(urlOrHandle || '').trim());
}

export function toggleSourceActive(id) {
  const src = getSourceById(id);
  if (!src) return null;
  const next = src.active === 1 ? 0 : 1;
  db.prepare(`UPDATE sources SET active = ? WHERE id = ?`).run(next, Number(id));
  syncSourcesToBackupFile();
  purgeOrphanManualClusters();
  return getSourceById(id);
}

export function deleteSource(id) {
  const res = db.prepare(`DELETE FROM sources WHERE id = ?`).run(Number(id)).changes > 0;
  syncSourcesToBackupFile();
  purgeOrphanManualClusters();
  return res;
}

export function touchSourceFetched(id) {
  db.prepare(`UPDATE sources SET last_fetched_at = ? WHERE id = ?`).run(Date.now(), Number(id));
}

function hashUrl(url) {
  return crypto.createHash('sha1').update(String(url).trim()).digest('hex');
}

export function isUrlSeen(url) {
  if (!url) return true;
  const h = hashUrl(url);
  const row = db.prepare(`SELECT 1 FROM seen_items WHERE url_hash = ?`).get(h);
  return !!row;
}

export function markUrlSeen(url, sourceId = null, isAd = false, adReason = null) {
  if (!url) return;
  const h = hashUrl(url);
  db.prepare(`
    INSERT OR IGNORE INTO seen_items (url_hash, url, source_id, is_ad, ad_reason, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    h,
    String(url).trim(),
    sourceId !== null ? Number(sourceId) : null,
    isAd ? 1 : 0,
    adReason ? String(adReason) : null,
    Date.now()
  );
}

export function getRecentClusters(hours = 6) {
  const cutoff = Date.now() - hours * 3600 * 1000;
  return db.prepare(`SELECT * FROM clusters WHERE created_at >= ? ORDER BY created_at DESC`).all(cutoff).map(hydrateCluster);
}

export function getClusterById(id) {
  const row = db.prepare(`SELECT * FROM clusters WHERE id = ?`).get(Number(id));
  return row ? hydrateCluster(row) : null;
}

export function getClusterBySiteClusterId(siteClusterId) {
  if (!siteClusterId) return null;
  const row = db.prepare(`SELECT * FROM clusters WHERE site_cluster_id = ?`).get(Number(siteClusterId));
  return row ? hydrateCluster(row) : null;
}

export function createCluster({
  siteClusterId = null,
  siteArticleId = null,
  title,
  summary = '',
  category = 'سیاسی',
  credibilityScore = 75,
  sourceCount = 1,
  coveredSources = [],
  sourceName = 'Duta',
  sourceColor = '#007AFF',
  sourceInitials = 'DT',
  shortUrl = null,
  breaking = false
}) {
  const now = Date.now();
  const info = db.prepare(`
    INSERT INTO clusters (
      site_cluster_id, site_article_id, representative_title, summary, category,
      credibility_score, source_count, covered_sources, source_name, source_color,
      source_initials, short_url, breaking, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    siteClusterId ? Number(siteClusterId) : null,
    siteArticleId ? Number(siteArticleId) : null,
    String(title || ''),
    String(summary || ''),
    String(category || 'سیاسی'),
    Number(credibilityScore || 75),
    Number(sourceCount || 1),
    JSON.stringify(coveredSources || []),
    String(sourceName || 'Duta'),
    String(sourceColor || '#007AFF'),
    String(sourceInitials || 'DT'),
    shortUrl ? String(shortUrl) : null,
    breaking ? 1 : 0,
    now,
    now
  );
  return getClusterById(Number(info.lastInsertRowid));
}

export function updateClusterData(id, {
  title,
  summary,
  credibilityScore,
  sourceCount,
  coveredSources,
  shortUrl,
  breaking
} = {}) {
  const current = getClusterById(id);
  if (!current) return null;

  const nextTitle = String(title ?? current.representative_title ?? '');
  const nextSummary = String(summary ?? current.summary ?? '');
  const nextScore = Number(credibilityScore ?? current.credibility_score ?? 75);
  const nextSourceCount = Number(sourceCount ?? current.source_count ?? 1);
  const nextCoveredJson = coveredSources ? JSON.stringify(coveredSources) : String(current.covered_sources || '[]');
  const nextShortUrl = shortUrl !== undefined
    ? (shortUrl ? String(shortUrl) : null)
    : (current.short_url ? String(current.short_url) : null);
  const nextBreakingInt = breaking !== undefined ? (breaking ? 1 : 0) : (current.breaking ? 1 : 0);

  db.prepare(`
    UPDATE clusters
    SET representative_title = ?,
        summary = ?,
        credibility_score = ?,
        source_count = ?,
        covered_sources = ?,
        short_url = ?,
        breaking = ?,
        updated_at = ?
    WHERE id = ?
  `).run(
    nextTitle,
    nextSummary,
    nextScore,
    nextSourceCount,
    nextCoveredJson,
    nextShortUrl,
    nextBreakingInt,
    Date.now(),
    Number(id)
  );

  if (coveredSources) {
    db.prepare(`UPDATE drafts SET covered_sources = ?, source_count = ? WHERE cluster_id = ?`).run(
      nextCoveredJson,
      nextSourceCount,
      Number(id)
    );
  }

  return getClusterById(id);
}

export function markClusterPublished(id, channelMessageId, score, sourceCount) {
  db.prepare(`
    UPDATE clusters
    SET published_to_channel = 1,
        channel_message_id = ?,
        last_published_score = ?,
        last_published_sources = ?,
        updated_at = ?
    WHERE id = ?
  `).run(Number(channelMessageId || 0), Number(score || 75), Number(sourceCount || 1), Date.now(), Number(id));
}

export function getNextUnpublishedAutoCluster() {
  purgeOrphanManualClusters();
  const cutoff = Date.now() - 24 * 3600 * 1000;
  const includeBreaking = getBooleanSetting('breaking_auto_publish', false);

  const sql = includeBreaking
    ? `
      SELECT * FROM clusters
      WHERE published_to_channel = 0
        AND created_at >= ?
        AND credibility_score >= 55
      ORDER BY breaking DESC, (CASE WHEN site_cluster_id IS NULL THEN 1 ELSE 0 END) DESC, created_at DESC
      LIMIT 1
    `
    : `
      SELECT * FROM clusters
      WHERE published_to_channel = 0
        AND breaking = 0
        AND created_at >= ?
        AND credibility_score >= 55
      ORDER BY (CASE WHEN site_cluster_id IS NULL THEN 1 ELSE 0 END) DESC, created_at DESC, source_count DESC
      LIMIT 1
    `;

  const row = db.prepare(sql).get(cutoff);
  return row ? hydrateCluster(row) : null;
}

export function updateClusterTelegramMetrics(channelMessageId, { views = null, reactions = null }) {
  if (!channelMessageId) return;
  const row = db.prepare(`SELECT * FROM clusters WHERE channel_message_id = ?`).get(Number(channelMessageId));
  if (!row) return;
  db.prepare(`
    UPDATE clusters
    SET telegram_views = ?,
        telegram_reactions = ?
    WHERE channel_message_id = ?
  `).run(
    views !== null ? Number(views) : Number(row.telegram_views || 0),
    reactions !== null ? Number(reactions) : Number(row.telegram_reactions || 0),
    Number(channelMessageId)
  );
}

function hydrateCluster(row) {
  return {
    ...row,
    breaking: row.breaking === 1,
    publishedToChannel: row.published_to_channel === 1,
    coveredSourcesList: safeJsonParse(row.covered_sources, [])
  };
}

export function createDraft({
  clusterId = null,
  title,
  summary = '',
  category = 'سیاسی',
  credibilityScore = 75,
  sourceCount = 1,
  coveredSources = [],
  sourceName = 'Duta',
  sourceColor = '#007AFF',
  sourceInitials = 'DT',
  shortUrl = null,
  breaking = false,
  isAdSuspect = false,
  adReason = null
}) {
  const info = db.prepare(`
    INSERT INTO drafts (
      cluster_id, title, summary, category, credibility_score, source_count,
      covered_sources, source_name, source_color, source_initials, short_url, breaking,
      is_ad_suspect, ad_reason, status, version, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 1, ?)
  `).run(
    clusterId ? Number(clusterId) : null,
    String(title || ''),
    String(summary || ''),
    String(category || 'سیاسی'),
    Number(credibilityScore || 75),
    Number(sourceCount || 1),
    JSON.stringify(coveredSources || []),
    String(sourceName || 'Duta'),
    String(sourceColor || '#007AFF'),
    String(sourceInitials || 'DT'),
    shortUrl ? String(shortUrl) : null,
    breaking ? 1 : 0,
    isAdSuspect ? 1 : 0,
    adReason ? String(adReason) : null,
    Date.now()
  );
  return getDraft(Number(info.lastInsertRowid));
}

export function getDraft(id) {
  const row = db.prepare(`SELECT * FROM drafts WHERE id = ?`).get(Number(id));
  if (!row) return null;
  return {
    ...row,
    breaking: row.breaking === 1,
    isAdSuspect: row.is_ad_suspect === 1,
    coveredSourcesList: safeJsonParse(row.covered_sources, [])
  };
}

export function tryAcquireDraftLock(draftId, userId, userName, ttlMs = 120_000) {
  const draft = getDraft(draftId);
  if (!draft || draft.status !== 'PENDING') {
    return { ok: false, reason: 'این پیش‌نویس قبلاً تعیین تکلیف شده است.' };
  }

  const now = Date.now();
  if (draft.locked_by_user_id && draft.locked_by_user_id !== Number(userId) && draft.locked_until > now) {
    return {
      ok: false,
      reason: `⚠️ ادمین «${draft.locked_by_name}» هم‌اکنون در حال ویرایش این خبر است. لطفاً چند ثانیه صبر کنید.`
    };
  }

  db.prepare(`
    UPDATE drafts
    SET locked_by_user_id = ?, locked_by_name = ?, locked_until = ?
    WHERE id = ?
  `).run(Number(userId), String(userName || 'ادمین'), now + ttlMs, Number(draftId));

  return { ok: true, draft: getDraft(draftId) };
}

export function releaseDraftLock(draftId, userId) {
  db.prepare(`
    UPDATE drafts
    SET locked_by_user_id = NULL, locked_by_name = NULL, locked_until = 0
    WHERE id = ? AND (locked_by_user_id IS NULL OR locked_by_user_id = ?)
  `).run(Number(draftId), Number(userId));
}

export function updateDraftContent(draftId, patch = {}, editorName = 'ادمین') {
  const current = getDraft(draftId);
  if (!current || current.status !== 'PENDING') return null;

  const nextTitle = String(patch.title !== undefined ? patch.title : current.title);
  const nextSummary = String(patch.summary !== undefined ? patch.summary : (current.summary || ''));
  const nextCategory = String(patch.category !== undefined ? patch.category : current.category);
  const nextBreakingInt = patch.breaking !== undefined ? (patch.breaking ? 1 : 0) : (current.breaking ? 1 : 0);

  db.prepare(`
    UPDATE drafts
    SET title = ?,
        summary = ?,
        category = ?,
        breaking = ?,
        version = version + 1,
        last_edited_by = ?,
        locked_by_user_id = NULL,
        locked_by_name = NULL,
        locked_until = 0
    WHERE id = ?
  `).run(nextTitle, nextSummary, nextCategory, nextBreakingInt, String(editorName || 'ادمین'), Number(draftId));

  if (current.cluster_id) {
    updateClusterData(current.cluster_id, {
      title: nextTitle,
      summary: nextSummary,
      breaking: nextBreakingInt === 1
    });
  }

  return getDraft(draftId);
}

export function finalizeDraftStatus(draftId, status, actorName) {
  const res = db.prepare(`
    UPDATE drafts
    SET status = ?,
        action_by_name = ?,
        locked_by_user_id = NULL,
        locked_by_name = NULL,
        locked_until = 0
    WHERE id = ? AND status = 'PENDING'
  `).run(String(status), String(actorName || 'ادمین'), Number(draftId));
  return res.changes > 0 ? getDraft(draftId) : null;
}

export function saveDraftAdminMessage(draftId, adminChatId, messageId) {
  db.prepare(`
    INSERT OR REPLACE INTO draft_messages (draft_id, admin_chat_id, message_id)
    VALUES (?, ?, ?)
  `).run(Number(draftId), Number(adminChatId), Number(messageId));
}

export function getDraftAdminMessages(draftId) {
  return db.prepare(`SELECT * FROM draft_messages WHERE draft_id = ?`).all(Number(draftId));
}

export function getExpiredPendingDrafts(expireMinutes = 30) {
  const cutoff = Date.now() - Number(expireMinutes) * 60 * 1000;
  return db.prepare(`
    SELECT * FROM drafts
    WHERE status = 'PENDING' AND created_at < ?
  `).all(cutoff);
}

export function deleteDraftRecord(draftId) {
  db.prepare(`DELETE FROM draft_messages WHERE draft_id = ?`).run(Number(draftId));
  db.prepare(`DELETE FROM drafts WHERE id = ?`).run(Number(draftId));
}

export function getAllChannelPostMessageIds() {
  return db.prepare(`
    SELECT id, channel_message_id FROM clusters
    WHERE channel_message_id IS NOT NULL AND channel_message_id > 0
  `).all();
}

export function clearClusterChannelMessageId(clusterId) {
  db.prepare(`UPDATE clusters SET channel_message_id = NULL WHERE id = ?`).run(Number(clusterId));
}

export function getBotAnalyticsSummary(hours = 24) {
  const since = Date.now() - hours * 3600 * 1000;

  const publishedRows = db.prepare(`
    SELECT * FROM clusters
    WHERE published_to_channel = 1 AND created_at >= ?
    ORDER BY telegram_views DESC, telegram_reactions DESC
  `).all(since);

  const adsBlockedCount = db.prepare(`
    SELECT COUNT(*) AS cnt FROM seen_items
    WHERE is_ad = 1 AND created_at >= ?
  `).get(since)?.cnt || 0;

  let totalViews = 0;
  let totalReactions = 0;
  let breakingCount = 0;
  const catCounts = {};

  for (const r of publishedRows) {
    totalViews += r.telegram_views || 0;
    totalReactions += r.telegram_reactions || 0;
    if (r.breaking === 1) breakingCount++;
    const cat = r.category || 'سیاسی';
    catCounts[cat] = (catCounts[cat] || 0) + 1;
  }

  const mostViewedPost = [...publishedRows].sort((a, b) => (b.telegram_views || 0) - (a.telegram_views || 0))[0] || null;
  const mostReactedPost = [...publishedRows].sort((a, b) => (b.telegram_reactions || 0) - (a.telegram_reactions || 0))[0] || null;

  let topCategory = 'اقتصادی';
  let topCatMax = 0;
  for (const [cat, count] of Object.entries(catCounts)) {
    if (count > topCatMax) {
      topCatMax = count;
      topCategory = cat;
    }
  }

  return {
    publishedCount: publishedRows.length,
    breakingCount,
    adsBlockedCount,
    totalTelegramViews: totalViews,
    totalTelegramReactions: totalReactions,
    mostViewedPost,
    mostReactedPost,
    topCategory,
    publishedRows
  };
}

export function cleanupOldBotRecords(days = 7) {
  const cutoff = Date.now() - Number(days) * 86400 * 1000;
  db.prepare(`DELETE FROM draft_messages WHERE draft_id IN (SELECT id FROM drafts WHERE created_at < ?)`).run(cutoff);
  db.prepare(`DELETE FROM drafts WHERE created_at < ?`).run(cutoff);
  db.prepare(`DELETE FROM clusters WHERE created_at < ?`).run(cutoff);
  db.prepare(`DELETE FROM seen_items WHERE created_at < ?`).run(cutoff);
  try { db.exec('PRAGMA wal_checkpoint(TRUNCATE);'); } catch {}
}

function safeJsonParse(str, fallback) {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

export default db;
