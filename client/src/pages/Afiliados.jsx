import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

const MARKETPLACES = [
  'amazon.es', 'amazon.com', 'amazon.co.uk', 'amazon.de', 'amazon.fr', 'amazon.it',
  'amazon.ca', 'amazon.com.mx', 'amazon.com.br'
];

export default function Afiliados() {
  const [accounts, setAccounts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', tracking_id: '', marketplace: 'amazon.es', notes: '' });
  const [toast, setToast] = useState(null);

  const notify = (msg, type = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  };

  useEffect(() => {
    api.getAffiliates().then(setAccounts).catch(console.error);
  }, []);

  const refresh = () => api.getAffiliates().then(setAccounts);

  const submit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.updateAffiliate(editing.id, form);
        notify('Cuenta de afiliado actualizada');
      } else {
        await api.createAffiliate(form);
        notify('Cuenta de afiliado registrada ✅');
      }
      setShowForm(false);
      setEditing(null);
      setForm({ name: '', email: '', tracking_id: '', marketplace: 'amazon.es', notes: '' });
      refresh();
    } catch (err) {
      notify(err.message, 'err');
    }
  };

  const edit = (a) => {
    setEditing(a);
    setForm({ name: a.name, email: a.email, tracking_id: a.tracking_id, marketplace: a.marketplace, notes: a.notes || '' });
    setShowForm(true);
  };

  const toggleStatus = async (a) => {
    await api.updateAffiliate(a.id, { status: a.status === 'activa' ? 'pausada' : 'activa' });
    refresh();
  };

  const remove = async (a) => {
    if (!confirm(`¿Eliminar la cuenta "${a.name}"?`)) return;
    await api.deleteAffiliate(a.id);
    refresh();
    notify('Cuenta eliminada');
  };

  return (
    <div>
      <div className="row between mb">
        <h1 style={{ margin: 0 }}>Cuentas de afiliado de Amazon</h1>
        <button className="btn btn-primary" onClick={() => { setShowForm(true); setEditing(null); setForm({ name: '', email: '', tracking_id: '', marketplace: 'amazon.es', notes: '' }); }}>
          + Nueva cuenta de afiliado
        </button>
      </div>

      <div className="alert alert-info mb">
        💡 Amazon Associates te paga directamente por cada venta a través de tus enlaces.
        <strong> DeCasa no toca tus productos ni envíos</strong>: solo gestiona tus tiendas, enlaces y seguimiento.
        Para <strong>abrir una cuenta de afiliado</strong>, pulsa en <em>Registrarse en Amazon</em> y después registra aquí tus datos.
      </div>

      <div className="grid grid-3">
        {accounts.map((a) => (
          <div key={a.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="row between">
              <h2 style={{ margin: 0 }}>{a.name}</h2>
              <span className={'badge ' + (a.status === 'activa' ? 'badge-activa' : 'badge-en-proceso')}>{a.status}</span>
            </div>
            <div className="muted" style={{ fontSize: 12.5 }}>
              <div>✉️ {a.email || 'Sin email'}</div>
              <div>🏷️ Tracking ID: <strong>{a.tracking_id}</strong></div>
              <div>🌍 {a.marketplace}</div>
            </div>
            {a.notes && <div className="pill" style={{ alignSelf: 'flex-start' }}>{a.notes}</div>}
            <div className="row">
              <a className="btn btn-primary btn-sm" href={a.signup_url} target="_blank" rel="noreferrer">
                🤝 Registrarse en Amazon
              </a>
              <button className="btn btn-ghost btn-sm" onClick={() => edit(a)}>Editar</button>
              <button className="btn btn-ghost btn-sm" onClick={() => toggleStatus(a)}>
                {a.status === 'activa' ? 'Pausar' : 'Activar'}
              </button>
              <button className="btn btn-red btn-sm" onClick={() => remove(a)}>Eliminar</button>
            </div>
          </div>
        ))}
      </div>

      {accounts.length === 0 && (
        <div className="card">
          <div className="muted mb">Todavía no hay cuentas de afiliado. Regístrate en el Programa de Afiliados de Amazon y añade tu cuenta aquí.</div>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Registrar mi primera cuenta</button>
        </div>
      )}

      {showForm && (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
            <h3>{editing ? 'Editar cuenta de afiliado' : 'Registrar cuenta de afiliado de Amazon'}</h3>

            <div className="field">
              <label>Nombre de la cuenta</label>
              <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Mi cuenta de afiliado" />
            </div>
            <div className="field">
              <label>Email de Amazon</label>
              <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="field">
              <label>Tracking ID (ID de afiliado)</label>
              <input className="input" required value={form.tracking_id} onChange={(e) => setForm({ ...form, tracking_id: e.target.value })} placeholder="miusuario-21" />
            </div>
            <div className="field">
              <label>Mercado / Tienda de Amazon</label>
              <select className="select" value={form.marketplace} onChange={(e) => setForm({ ...form, marketplace: e.target.value })}>
                {MARKETPLACES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Notas</label>
              <textarea className="textarea" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>

            <div className="row between">
              <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancelar</button>
              <button type="submit" className="btn btn-green">{editing ? 'Guardar cambios' : 'Registrar cuenta'}</button>
            </div>
          </form>
        </div>
      )}

      {toast && <div className={'toast ' + toast.type}>{toast.msg}</div>}
    </div>
  );
}
