import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { db, getSetting, setSetting } from './db.js';
import { searchAmazonProducts } from './services/amazon.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

const cleanNum = (v) => (v === null || v === undefined || Number.isNaN(Number(v)) ? 0 : Number(v));

/* ===================== ESTADÍSTICAS / DASHBOARD ===================== */

app.get('/api/dashboard/summary', (req, res) => {
  const totals = db.prepare(
    `SELECT
       COALESCE(SUM(amount),0) AS total,
       COALESCE(SUM(CASE WHEN date = date('now') THEN amount END),0) AS today,
       COALESCE(SUM(CASE WHEN date >= date('now','weekday 0','-6 days') THEN amount END),0) AS week,
       COALESCE(SUM(CASE WHEN date >= date('now','-29 days') THEN amount END),0) AS month
     FROM earnings`
  ).get();
  const clicks = db.prepare('SELECT COALESCE(SUM(clicks),0) AS c FROM earnings').get().c;
  const products = db.prepare('SELECT COUNT(*) AS c FROM products').get().c;
  const published = db.prepare("SELECT COUNT(*) AS c FROM products WHERE status IN ('publicado','aceptado')").get().c;
  const pending = db.prepare("SELECT COUNT(*) AS c FROM products WHERE status = 'pendiente'").get().c;
  const stores = db.prepare('SELECT COUNT(*) AS c FROM stores').get().c;
  const conversions = db.prepare('SELECT COUNT(*) AS c FROM sales_events').get().c;
  const pendingWithdrawals = db.prepare("SELECT COALESCE(SUM(amount),0) AS s FROM withdrawals WHERE status = 'pendiente'").get().s;

  const byDay = db.prepare(
    `SELECT date, SUM(amount) AS total, SUM(clicks) AS clicks FROM earnings
     WHERE date >= date('now','-14 days') GROUP BY date ORDER BY date`
  ).all();
  const byWeek = db.prepare(
    `SELECT strftime('%Y-W%W', date) AS week, SUM(amount) AS total FROM earnings
     WHERE date >= date('now','-90 days') GROUP BY week ORDER BY week`
  ).all();
  const byMonth = db.prepare(
    `SELECT strftime('%Y-%m', date) AS month, SUM(amount) AS total FROM earnings
     GROUP BY month ORDER BY month DESC LIMIT 12`
  ).all();

  res.json({
    totals,
    clicks,
    products: { all: products, published, pending },
    stores,
    conversions,
    pendingWithdrawals,
    series: { byDay, byWeek, byMonth }
  });
});

app.get('/api/dashboard/top-products', (req, res) => {
  const rows = db.prepare(
    `SELECT e.product_id, p.title, p.image_url, p.rating, p.reviews_count,
       SUM(e.amount) AS total, SUM(e.clicks) AS clicks
     FROM earnings e LEFT JOIN products p ON p.id = e.product_id
     GROUP BY e.product_id ORDER BY total DESC LIMIT 10`
  ).all();
  res.json(rows);
});

app.get('/api/dashboard/earnings', (req, res) => {
  const period = req.query.period || 'month';
  let rows;
  if (period === 'day') {
    rows = db.prepare(
      `SELECT date, SUM(amount) AS total, SUM(clicks) AS clicks FROM earnings
       WHERE date >= date('now','-30 days') GROUP BY date ORDER BY date`
    ).all();
  } else if (period === 'week') {
    rows = db.prepare(
      `SELECT strftime('%Y-%W', date) AS label, SUM(amount) AS total, SUM(clicks) AS clicks
       FROM earnings WHERE date >= date('now','-180 days') GROUP BY label ORDER BY label`
    ).all();
  } else {
    rows = db.prepare(
      `SELECT strftime('%Y-%m', date) AS label, SUM(amount) AS total, SUM(clicks) AS clicks
       FROM earnings GROUP BY label ORDER BY label DESC LIMIT 12`
    ).all();
  }
  res.json(rows);
});

