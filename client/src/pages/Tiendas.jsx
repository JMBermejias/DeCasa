import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import StoreFormatModal from '../components/StoreFormatModal.jsx';
import PublishConfigModal from '../components/PublishConfigModal.jsx';

export default function Tiendas() {
  const [stores, setStores] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [showFormat, setShowFormat] = useState(null);
  const [showPublish, setShowPublish] = useState(null);
  const [format, setFormat] = useState(null);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(null);
  const [publishBusy, setPublishBusy] = useState(null);

  const notify = (msg, type = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  };

  useEffect(() => {
    api.getStores().then(setStores).catch(console.error);
    api.getSettings().then((s) => setFormat(s.store_format)).catch(console.error);
  }, []);

  const refresh = () => api.getStores().then(setStores);

  const createStore = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return notify('El nombre es obligatorio', 'err');
    const store = await api.createStore({ name: newName, description: newDesc });
    setNewName('');
    setNewDesc('');
    setShowNew(false);
    refresh();
    notify(`Tienda "${store.name}" creada`);
  };

  const toggleMode = async (s) => {
    const updated = await api.updateStore(s.id, { mode: s.mode === 'automatica' ? 'manual' : 'automatica' });
    refresh();
    notify(`Modo ${updated.mode} para "${updated.name}"`);
  };

  const toggleStatus = async (s) => {
    await api.updateStore(s.id, { status: s.status === 'activa' ? 'inactiva' : 'activa' });
    refresh();
  };

  const upload = async (s) => {
    setBusy(s.id);
    try {
      const res = await api.uploadStore(s.id);
      notify(res.message);
      refresh();
    } catch (err) {
      notify(err.message, 'err');
    } finally {
      setBusy(null);
    }
  };

  const autoUpdate = async (s) => {
    setBusy(s.id);
    try {
      const res = await api.autoUpdateStore(s.id);
      notify(res.message);
      refresh();
    } catch (err) {
      notify(err.message, 'err');
    } finally {
      setBusy(null);
    }
  };

  const remove = async (s) => {
    if (!confirm(`¿Eliminar la tienda "${s.name}"?`)) return;
    await api.deleteStore(s.id);
    refresh();
    notify('Tienda eliminada');
  };

  const publishWeb = async (s) => {
    setPublishBusy(s.id);
    try {
      const res = await api.publishStore(s.id);
      notify(res.message || 'Tienda publicada en la web');
    } catch (err) {
      notify(err.message, 'err');
    } finally {
      setPublishBusy(null);
    }
  };

  const applyFormat = async (fmt) => {
    await api.saveSettings('store_format', fmt);
    setFormat(fmt);
    setShowFormat(null);
    notify('Formato de tienda guardado ✅');
  };

  const publicUrl = (slug) => window.location.origin + '/tienda/' + slug;

  return (
    <div>
      <div className="row between mb">
        <h1 style={{ margin: 0 }}>Tiendas online</h1>
        <div className="row">
          <button className="btn btn-ghost" onClick={() => setShowFormat('global')}>🎨 Definir formato</button>
          <button className="btn btn-primary" onClick={() => setShowNew(true)}>+ Nueva tienda</button>
        </div>
      </div>

      <div className="grid grid-3">
        {stores.map((s) => (
          <div key={s.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="row between">
              <div>
                <h2 style={{ margin: 0 }}>{s.name}</h2>
                <div className="muted" style={{ fontSize: 12 }}>/{s.slug}</div>
              </div>
              <span className={'badge ' + (s.status === 'activa' ? 'badge-activa' : 'badge-rechazado')}>
                {s.status}
              </span>
            </div>

            <div className="row" style={{ gap: 6 }}>
              <span className={'badge ' + (s.mode === 'automatica' ? 'badge-automatica' : 'badge-manual')}>
                {s.mode === 'automatica' ? '⚡ Automática' : '🖐 Manual'}
              </span>
              <span className="pill">📦 {s.published}/{s.products} publicados</span>
            </div>

            <div className="row" style={{ gap: 6 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => toggleMode(s)}>
                Cambiar a {s.mode === 'automatica' ? 'manual' : 'automática'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowFormat(s)}>🎨 Formato</button>
              <button className="btn btn-ghost btn-sm" onClick={toggleStatus}>
                {s.status === 'activa' ? 'Desactivar' : 'Activar'}
              </button>
            </div>

            <div className="row" style={{ gap: 8 }}>
              <button className="btn btn-primary grow" disabled={busy === s.id} onClick={() => upload(s)}>
                {busy === s.id ? 'Subiendo…' : '🚀 Subir / Actualizar'}
              </button>
              {s.mode === 'automatica' && (
                <button className="btn btn-ghost" title="Actualización totalmente automática de productos pendientes" onClick={() => autoUpdate(s)}>
                  ⚡
                </button>
              )}
            </div>

            <div className="row" style={{ gap: 8 }}>
              <button className="btn btn-green grow" disabled={publishBusy === s.id} onClick={() => publishWeb(s)}>
                {publishBusy === s.id ? 'Publicando…' : '📤 Publicar en web real'}
              </button>
              <button className="btn btn-ghost" title="Configurar conexión FTP" onClick={() => setShowPublish(s)}>
                🌐
              </button>
            </div>

            <div className="row between">
              <a className="btn btn-ghost btn-sm" href={publicUrl(s.slug)} target="_blank" rel="noreferrer">
                👁 Ver tienda pública
              </a>
              <a className="btn btn-ghost btn-sm" href={api.publishPreviewUrl(s.id)} target="_blank" rel="noreferrer">
                📄 Vista web estática
              </a>
              <button className="btn btn-red btn-sm" onClick={() => remove(s)}>Eliminar</button>
            </div>
          </div>
        ))}
      </div>

      {stores.length === 0 && (
        <div className="card">
          <div className="muted mb">No hay tiendas. Crea la primera para empezar a vender.</div>
          <button className="btn btn-primary" onClick={() => setShowNew(true)}>+ Crear tienda</button>
        </div>
      )}

      {showNew && (
        <div className="modal-backdrop" onClick={() => setShowNew(false)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={createStore}>
            <h3>Nueva tienda online</h3>
            <div className="field">
              <label>Nombre</label>
              <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Mi tienda de regalos" />
            </div>
            <div className="field">
              <label>Descripción</label>
              <textarea className="textarea" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Descripción breve de la tienda" />
            </div>
            <div className="row between">
              <button type="button" className="btn btn-ghost" onClick={() => setShowNew(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary">Crear tienda</button>
            </div>
          </form>
        </div>
      )}

      {showFormat && format && (
        <StoreFormatModal
          initial={format}
          store={showFormat && showFormat !== 'global' ? showFormat : null}
          onSave={applyFormat}
          onClose={() => setShowFormat(null)}
        />
      )}

      {showPublish && (
        <PublishConfigModal
          storeId={showPublish.id}
          storeName={showPublish.name}
          onClose={() => setShowPublish(null)}
          onSaved={() => notify('Configuración FTP guardada')}
        />
      )}

      {toast && <div className={'toast ' + toast.type}>{toast.msg}</div>}
    </div>
  );
}
