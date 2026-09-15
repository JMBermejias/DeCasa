import Database from 'better-sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.DECASA_DATA_DIR || path.join(os.homedir(), '.local', 'share', 'decasa');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

export const db = new Database(path.join(dataDir, 'decasa.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS affiliate_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT,
    tracking_id TEXT NOT NULL,
    marketplace TEXT DEFAULT 'amazon.es',
    status TEXT DEFAULT 'activa',
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS stores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT DEFAULT '',
    status TEXT DEFAULT 'activa',
    mode TEXT DEFAULT 'automatica',
    format TEXT DEFAULT 'moderno',
    accent_color TEXT DEFAULT '#38bdf8',
    show_prices INTEGER DEFAULT 1,
    banner_text TEXT DEFAULT '',
    affiliate_account_id INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asin TEXT UNIQUE,
    title TEXT NOT NULL,
    price REAL,
    original_price REAL,
    rating REAL DEFAULT 0,
    reviews_count INTEGER DEFAULT 0,
    image_url TEXT,
    url TEXT,
    category TEXT,
    store_id INTEGER,
    commission_rate REAL DEFAULT 0.04,
    commission REAL DEFAULT 0,
    status TEXT DEFAULT 'pendiente',
    source TEXT DEFAULT 'demo',
    created_at TEXT DEFAULT (datetime('now')),
    published_at TEXT
  );

  CREATE TABLE IF NOT EXISTS earnings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER,
    store_id INTEGER,
    amount REAL NOT NULL DEFAULT 0,
    type TEXT DEFAULT 'venta',
    clicks INTEGER DEFAULT 0,
    date TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS withdrawals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    amount REAL NOT NULL,
    method TEXT NOT NULL,
    status TEXT DEFAULT 'pendiente',
    requested_at TEXT DEFAULT (datetime('now')),
    processed_at TEXT,
    notes TEXT
  );

  CREATE TABLE IF NOT EXISTS payment_methods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    enabled INTEGER DEFAULT 1,
    config TEXT DEFAULT '{}'
  );

  CREATE TABLE IF NOT EXISTS sales_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER,
    store_id INTEGER,
    amount REAL NOT NULL,
    date TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

export function getSetting(key, fallback = null) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? JSON.parse(row.value) : fallback;
}

export function setSetting(key, value) {
  db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, JSON.stringify(value));
}

export function seed() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM settings').get().c;
  if (count === 0) {
    setSetting('amazon', {
      access_key: '',
      secret_key: '',
      partner_tag: '',
      marketplace: 'amazon.es',
      region: 'eu-west-1',
      demo_mode: true
    });
    setSetting('general', {
      app_name: 'DeCasa',
      currency: 'EUR',
      default_commission: 0.04,
      auto_upload: false,
      auto_update_interval: 24
    });
    setSetting('store_format', {
      title: 'Mi Tienda DeCasa',
      layout: 'grid',
      theme: 'moderno',
      accent_color: '#38bdf8',
      font: 'Inter',
      show_prices: true,
      cards_per_row: 4
    });
  }

  if (db.prepare('SELECT COUNT(*) AS c FROM payment_methods').get().c === 0) {
    const insert = db.prepare(
      'INSERT INTO payment_methods (name, type, enabled, config) VALUES (?, ?, ?, ?)'
    );
    insert.run('PayPal', 'paypal', 1, JSON.stringify({ email: '' }));
    insert.run('Transferencia bancaria', 'transferencia', 1, JSON.stringify({ iban: '', bank: '' }));
    insert.run('Tarjeta de débito/crédito', 'tarjeta', 0, JSON.stringify({}));
    insert.run('Criptomoneda (USDT/BTC)', 'cripto', 0, JSON.stringify({ wallet: '' }));
    insert.run('Cheque / Giro', 'cheque', 0, JSON.stringify({ address: '' }));
  }

  const storeCount = db.prepare('SELECT COUNT(*) AS c FROM stores').get().c;
  if (storeCount === 0) {
    db.prepare(
      `INSERT INTO stores (name, slug, description, status, mode, format, accent_color, show_prices, banner_text)
       VALUES (?, ?, ?, 'activa', 'automatica', 'moderno', '#38bdf8', 1, '')`
    ).run('Tienda Principal', 'tienda-principal', 'Tu tienda de afiliación generada automáticamente');
  }
}

seed();