app.get('/api/dashboard/recent-sales', (req, res) => {
  const rows = db.prepare(
    `SELECT s.*, p.title, p.image_url FROM sales_events s
     LEFT JOIN products p ON p.id = s.product_id
     ORDER BY s.id DESC LIMIT 15`
  ).all();
  res.json(rows);
});

/* ===================== PRODUCTOS ===================== */

app.post('/api/products/search', async (req, res) => {
  const { query, category, store_id } = req.body;
  try {
    const result = await searchAmazonProducts(query || 'producto', category);
    const commission = getSetting('general', {}).default_commission ?? 0.04;
    const stored = result.products.map((p) => {
      const existing = db.prepare('SELECT id, status, store_id FROM products WHERE asin = ?').get(p.asin);
      if (existing) {
        return { ...p, id: existing.id, status: existing.status, store_id: existing.store_id, exists: true };
      }
      const info = db
        .prepare(
          `INSERT INTO products (asin, title, price, original_price, rating, reviews_count, image_url, url, category, store_id, commission_rate, commission, source)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          p.asin, p.title, cleanNum(p.price), p.original_price ? cleanNum(p.original_price) : null,
          p.rating || 0, p.reviews_count || 0, p.image_url || '', p.url || '',
          p.category || 'General', store_id || null, commission,
          cleanNum(p.price) * commission, 'amazon'
        );
      return { ...p, id: info.lastInsertRowid, status: 'pendiente', exists: false };
    });
    res.json({ products: stored, demo: result.demo, warning: result.warning || null });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/products', (req, res) => {
  const status = req.query.status;
  const sql =
    `SELECT * FROM products ${status ? 'WHERE status = ?' : ''} ORDER BY (status = 'pendiente') DESC, created_at DESC`;
  const rows = status ? db.prepare(sql).all(status) : db.prepare(sql).all();
  res.json(rows);
});

app.post('/api/products/:id/accept', (req, res) => {
  const { store_id } = req.body;
  const p = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Producto no encontrado' });
  const sid = store_id || p.store_id;
  db.prepare(
    "UPDATE products SET status = 'publicado', published_at = datetime('now'), store_id = ? WHERE id = ?"
  ).run(sid, p.id);
  const store = db.prepare('SELECT * FROM stores WHERE id = ?').get(sid);
  if (store) db.prepare("UPDATE stores SET updated_at = datetime('now') WHERE id = ?").run(sid);
  res.json(db.prepare('SELECT * FROM products WHERE id = ?').get(p.id));
});

app.post('/api/products/batch/accept', (req, res) => {
  const { ids, store_id } = req.body;
  const stmt = db.prepare(
    "UPDATE products SET status = 'publicado', published_at = datetime('now'), store_id = ? WHERE id = ?"
  );
  const tx = db.transaction((items) => {
    for (const id of items) stmt.run(store_id, id);
  });
  tx(ids);
  if (store_id) db.prepare("UPDATE stores SET updated_at = datetime('now') WHERE id = ?").run(store_id);
  res.json({ ok: true, count: ids.length });
});

app.post('/api/products/:id/reject', (req, res) => {
  db.prepare("UPDATE products SET status = 'rechazado' WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

app.delete('/api/products/:id', (req, res) => {
  db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

/* ===================== TIENDAS ===================== */

app.get('/api/stores', (req, res) => {
  const stores = db.prepare('SELECT * FROM stores ORDER BY id').all();
  const result = stores.map((s) => {
    const stats = db.prepare(
      `SELECT COUNT(*) AS products,
        COALESCE(SUM(CASE WHEN p.status='publicado' THEN 1 ELSE 0 END),0) AS published
       FROM products p WHERE p.store_id = ?`
    ).get(s.id);
    return { ...s, ...stats };
  });
  res.json(result);
});

app.post('/api/stores', (req, res) => {
  const { name, description, format, accent_color } = req.body;
  if (!name) return res.status(400).json({ error: 'El nombre es obligatorio' });
  const slugBase = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const slug = slugBase || 'tienda-' + Date.now();
  const info = db.prepare(
    `INSERT INTO stores (name, slug, description, mode, format, accent_color)
     VALUES (?, ?, ?, 'automatica', ?, ?)`
  ).run(name, slug, description || '', format || 'moderno', accent_color || '#38bdf8');
  res.json(db.prepare('SELECT * FROM stores WHERE id = ?').get(info.lastInsertRowid));
});

app.put('/api/stores/:id', (req, res) => {
  const { name, description, status, mode, format, accent_color, show_prices, banner_text, affiliate_account_id } = req.body;
  const current = db.prepare('SELECT * FROM stores WHERE id = ?').get(req.params.id);
  if (!current) return res.status(404).json({ error: 'Tienda no encontrada' });
  db.prepare(
    `UPDATE stores SET
       name = COALESCE(?, name),
       description = COALESCE(?, description),
       status = COALESCE(?, status),
       mode = COALESCE(?, mode),
       format = COALESCE(?, format),
       accent_color = COALESCE(?, accent_color),
       show_prices = COALESCE(?, show_prices),
       banner_text = COALESCE(?, banner_text),
       affiliate_account_id = ?,
       updated_at = datetime('now')
     WHERE id = ?`
  ).run(name ?? null, description ?? null, status ?? null, mode ?? null, format ?? null,
    accent_color ?? null, show_prices ?? null, banner_text ?? null,
    affiliate_account_id ?? current.affiliate_account_id, req.params.id);
  res.json(db.prepare('SELECT * FROM stores WHERE id = ?').get(req.params.id));
});

app.post('/api/stores/:id/upload', (req, res) => {
  const store = db.prepare('SELECT * FROM stores WHERE id = ?').get(req.params.id);
  if (!store) return res.status(404).json({ error: 'Tienda no encontrada' });
  const published = db.prepare(
    "UPDATE products SET status='publicado', published_at=datetime('now') WHERE store_id = ? AND status IN ('pendiente','aceptado')"
  ).run(store.id);
  const publicCount = db.prepare(
    "SELECT COUNT(*) AS c FROM products WHERE store_id = ? AND status = 'publicado'"
  ).get(store.id).c;
  const updateResult = db.prepare("UPDATE stores SET updated_at = datetime('now') WHERE id = ?").run(store.id);
  const total = db.prepare("SELECT COUNT(*) AS c FROM products WHERE store_id = ?").get(store.id).c;
  const publishedNew = db.prepare(
    "SELECT COUNT(*) AS c FROM products WHERE store_id = ? AND status = 'publicado'"
  ).get(store.id).c;
  res.json({
    ok: true,
    store,
    store_id: store.id,
    published: publishedNew,
    justPublished: published.changes,
    publicCount,
    message: `Tienda actualizada: ${published.changes} producto(s) subido(s), ${publishedNew} en total`
  });
});

app.post('/api/stores/:id/auto-update', (req, res) => {
  const store = db.prepare('SELECT * FROM stores WHERE id = ?').get(req.params.id);
  if (!store) return res.status(404).json({ error: 'Tienda no encontrada' });
  db.prepare(
    "UPDATE products SET status='publicado', published_at=datetime('now') WHERE store_id = ? AND status='pendiente'"
  ).run(store.id);
  db.prepare("UPDATE stores SET updated_at = datetime('now') WHERE id = ?").run(store.id);
  res.json({ ok: true, message: 'Actualización automática completada' });
});

app.get('/api/stores/:slug/public', (req, res) => {
  const store = db.prepare('SELECT * FROM stores WHERE slug = ?').get(req.params.slug);
  if (!store) return res.status(404).json({ error: 'Tienda no encontrada' });
  if (store.status !== 'activa') return res.status(403).json({ error: 'Tienda inactiva' });
  const products = db.prepare(
    "SELECT * FROM products WHERE store_id = ? AND status = 'publicado' ORDER BY rating DESC, reviews_count DESC"
  ).all(store.id);
  const format = getSetting('store_format', {});
  res.json({ store, products, format });
});

app.delete('/api/stores/:id', (req, res) => {
  db.prepare('DELETE FROM stores WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

/* ===================== AFILIADOS ===================== */

app.get('/api/affiliate-accounts', (req, res) => {
  const rows = db.prepare('SELECT * FROM affiliate_accounts ORDER BY id').all();
  res.json(rows.map((a) => ({
    ...a,
    signup_url: a.marketplace === 'amazon.es'
      ? 'https://afiliados.amazon.es/'
      : 'https://affiliate-program.amazon.com/'
  })));
});

app.post('/api/affiliate-accounts', (req, res) => {
  const { name, email, tracking_id, marketplace, notes } = req.body;
  if (!name || !tracking_id) return res.status(400).json({ error: 'Nombre y tracking ID obligatorios' });
  const info = db.prepare(
    `INSERT INTO affiliate_accounts (name, email, tracking_id, marketplace, notes)
     VALUES (?, ?, ?, ?, ?)`
  ).run(name, email || '', tracking_id, marketplace || 'amazon.es', notes || '');
  const acc = db.prepare('SELECT * FROM affiliate_accounts WHERE id = ?').get(info.lastInsertRowid);
  res.json({ ...acc, signup_url: acc.marketplace === 'amazon.es' ? 'https://afiliados.amazon.es/' : 'https://affiliate-program.amazon.com/' });
});

app.put('/api/affiliate-accounts/:id', (req, res) => {
  const { name, email, tracking_id, marketplace, status, notes } = req.body;
  db.prepare(
    `UPDATE affiliate_accounts SET name=COALESCE(?,name), email=COALESCE(?,email), tracking_id=COALESCE(?,tracking_id),
     marketplace=COALESCE(?,marketplace), status=COALESCE(?,status), notes=COALESCE(?,notes) WHERE id=?`
  ).run(name ?? null, email ?? null, tracking_id ?? null, marketplace ?? null, status ?? null, notes ?? null, req.params.id);
  res.json(db.prepare('SELECT * FROM affiliate_accounts WHERE id = ?').get(req.params.id));
});

app.delete('/api/affiliate-accounts/:id', (req, res) => {
  db.prepare('DELETE FROM affiliate_accounts WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

/* ===================== COBROS / RETIRADAS ===================== */

app.get('/api/payment-methods', (req, res) => {
  const rows = db.prepare('SELECT * FROM payment_methods ORDER BY id').all();
  res.json(rows.map((r) => ({ ...r, config: JSON.parse(r.config) })));
});

app.post('/api/payment-methods', (req, res) => {
  const { name, type, enabled, config } = req.body;
  const info = db.prepare(
    'INSERT INTO payment_methods (name, type, enabled, config) VALUES (?, ?, ?, ?)'
  ).run(name, type, enabled ? 1 : 0, JSON.stringify(config || {}));
  res.json(db.prepare('SELECT * FROM payment_methods WHERE id = ?').get(info.lastInsertRowid));
});

app.put('/api/payment-methods/:id', (req, res) => {
  const { name, enabled, config } = req.body;
  db.prepare('UPDATE payment_methods SET name=COALESCE(?,name), enabled=COALESCE(?,enabled), config=? WHERE id=?')
    .run(name ?? null, enabled ?? null, JSON.stringify(config || {}), req.params.id);
  res.json(db.prepare('SELECT * FROM payment_methods WHERE id = ?').get(req.params.id));
});

app.delete('/api/payment-methods/:id', (req, res) => {
  db.prepare('DELETE FROM payment_methods WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.get('/api/withdrawals', (req, res) => {
  const rows = db.prepare('SELECT * FROM withdrawals ORDER BY id DESC').all();
  res.json(rows);
});

app.post('/api/withdrawals', (req, res) => {
  const { amount, method, notes } = req.body;
  const val = cleanNum(amount);
  if (val <= 0) return res.status(400).json({ error: 'Importe no válido' });
  const balance = getBalance();
  if (val > balance) return res.status(400).json({ error: `Saldo insuficiente (saldo disponible: ${balance.toFixed(2)})` });
  const methodRow = db.prepare('SELECT * FROM payment_methods WHERE id = ?').get(method);
  if (!methodRow) return res.status(400).json({ error: 'Método de pago no válido' });
  const info = db.prepare(
    'INSERT INTO withdrawals (amount, method, notes) VALUES (?, ?, ?)'
  ).run(val, methodRow.name, notes || '');
  const w = db.prepare('SELECT * FROM withdrawals WHERE id = ?').get(info.lastInsertRowid);
  const balanceNow = getBalance();
  res.json({ withdrawal: w, balance: balanceNow });
});

app.post('/api/withdrawals/:id/status', (req, res) => {
  const { status } = req.body;
  db.prepare("UPDATE withdrawals SET status = ?, processed_at = datetime('now') WHERE id = ?")
    .run(status, req.params.id);
  res.json(db.prepare('SELECT * FROM withdrawals WHERE id = ?').get(req.params.id));
});

app.delete('/api/withdrawals/:id', (req, res) => {
  db.prepare('DELETE FROM withdrawals WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

function getBalance() {
  const earned = db.prepare('SELECT COALESCE(SUM(amount),0) AS s FROM earnings').get().s;
  const withdrawn = db.prepare("SELECT COALESCE(SUM(amount),0) AS s FROM withdrawals WHERE status IN ('pagado','en proceso')").get().s;
  return cleanNum(earned) - cleanNum(withdrawn);
}

app.get('/api/balance', (req, res) => {
  const earned = db.prepare('SELECT COALESCE(SUM(amount),0) AS s FROM earnings').get().s;
  const pending = db.prepare("SELECT COALESCE(SUM(amount),0) AS s FROM withdrawals WHERE status IN ('pendiente','en proceso')").get().s;
  const paid = db.prepare("SELECT COALESCE(SUM(amount),0) AS s FROM withdrawals WHERE status = 'pagado'").get().s;
  res.json({
    earned,
    pending,
    paid,
    available: cleanNum(earned) - cleanNum(paid)
  });
});

/* ===================== VENTAS (REGISTRO MANUAL/AUTOMÁTICO) ===================== */

app.post('/api/sales', (req, res) => {
  const { product_id, store_id, amount, date } = req.body;
  const info = db.prepare(
    'INSERT INTO sales_events (product_id, store_id, amount, date) VALUES (?, ?, ?, ?)'
  ).run(product_id || null, store_id || null, cleanNum(amount), date || new Date().toISOString().slice(0, 10));
  db.prepare(
    'INSERT INTO earnings (product_id, store_id, amount, type, date) VALUES (?, ?, ?, ?, ?)'
  ).run(product_id || null, store_id || null, cleanNum(amount), 'venta', date || new Date().toISOString().slice(0, 10));
  res.json(db.prepare('SELECT * FROM sales_events WHERE id = ?').get(info.lastInsertRowid));
});

app.post('/api/clicks', (req, res) => {
  const { product_id, store_id, count } = req.body;
  const today = new Date().toISOString().slice(0, 10);
  const existing = db.prepare(
    'SELECT id, clicks FROM earnings WHERE product_id = ? AND date = ? AND type = ?'
  ).get(product_id || null, today, 'click');
  if (existing) {
    db.prepare('UPDATE earnings SET clicks = ? WHERE id = ?').run(existing.clicks + cleanNum(count), existing.id);
  } else {
    db.prepare(
      'INSERT INTO earnings (product_id, store_id, amount, type, clicks, date) VALUES (?, ?, 0, ?, ?, ?)'
    ).run(product_id || null, store_id || null, 'click', cleanNum(count), today);
  }
  res.json({ ok: true });
});

/* ===================== AJUSTES ===================== */

app.get('/api/settings', (req, res) => {
  res.json({
    amazon: getSetting('amazon', {}),
    general: getSetting('general', {}),
    store_format: getSetting('store_format', {})
  });
});

app.put('/api/settings', (req, res) => {
  const { section, ...values } = req.body;
  if (!section) return res.status(400).json({ error: 'Sección no indicada' });
  const current = getSetting(section, {});
  setSetting(section, { ...current, ...values });
  res.json(getSetting(section, {}));
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

/* ===================== SERVIDOR ESTÁTICO (PRODUCCIÓN) ===================== */

const distDir = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`DeCasa servidor escuchando en http://localhost:${PORT}`);
});
