import React, { useState } from 'react';

const LAYOUTS = [
  { id: 'grid', label: 'Cuadrícula', icon: '🔲', desc: 'Tarjetas uniformes en filas' },
  { id: 'list', label: 'Lista', icon: '📋', desc: 'Productos en lista vertical' },
  { id: 'carousel', label: 'Carrusel', icon: '🎠', desc: 'Deslizador horizontal destacado' },
  { id: 'masonry', label: 'Mosaico', icon: '🧩', desc: 'Alturas variables, estilo Pinterest' }
];

const THEMES = [
  { id: 'moderno', label: 'Moderno', icon: '✨' },
  { id: 'minimal', label: 'Minimalista', icon: '⬜' },
  { id: 'elegante', label: 'Elegante', icon: '💎' },
  { id: 'vibrante', label: 'Vibrante', icon: '🌈' }
];

const COLORS = ['#38bdf8', '#0ea5e9', '#3b82f6', '#22c55e', '#a78bfa', '#f59e0b', '#ef4444', '#0f2a3d'];

export default function StoreFormatModal({ initial, store, onSave, onClose }) {
  const [fmt, setFmt] = useState({ ...initial });

  const set = (k, v) => setFmt((f) => ({ ...f, [k]: v }));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>🎨 Formato de la tienda online</h3>
        {store ? (
          <p className="muted">Configuración aplicada a la tienda <strong>{store.name}</strong>.</p>
        ) : (
          <p className="muted">Configuración global que se aplica por defecto a todas las tiendas.</p>
        )}

        <div className="field">
          <label>Título de la tienda</label>
          <input className="input" value={fmt.title || ''} onChange={(e) => set('title', e.target.value)} />
        </div>

        <div className="field">
          <label>Disposición</label>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
            {LAYOUTS.map((l) => (
              <button key={l.id} type="button"
                className={'btn ' + (fmt.layout === l.id ? 'btn-primary' : 'btn-ghost')}
                style={{ flexDirection: 'column', gap: 4 }}
                onClick={() => set('layout', l.id)}>
                <span style={{ fontSize: 20 }}>{l.icon}</span>
                <strong>{l.label}</strong>
                <small className="muted" style={{ fontSize: 10.5 }}>{l.desc}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Tema</label>
          <div className="row">
            {THEMES.map((t) => (
              <button key={t.id} type="button"
                className={'btn ' + (fmt.theme === t.id ? 'btn-primary' : 'btn-ghost')}
                onClick={() => set('theme', t.id)}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Color de acento</label>
          <div className="row">
            {COLORS.map((c) => (
              <button key={c} type="button"
                onClick={() => set('accent_color', c)}
                style={{
                  width: 34, height: 34, borderRadius: 10, background: c, border: '2px solid',
                  borderColor: fmt.accent_color === c ? '#0f2a3d' : '#fff',
                  cursor: 'pointer'
                }}
              />
            ))}
          </div>
        </div>

        <div className="row" style={{ gap: 18, marginBottom: 14 }}>
          <label className="row" style={{ gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={!!fmt.show_prices} onChange={(e) => set('show_prices', e.target.checked)} />
            Mostrar precios
          </label>
          <label className="row" style={{ gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={!!fmt.show_badge} onChange={(e) => set('show_badge', e.target.checked)} />
            Insignia “Mejor valorado”
          </label>
        </div>

        <div className="field">
          <label>Productos por fila</label>
          <input type="range" min="2" max="6" value={fmt.cards_per_row || 4}
            onChange={(e) => set('cards_per_row', Number(e.target.value))} style={{ width: '100%' }} />
          <span className="muted">{fmt.cards_per_row || 4} columnas</span>
        </div>

        <div className="field">
          <label>Texto del banner superior</label>
          <input className="input" value={fmt.banner_text || ''} onChange={(e) => set('banner_text', e.target.value)}
            placeholder="Ej: Envíos gratis con Amazon Prime" />
        </div>

        <div className="row between">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn btn-green" onClick={() => onSave(fmt)}>Guardar formato</button>
        </div>
      </div>
    </div>
  );
}
