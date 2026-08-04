import React, { useEffect, useState } from 'react';
import { api, money } from '../api.js';

const CATEGORIES = [
  'Todos', 'Hogar y cocina', 'Electrónica', 'Deportes y aire libre', 'Belleza',
  'Jardín', 'Moda', 'Juguetes', 'Oficina y papelería'
];

const DEMO_SORT = [
  { label: 'Mejor valorados', key: 'rating' },
  { label: 'Más reseñas', key: 'reviews_count' },
  { label: 'Precio más bajo', key: 'price' }
];

function Stars({ rating }) {
  const full = Math.round(rating || 0);
  return (
    <span className="stars">
      {'★'.repeat(full)}
      <span className="muted">{'★'.repeat(5 - full)}</span>
    </span>
  );
}

export default function Buscador() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Todos');
  const [storeId, setStoreId] = useState('');
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [demo, setDemo] = useState(false);
  const [warning, setWarning] = useState(null);
  const [sort, setSort] = useState('rating');
  const [myProducts, setMyProducts] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [toast, setToast] = useState(null);
  const [filter, setFilter] = useState('pendiente');

  const notify = (msg, type = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  };

  useEffect(() => {
    api.getStores().then(setStores).catch(console.error);
    loadProducts();
  }, []);

  const loadProducts = () => {
    api.getProducts().then(setMyProducts).catch(console.error);
  };

  const search = async (e) => {
    e.preventDefault();
    if (!query.trim()) return notify('Escribe qué productos buscar', 'err');
    setLoading(true);
    try {
      const res = await api.searchProducts(query, category, storeId || null);
      setResults(res.products);
      setDemo(res.demo);
      setWarning(res.warning);
      loadProducts();
      if (res.demo) {
        notify('Modo demostración: configura tus claves de Amazon en Panel de control', 'err');
      }
    } catch (err) {
      notify(err.message, 'err');
    } finally {
      setLoading(false);
    }
  };

  const accept = async (p) => {
    try {
      const updated = await api.acceptProduct(p.id, storeId || p.store_id || null);
      notify(`"${updated.title.slice(0, 50)}…" subido a la tienda ✅`);
      setResults((rs) => rs.map((r) => (r.asin === p.asin ? { ...r, status: 'publicado' } : r)));
      loadProducts();
    } catch (err) {
      notify(err.message, 'err');
    }
  };

  const reject = async (p) => {
    await api.rejectProduct(p.id);
    notify('Producto rechazado');
    loadProducts();
  };

  const toggle = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const acceptAll = async () => {
    const ids = [...selected];
    if (!ids.length) return notify('Selecciona al menos un producto', 'err');
    await api.acceptBatch(ids, storeId || null);
    notify(`${ids.length} productos subidos a la tienda ✅`);
    setSelected(new Set());
    loadProducts();
  };

  const sorted = [...results].sort((a, b) =>
    sort === 'price' ? (a.price || 0) - (b.price || 0) : (b[sort] || 0) - (a[sort] || 0)
  );

  const filtered = myProducts.filter((p) => filter === 'todos' || p.status === filter);

  return (
    <div>
      <div className="row between mb">
        <h1 style={{ margin: 0 }}>Buscador de productos</h1>
        <span className="pill">🕒 Revisa y decide qué productos subir</span>
      </div>

      <form className="search-bar mb" onSubmit={search}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Busca productos con mejores reseñas en Amazon… (ej: cafetera, auriculares, batidora)"
        />
        <select className="select" style={{ maxWidth: 190 }} value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        {stores.length > 0 && (
          <select className="select" style={{ maxWidth: 200 }} value={storeId} onChange={(e) => setStoreId(e.target.value)}>
            <option value="">Tienda: sin asignar</option>
            {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Buscando…' : '🔍 Buscar'}
        </button>
      </form>

      {demo && (
        <div className="alert alert-warn mb">
          ⚠️ <strong>Modo demostración.</strong> Los resultados son de ejemplo. Configura tus credenciales de la
          API de Amazon (PA-API) y tu ID de afiliado en <strong>Panel de control</strong> para buscar productos reales.
        </div>
      )}
      {warning && <div className="alert alert-err mb">{warning}</div>}

      {results.length > 0 && (
        <>
          <div className="row between mb">
            <div>
              <strong>{results.length} resultados</strong> <span className="muted">para “{query}”</span>
            </div>
            <div className="row">
              <select className="select" style={{ width: 160 }} value={sort} onChange={(e) => setSort(e.target.value)}>
                {DEMO_SORT.map((s) => <option key={s.key} value={s.key}>Ordenar: {s.label}</option>)}
              </select>
              {selected.size > 0 && (
                <button className="btn btn-green" onClick={acceptAll}>
                  ✅ Subir {selected.size} seleccionado{selected.size > 1 ? 's' : ''}
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-3 mb">
            {sorted.map((p) => (
              <div key={p.asin} className="product-card">
                {p.image_url && (
                  <img
                    className="product-img"
                    src={p.image_url}
                    alt={p.title}
                    onClick={() => p.url && window.open(p.url, '_blank')}
                    title="Abrir en Amazon"
                  />
                )}
                <div className="product-body">
                  <div className="row" style={{ gap: 6 }}>
                    <span className="pill">{p.category || 'General'}</span>
                    {p.rating > 0 && <Stars rating={p.rating} />}
                  </div>
                  <div className="product-title">{p.title}</div>
                  <div>
                    <span className="product-price">
                      {p.price ? money(p.price) : 'Consultar precio'}
                      {p.original_price && <span className="old">{money(p.original_price)}</span>}
                    </span>
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    ⭐ {p.rating || '—'} · {p.reviews_count?.toLocaleString('es-ES')} reseñas
                  </div>
                  <div className="row" style={{ gap: 6 }}>
                    <label className="row" style={{ fontSize: 12, gap: 5, cursor: 'pointer' }}>
                      <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
                      Seleccionar
                    </label>
                    {p.exists && (
                      <span className={'badge ' + (p.status === 'publicado' ? 'badge-publicado' : p.status === 'rechazado' ? 'badge-rechazado' : 'badge-pendiente')}>
                        {p.status}
                      </span>
                    )}
                  </div>
                  <div className="product-actions">
                    <button className="btn btn-green btn-sm" disabled={p.status === 'publicado'} onClick={() => accept(p)}>
                      {p.status === 'publicado' ? '✔ Subido' : 'Aceptar y subir'}
                    </button>
                    <button className="btn btn-red btn-sm" onClick={() => reject(p)} disabled={p.status === 'rechazado'}>
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="card">
        <div className="card-title">
          <h2>Mis productos revisados</h2>
          <div className="tabs" style={{ margin: 0, border: 'none' }}>
            {['pendiente', 'publicado', 'rechazado', 'todos'].map((f) => (
              <button key={f} className={'tab' + (filter === f ? ' active' : '')} onClick={() => setFilter(f)} style={{ padding: '6px 12px' }}>
                {f === 'todos' ? 'Todos' : f}
              </button>
            ))}
          </div>
        </div>
        {filtered.length === 0 ? (
          <div className="muted">No hay productos en esta categoría. Busca y acepta productos para publicarlos en tu tienda.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th></th><th>Producto</th><th>Categoría</th><th>Precio</th><th>Valoración</th><th>Estado</th><th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td>{p.image_url && <img src={p.image_url} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover' }} />}</td>
                  <td>
                    <div style={{ fontWeight: 600, maxWidth: 300 }}>{p.title}</div>
                    <div className="muted" style={{ fontSize: 11.5 }}>{p.asin}</div>
                  </td>
                  <td>{p.category}</td>
                  <td><strong>{p.price ? money(p.price) : '—'}</strong></td>
                  <td>★ {p.rating} <span className="muted">({p.reviews_count})</span></td>
                  <td><span className={'badge badge-' + p.status}>{p.status}</span></td>
                  <td>
                    <div className="row" style={{ gap: 6 }}>
                      {p.status !== 'publicado' && (
                        <button className="btn btn-green btn-xs" onClick={() => accept(p)}>Subir</button>
                      )}
                      {p.status !== 'rechazado' && (
                        <button className="btn btn-red btn-xs" onClick={() => reject(p)}>Rechazar</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {toast && <div className={'toast ' + toast.type}>{toast.msg}</div>}
    </div>
  );
}
