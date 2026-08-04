import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

const TABS = [
  { id: 'amazon', label: '🔗 Amazon API' },
  { id: 'pagos', label: '💳 Métodos de pago' },
  { id: 'general', label: '⚙️ Generales' }
];

const METHOD_ICONS = { paypal: '🅿️', transferencia: '🏦', tarjeta: '💳', cripto: '🪙', cheque: '📄' };

export default function Ajustes() {
  const [tab, setTab] = useState('amazon');
  const [settings, setSettings] = useState(null);
  const [methods, setMethods] = useState([]);
  const [amazon, setAmazon] = useState({});
  const [general, setGeneral] = useState({});
  const [showMethod, setShowMethod] = useState(false);
  const [mForm, setMForm] = useState({ name: '', type: 'paypal', enabled: 1, config: {} });
  const [toast, setToast] = useState(null);

  const notify = (msg, type = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  };

  useEffect(() => {
    api.getSettings().then((s) => {
      setSettings(s);
      setAmazon(s.amazon);
      setGeneral(s.general);
    }).catch(console.error);
    api.getMethods().then(setMethods).catch(console.error);
  }, []);

  const saveAmazon = async (e) => {
    e.preventDefault();
    const saved = await api.saveSettings('amazon', amazon);
    setAmazon(saved);
    notify('Credenciales de Amazon guardadas ✅');
  };

  const saveGeneral = async (e) => {
    e.preventDefault();
    const saved = await api.saveSettings('general', general);
    setGeneral(saved);
    notify('Ajustes generales guardados ✅');
  };

  const toggleMethod = async (m) => {
    await api.updateMethod(m.id, { enabled: m.enabled ? 0 : 1, config: m.config });
    api.getMethods().then(setMethods);
  };

  const submitMethod = async (e) => {
    e.preventDefault();
    if (!mForm.name) return notify('El nombre es obligatorio', 'err');
    if (mForm.type === 'paypal') mForm.config = { email: mForm.email || '' };
    if (mForm.type === 'transferencia') mForm.config = { IBAN: mForm.iban || '', Banco: mForm.bank || '' };
    if (mForm.type === 'cripto') mForm.config = { cartera: mForm.wallet || '' };
    if (mForm.type === 'cheque') mForm.config = { dirección: mForm.address || '' };
    await api.createMethod({ name: mForm.name, type: mForm.type, enabled: 1, config: mForm.config });
    api.getMethods().then(setMethods);
    setShowMethod(false);
    setMForm({ name: '', type: 'paypal', enabled: 1, config: {} });
    notify('Método de pago añadido ✅');
  };

  if (!settings) return <div className="muted">Cargando panel…</div>;

  const extraField = (label, key, placeholder, value, set) => (
    <div className="field">
      <label>{label}</label>
      <input className="input" value={value[key] || ''} onChange={(e) => set({ ...value, [key]: e.target.value })} placeholder={placeholder} />
    </div>
  );

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Panel de control</h1>

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={'tab' + (tab === t.id ? ' active' : '')} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'amazon' && (
        <form className="card" onSubmit={saveAmazon}>
          <h2 style={{ marginTop: 0 }}>Conector de la API de Amazon (PA-API)</h2>
          <div className="alert alert-info mb">
            🔑 DeCasa usa la <strong>Product Advertising API</strong> oficial de Amazon para buscar productos reales
            con mejores reseñas. Consigue tus credenciales en la consola de desarrollador de Amazon y tu
            <em> Partner Tag</em> (ID de afiliado) en el Programa de Asociados.
          </div>

          <div className="grid grid-2">
            {extraField('Access Key', 'access_key', 'AKIA…', amazon, setAmazon)}
            {extraField('Secret Key', 'secret_key', '••••••••', amazon, setAmazon)}
            {extraField('Partner Tag (ID de afiliado)', 'partner_tag', 'miusuario-21', amazon, setAmazon)}
            <div className="field">
              <label>Mercado de Amazon</label>
              <select className="select" value={amazon.marketplace || 'amazon.es'} onChange={(e) => setAmazon({ ...amazon, marketplace: e.target.value })}>
                {['amazon.es', 'amazon.com', 'amazon.co.uk', 'amazon.de', 'amazon.fr', 'amazon.it', 'amazon.ca', 'amazon.com.mx', 'amazon.com.br'].map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          <label className="row" style={{ gap: 8, cursor: 'pointer', marginBottom: 16 }}>
            <input type="checkbox" checked={!!amazon.demo_mode} onChange={(e) => setAmazon({ ...amazon, demo_mode: e.target.checked })} />
            <span>
              <strong>Modo demostración</strong> — usar resultados de ejemplo cuando no hay credenciales o la API falla.
            </span>
          </label>

          <button type="submit" className="btn btn-primary">Guardar credenciales</button>
        </form>
      )}

      {tab === 'pagos' && (
        <div className="card">
          <div className="card-title">
            <h2 style={{ margin: 0 }}>Métodos de pago para cobrar tus beneficios</h2>
            <button className="btn btn-primary" onClick={() => setShowMethod(true)}>+ Añadir método</button>
          </div>
          <div className="grid grid-2">
            {methods.map((m) => (
              <div key={m.id} className="card" style={{ padding: 16, marginBottom: 0, display: 'flex', gap: 12, alignItems: 'center' }}>
                <span style={{ fontSize: 26 }}>{METHOD_ICONS[m.type] || '💳'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>{m.name}</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {Object.entries(m.config || {}).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(' · ') || 'Sin configuración'}
                  </div>
                </div>
                <span className={'badge ' + (m.enabled ? 'badge-publicado' : 'badge-cancelado')}>
                  {m.enabled ? 'Activo' : 'Desactivado'}
                </span>
                <button className={'btn ' + (m.enabled ? 'btn-red' : 'btn-ghost') + ' btn-sm'} onClick={() => toggleMethod(m)}>
                  {m.enabled ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            ))}
          </div>

          {showMethod && (
            <div className="modal-backdrop" onClick={() => setShowMethod(false)}>
              <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submitMethod}>
                <h3>Nuevo método de pago</h3>
                <div className="field">
                  <label>Tipo</label>
                  <select className="select" value={mForm.type} onChange={(e) => setMForm({ ...mForm, type: e.target.value })}>
                    <option value="paypal">PayPal</option>
                    <option value="transferencia">Transferencia bancaria</option>
                    <option value="tarjeta">Tarjeta de débito/crédito</option>
                    <option value="cripto">Criptomoneda</option>
                    <option value="cheque">Cheque / Giro</option>
                  </select>
                </div>
                <div className="field">
                  <label>Nombre visible</label>
                  <input className="input" required value={mForm.name} onChange={(e) => setMForm({ ...mForm, name: e.target.value })} placeholder="PayPal principal" />
                </div>
                {mForm.type === 'paypal' && extraField('Email de PayPal', 'email', 'mi@email.com', mForm, setMForm)}
                {mForm.type === 'transferencia' && (
                  <>
                    {extraField('IBAN', 'iban', 'ES00 0000 0000 0000 0000 0000', mForm, setMForm)}
                    {extraField('Banco / Titular', 'bank', 'Banco XYZ', mForm, setMForm)}
                  </>
                )}
                {mForm.type === 'cripto' && extraField('Dirección de cartera', 'wallet', 'bc1q… / TVj…', mForm, setMForm)}
                {mForm.type === 'cheque' && extraField('Dirección postal', 'address', 'Calle…', mForm, setMForm)}
                <div className="row between">
                  <button type="button" className="btn btn-ghost" onClick={() => setShowMethod(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-green">Guardar método</button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {tab === 'general' && (
        <form className="card" onSubmit={saveGeneral}>
          <h2 style={{ marginTop: 0 }}>Ajustes generales</h2>
          <div className="grid grid-2">
            <div className="field">
              <label>Nombre de la aplicación</label>
              <input className="input" value={general.app_name || ''} onChange={(e) => setGeneral({ ...general, app_name: e.target.value })} />
            </div>
            <div className="field">
              <label>Moneda</label>
              <select className="select" value={general.currency || 'EUR'} onChange={(e) => setGeneral({ ...general, currency: e.target.value })}>
                {['EUR', 'USD', 'GBP', 'MXN'].map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Comisión de afiliado por defecto (%)</label>
              <input className="input" type="number" step="0.5" min="1" max="20" value={(general.default_commission || 0.04) * 100}
                onChange={(e) => setGeneral({ ...general, default_commission: Number(e.target.value) / 100 })} />
              <span className="muted" style={{ fontSize: 12 }}>El % que recibes por venta (Amazon Associates suele estar entre 1% y 10%).</span>
            </div>
            <div className="field">
              <label>Actualización automática de tiendas (horas)</label>
              <input className="input" type="number" min="1" value={general.auto_update_interval || 24}
                onChange={(e) => setGeneral({ ...general, auto_update_interval: Number(e.target.value) })} />
            </div>
          </div>

          <label className="row" style={{ gap: 8, cursor: 'pointer', marginBottom: 16 }}>
            <input type="checkbox" checked={!!general.auto_upload} onChange={(e) => setGeneral({ ...general, auto_upload: e.target.checked })} />
            <span><strong>Subida automática</strong> — publicar en tiendas los productos aceptados sin confirmación extra.</span>
          </label>

          <button type="submit" className="btn btn-primary">Guardar ajustes</button>
        </form>
      )}

      {toast && <div className={'toast ' + toast.type}>{toast.msg}</div>}
    </div>
  );
}
