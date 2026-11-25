-- ORSAVEN — initial schema (Cloudflare D1 / SQLite)
-- Non-destructive: only CREATE statements. Safe to apply to an empty database.

PRAGMA foreign_keys = ON;

-- ───────────── Identity & access ─────────────
CREATE TABLE IF NOT EXISTS roles (
  id          TEXT PRIMARY KEY,               -- super_admin | administrator | customer
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  rank        INTEGER NOT NULL DEFAULT 0      -- higher = more privileged
);

CREATE TABLE IF NOT EXISTS permissions (
  key         TEXT PRIMARY KEY,
  description TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id        TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL REFERENCES permissions(key) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_key)
);

CREATE TABLE IF NOT EXISTS users (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  clerk_user_id  TEXT NOT NULL UNIQUE,
  email          TEXT,
  email_verified INTEGER NOT NULL DEFAULT 0,
  role_id        TEXT NOT NULL DEFAULT 'customer' REFERENCES roles(id),
  status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','deleted')),
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  last_seen_at   TEXT
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role_id);

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id      INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  company      TEXT NOT NULL DEFAULT '',
  phone        TEXT NOT NULL DEFAULT '',
  country      TEXT NOT NULL DEFAULT '',
  locale       TEXT NOT NULL DEFAULT 'id' CHECK (locale IN ('id','en')),
  onboarded_at TEXT,
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- ───────────── Catalog ─────────────
CREATE TABLE IF NOT EXISTS product_categories (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  family         TEXT NOT NULL CHECK (family IN ('digital_assets','business_kits','agentic_solutions','implementation_services')),
  slug           TEXT NOT NULL UNIQUE,
  name_id        TEXT NOT NULL,
  name_en        TEXT NOT NULL,
  description_id TEXT NOT NULL DEFAULT '',
  description_en TEXT NOT NULL DEFAULT '',
  sort_order     INTEGER NOT NULL DEFAULT 0,
  is_active      INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_categories_family ON product_categories(family, sort_order);

CREATE TABLE IF NOT EXISTS product_licenses (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  key        TEXT NOT NULL UNIQUE,
  name_id    TEXT NOT NULL,
  name_en    TEXT NOT NULL,
  summary_id TEXT NOT NULL DEFAULT '',
  summary_en TEXT NOT NULL DEFAULT '',
  terms_id   TEXT NOT NULL DEFAULT '',
  terms_en   TEXT NOT NULL DEFAULT '',
  status     TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS products (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  slug               TEXT NOT NULL UNIQUE,
  family             TEXT NOT NULL CHECK (family IN ('digital_assets','business_kits','agentic_solutions','implementation_services')),
  category_id        INTEGER REFERENCES product_categories(id) ON DELETE SET NULL,
  license_id         INTEGER REFERENCES product_licenses(id) ON DELETE SET NULL,
  title_id           TEXT NOT NULL,
  title_en           TEXT NOT NULL,
  summary_id         TEXT NOT NULL DEFAULT '',
  summary_en         TEXT NOT NULL DEFAULT '',
  description_id     TEXT NOT NULL DEFAULT '',
  description_en     TEXT NOT NULL DEFAULT '',
  audience_id        TEXT NOT NULL DEFAULT '',
  audience_en        TEXT NOT NULL DEFAULT '',
  includes_json      TEXT NOT NULL DEFAULT '{"id":[],"en":[]}',
  excludes_json      TEXT NOT NULL DEFAULT '{"id":[],"en":[]}',
  requirements_json  TEXT NOT NULL DEFAULT '{"id":[],"en":[]}',
  delivery_json      TEXT NOT NULL DEFAULT '{"id":"","en":""}',
  support_json       TEXT NOT NULL DEFAULT '{"id":"","en":""}',
  formats            TEXT NOT NULL DEFAULT '',
  pricing_model      TEXT NOT NULL DEFAULT 'one_time' CHECK (pricing_model IN ('one_time','free','quote')),
  price_idr          INTEGER CHECK (price_idr IS NULL OR price_idr >= 0),
  currency           TEXT NOT NULL DEFAULT 'IDR',
  status             TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','review','published','archived','unavailable')),
  maturity           TEXT NOT NULL DEFAULT 'concept' CHECK (maturity IN ('concept','prototype','beta','available','retired')),
  is_demo            INTEGER NOT NULL DEFAULT 0,
  is_featured        INTEGER NOT NULL DEFAULT 0,
  current_version_id INTEGER,
  preview_json       TEXT NOT NULL DEFAULT '{"id":"","en":""}',
  seo_title          TEXT NOT NULL DEFAULT '',
  seo_description    TEXT NOT NULL DEFAULT '',
  internal_notes     TEXT NOT NULL DEFAULT '',
  created_by         INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_by         INTEGER REFERENCES users(id) ON DELETE SET NULL,
  submitted_by       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  submitted_at       TEXT,
  approved_by        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  approved_at        TEXT,
  published_at       TEXT,
  archived_at        TEXT,
  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_products_status_family ON products(status, family);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(is_featured, status);

CREATE TABLE IF NOT EXISTS product_versions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  version     TEXT NOT NULL,
  changelog   TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','released','deprecated')),
  released_at TEXT,
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (product_id, version)
);
CREATE INDEX IF NOT EXISTS idx_versions_product ON product_versions(product_id);

CREATE TABLE IF NOT EXISTS product_assets (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id     INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  version_id     INTEGER REFERENCES product_versions(id) ON DELETE SET NULL,
  kind           TEXT NOT NULL DEFAULT 'deliverable' CHECK (kind IN ('deliverable','preview')),
  label          TEXT NOT NULL DEFAULT '',
  filename       TEXT NOT NULL,
  content_type   TEXT NOT NULL,
  size_bytes     INTEGER NOT NULL CHECK (size_bytes > 0),
  sha256         TEXT NOT NULL,
  storage_driver TEXT NOT NULL CHECK (storage_driver IN ('d1','r2')),
  storage_key    TEXT NOT NULL UNIQUE,
  is_active      INTEGER NOT NULL DEFAULT 1,
  created_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_assets_product ON product_assets(product_id, is_active);

-- Free-tier private blob storage (small files) when R2 is not authorised.
CREATE TABLE IF NOT EXISTS asset_blobs (
  storage_key TEXT PRIMARY KEY,
  data        BLOB NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- ───────────── Commerce ─────────────
CREATE TABLE IF NOT EXISTS orders (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id        TEXT NOT NULL UNIQUE,
  user_id          INTEGER NOT NULL REFERENCES users(id),
  status           TEXT NOT NULL DEFAULT 'pending_payment' CHECK (status IN ('pending_payment','paid','completed','cancelled','failed','refunded')),
  currency         TEXT NOT NULL DEFAULT 'IDR',
  subtotal_idr     INTEGER NOT NULL DEFAULT 0 CHECK (subtotal_idr >= 0),
  total_idr        INTEGER NOT NULL DEFAULT 0 CHECK (total_idr >= 0),
  payment_provider TEXT NOT NULL DEFAULT 'none',
  customer_note    TEXT NOT NULL DEFAULT '',
  admin_note       TEXT NOT NULL DEFAULT '',
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  paid_at          TEXT,
  completed_at     TEXT,
  cancelled_at     TEXT
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status, created_at);

CREATE TABLE IF NOT EXISTS order_items (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id         INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id       INTEGER NOT NULL REFERENCES products(id),
  version_id       INTEGER REFERENCES product_versions(id) ON DELETE SET NULL,
  title_snapshot   TEXT NOT NULL,
  license_snapshot TEXT NOT NULL DEFAULT '',
  unit_price_idr   INTEGER NOT NULL CHECK (unit_price_idr >= 0),
  quantity         INTEGER NOT NULL DEFAULT 1 CHECK (quantity = 1),
  license_code     TEXT NOT NULL UNIQUE,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);

CREATE TABLE IF NOT EXISTS payments (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id      INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  provider      TEXT NOT NULL,
  provider_ref  TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','failed','expired','refunded')),
  amount_idr    INTEGER NOT NULL CHECK (amount_idr >= 0),
  checkout_url  TEXT NOT NULL DEFAULT '',
  verified_at   TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (provider, provider_ref)
);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);

CREATE TABLE IF NOT EXISTS webhook_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  provider    TEXT NOT NULL,
  event_key   TEXT NOT NULL,
  outcome     TEXT NOT NULL,
  received_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (provider, event_key)
);

-- ───────────── Delivery ─────────────
CREATE TABLE IF NOT EXISTS downloads (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id),
  order_item_id INTEGER NOT NULL REFERENCES order_items(id),
  asset_id      INTEGER NOT NULL REFERENCES product_assets(id),
  token_hash    TEXT NOT NULL UNIQUE,
  expires_at    TEXT NOT NULL,
  max_uses      INTEGER NOT NULL DEFAULT 3,
  use_count     INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  last_used_at  TEXT
);
CREATE INDEX IF NOT EXISTS idx_downloads_user ON downloads(user_id, created_at);

CREATE TABLE IF NOT EXISTS download_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  download_id INTEGER NOT NULL REFERENCES downloads(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  asset_id    INTEGER NOT NULL REFERENCES product_assets(id),
  ip_hash     TEXT NOT NULL DEFAULT '',
  user_agent  TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_download_events_user ON download_events(user_id, created_at);

-- ───────────── Inquiries ─────────────
CREATE TABLE IF NOT EXISTS service_inquiries (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id    TEXT NOT NULL UNIQUE,
  user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  product_id   INTEGER REFERENCES products(id) ON DELETE SET NULL,
  name         TEXT NOT NULL,
  email        TEXT NOT NULL,
  company      TEXT NOT NULL DEFAULT '',
  service_type TEXT NOT NULL,
  budget_range TEXT NOT NULL DEFAULT '',
  message      TEXT NOT NULL,
  locale       TEXT NOT NULL DEFAULT 'id',
  status       TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','in_review','responded','closed','spam')),
  admin_note   TEXT NOT NULL DEFAULT '',
  ip_hash      TEXT NOT NULL DEFAULT '',
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_inquiries_status ON service_inquiries(status, created_at);
CREATE INDEX IF NOT EXISTS idx_inquiries_user ON service_inquiries(user_id);

-- ───────────── Governance ─────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  actor_role    TEXT NOT NULL DEFAULT 'system',
  action        TEXT NOT NULL,
  entity_type   TEXT NOT NULL,
  entity_id     TEXT NOT NULL DEFAULT '',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  ip_hash       TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);

CREATE TABLE IF NOT EXISTS site_settings (
  key        TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  is_public  INTEGER NOT NULL DEFAULT 0,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS legal_documents (
  slug        TEXT PRIMARY KEY CHECK (slug IN ('privacy','terms','refund','delivery')),
  title_id    TEXT NOT NULL,
  title_en    TEXT NOT NULL,
  body_id     TEXT NOT NULL DEFAULT '',
  body_en     TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved')),
  version     INTEGER NOT NULL DEFAULT 1,
  approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  approved_at TEXT,
  updated_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS rate_limits (
  key          TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count        INTEGER NOT NULL DEFAULT 0
);
