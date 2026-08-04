import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, money } from '../api.js';

function Stars({ rating }) {
  const full = Math.round(rating || 0);
  return (
    <span style={{ color: '#f59e0b', fontSize: 13 }}>
      {'★'.repeat(full)}
      <span style={{ color: '#cbd5e1' }}>{'★'.repeat(Math.max(0, 5 - full))}</span>
    </span>
  );
}

export default function PublicStore() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.publicStore(slug).then(setData).catch((err) => setError(err.message));
  }, [slug]);

  if (error) {
    return (
      <div className="pub-content">
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 40 }}>🏠</div>
          <h2>Tienda no disponible</h2>
          <p className="muted">{error}</p>
          <Link to="/" className="btn btn-primary">Ir al panel de DeCasa</Link>
        </div>
      </div>
    );
  }

  if (!data) return <div className="pub-content muted">Cargando tienda…</div>;

  const { store, products, format } = data;
  const accent = format?.accent_color || store.accent_color || '#38bdf8';
  const gridStyle = { gridTemplateColumns: `repeat(auto-fill, minmax(${Math.max(190, 240 - (format?.cards_per_row || 4) * 15)}px, 1fr))` };
  const showPrices = format?.show_prices !== false && store.show_prices !== 0;

  return (
    <div>
      <div className="pub-header" style={{ background: `linear-gradient(120deg, ${accent}, ${accent}dd)` }}>
        <h1>{format?.title || store.name}</h1>
        {format?.banner_text && <p style={{ margin: 0, opacity: 0.95 }}>{format.banner_text}</p>}
        {store.description && <p style={{ margin: '6px 0 0', opacity: 0.9 }}>{store.description}</p>}
      </div>

      <div className="pub-content">
        <div className="row between mb" style={{ justifyContent: 'space-between' }}>
          <span className="pill" style={{ padding: '6px 14px' }}>
            🛍️ {products.length} productos · Envíos y ventas gestionados por Amazon
          </span>
          <span className="muted" style={{ fontSize: 12 }}>Tienda creada con DeCasa</span>
        </div>

        {products.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 36 }}>🛒</div>
            <h3>La tienda se está preparando</h3>
            <p className="muted">El administrador está revisando productos para publicarlos. ¡Vuelve pronto!</p>
          </div>
        ) : (
          <div className="grid pub-grid" style={gridStyle}>
            {products.map((p) => (
              <div key={p.id} className="pub-card">
                {p.image_url && <img src={p.image_url} alt={p.title} loading="lazy" />}
                <div className="pub-card-body">
                  <div className="row" style={{ gap: 6 }}>
                    <span className="pill">{p.category}</span>
                    {format?.show_badge && p.reviews_count > 500 && (
                      <span className="badge badge-publicado">🥇 Mejor valorado</span>
                    )}
                  </div>
                  <h3>{p.title}</h3>
                  <div className="row" style={{ gap: 8 }}>
                    <Stars rating={p.rating} />
                    <span className="muted" style={{ fontSize: 12 }}>({p.reviews_count?.toLocaleString('es-ES')})</span>
                  </div>
                  {showPrices && p.price && (
                    <div style={{ fontSize: 19, fontWeight: 800, color: accent }}>
                      {money(p.price)}
                      {p.original_price && (
                        <span style={{ fontSize: 13, fontWeight: 500, color: '#94a3b8', textDecoration: 'line-through', marginLeft: 8 }}>
                          {money(p.original_price)}
                        </span>
                      )}
                    </div>
                  )}
                  <a className="pub-btn" style={{ background: accent }} href={p.url} target="_blank" rel="noreferrer noopener">
                    Ver en Amazon →
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="alert alert-info mt" style={{ marginTop: 32 }}>
          🛡️ Esta tienda funciona mediante enlaces de afiliado de Amazon. Los pedidos, envíos y devoluciones los
          gestiona Amazon directamente; tú compras con total seguridad en la web oficial de Amazon.
        </div>
      </div>
    </div>
  );
}
