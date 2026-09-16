import React, { useState, useEffect } from 'react';
import { api } from '../api.js';

const SECURE_OPTIONS = [
  { id: 'none', label: 'FTP (sin cifrar)', desc: 'Puerto 21' },
  { id: 'ftps', label: 'FTPS (cifrado)', desc: 'Puerto 990' },
  { id: 'sftp', label: 'SFTP (SSH)', desc: 'Puerto 22' }
];

export default function PublishConfigModal({ storeId, onClose, onSaved }) {
  const [cfg, setCfg] = useState({
    host: '', port: '21', user: '', password: '',
    remote_path: '', public_url: '', secure: 'none'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    api.getPublishConfig(storeId).then((c) => {
      setCfg({
        host: c.host || '',
        port: c.port || '21',
        user: c.user || '',
        password: '',
        remote_path: c.remote_path || '',
        public_url: c.public_url || '',
        secure: c.secure || 'none'
      });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [storeId]);

  const set = (k, v) => setCfg((c) => ({ ...c, [k]: v }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...cfg };
      if (!payload.password) delete payload.password;
      await api.savePublishConfig(storeId, payload);
      setToast({ msg: 'Configuración FTP guardada', type: 'ok' });
      setTimeout(() => { onSaved(); onClose(); }, 800);
    } catch (err) {
      setToast({ msg: err.message, type: 'err' });
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.testPublish(storeId);
      setTestResult(res);
      setToast({ msg: res.message, type: 'ok' });
    } catch (err) {
      setTestResult({ error: err.message });
      setToast({ msg: err.message, type: 'err' });
    } finally {
      setTesting(false);
    }
  };

  if (loading) return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <p className="muted">Cargando configuración…</p>
      </div>
    </div>
  );

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>🌐 Configurar publicación web</h3>
        <p className="muted" style={{ marginBottom: 14 }}>
          Configura la conexión FTP para publicar tu tienda en tu hosting o servidor web.
        </p>

        <form onSubmit={save}>
          <div className="field">
            <label>Servidor FTP / Host</label>
            <input className="input" value={cfg.host} onChange={(e) => set('host', e.target.value)}
              placeholder="ftp.tutienda.com" required />
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <div className="field" style={{ flex: 1 }}>
              <label>Puerto</label>
              <input className="input" value={cfg.port} onChange={(e) => set('port', e.target.value)} placeholder="21" />
            </div>
            <div className="field" style={{ flex: 2 }}>
              <label>Protocolo</label>
              <div className="row" style={{ gap: 6 }}>
                {SECURE_OPTIONS.map((o) => (
                  <button key={o.id} type="button"
                    className={'btn btn-sm ' + (cfg.secure === o.id ? 'btn-primary' : 'btn-ghost')}
                    onClick={() => { set('secure', o.id); if (o.id === 'ftps') set('port', '990'); else if (o.id === 'sftp') set('port', '22'); else set('port', '21'); }}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <div className="field" style={{ flex: 1 }}>
              <label>Usuario</label>
              <input className="input" value={cfg.user} onChange={(e) => set('user', e.target.value)}
                placeholder="usuario@tutienda.com" required />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Contraseña</label>
              <input className="input" type="password" value={cfg.password} onChange={(e) => set('password', e.target.value)}
                placeholder={cfg.password === '' ? 'Déjalo vacío para no cambiar' : ''} />
            </div>
          </div>

          <div className="field">
            <label>Ruta remota (directorio en el servidor)</label>
            <input className="input" value={cfg.remote_path} onChange={(e) => set('remote_path', e.target.value)}
              placeholder="public_html/tienda (dejar vacío = raíz del FTP)" />
          </div>

          <div className="field">
            <label>URL pública de la tienda</label>
            <input className="input" value={cfg.public_url} onChange={(e) => set('public_url', e.target.value)}
              placeholder="https://tutienda.com/tienda" />
          </div>

          <div className="row between" style={{ marginTop: 6 }}>
            <button type="button" className="btn btn-ghost"
              disabled={testing || !cfg.host}
              onClick={test}>
              {testing ? 'Probando…' : '🔌 Probar conexión'}
            </button>
            {testResult && !testResult.error && (
              <span className="pill" style={{ background: '#dcfce7', color: '#166534' }}>✅ Conectado</span>
            )}
            {testResult?.error && (
              <span className="pill" style={{ background: '#fee2e2', color: '#991b1b' }}>❌ Error</span>
            )}
          </div>

          <div className="row between" style={{ marginTop: 16 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-green" disabled={saving}>
              {saving ? 'Guardando…' : '💾 Guardar configuración'}
            </button>
          </div>
        </form>

        {toast && <div className={'toast ' + toast.type}>{toast.msg}</div>}
      </div>
    </div>
  );
}
