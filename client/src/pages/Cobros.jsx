import React, { useEffect, useState } from 'react';
import { api, money } from '../api.js';

const STATUS_BADGE = {
  pendiente: 'badge-pendiente-pago',
  'en proceso': 'badge-en-proceso',
  pagado: 'badge-pagado',
  cancelado: 'badge-cancelado'
};

export default function Cobros() {
  const [balance, setBalance] = useState(null);
  const [methods, setMethods] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [amount, setAmount] = useState('');
  const [methodId, setMethodId] = useState('');
  const [notes, setNotes] = useState('');
  const [showSale, setShowSale] = useState(false);
  const [sale, setSale] = useState({ product_id: '', amount: '', date: '' });
  const [toast, setToast] = useState(null);

  const notify = (msg, type = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  };

  useEffect(() => {
    api.balance().then(setBalance).catch(console.error);
    api.getMethods().then(setMethods).catch(console.error);
    api.getWithdrawals().then(setWithdrawals).catch(console.error);
  }, []);

  const refresh = () => {
    api.balance().then(setBalance).catch(console.error);
    api.getWithdrawals().then(setWithdrawals).catch(console.error);
  };

  const quick = (pct) => setAmount(((balance?.available || 0) * pct).toFixed(2));

  const request = async (e) => {
    e.preventDefault();
    try {
      const res = await api.requestWithdrawal({ amount, method: methodId, notes });
      notify(`Solicitud de cobro de ${money(res.withdrawal.amount)} registrada ✅`);
      setAmount('');
      setNotes('');
      refresh();
    } catch (err) {
      notify(err.message, 'err');
    }
  };

  const setStatus = async (w, status) => {
    await api.setWithdrawalStatus(w.id, status);
    refresh();
  };

  const registerSale = async (e) => {
    e.preventDefault();
    if (!sale.amount) return notify('Introduce el importe', 'err');
    await api.addSale({ amount: sale.amount, product_id: sale.product_id || null, date: sale.date || undefined });
    notify('Venta registrada. Beneficio añadido al saldo ✅');
    setSale({ product_id: '', amount: '', date: '' });
    setShowSale(false);
    refresh();
  };

  if (!balance) return <div className="muted">Cargando saldo…</div>;

  const used = methods.find((m) => m.id === Number(methodId));

  return (
    <div>
      <div className="row between mb">
        <h1 style={{ margin: 0 }}>Cobro de beneficios</h1>
        <div className="row">
          <button className="btn btn-ghost" onClick={() => setShowSale(!showSale)}>
            ➕ Registrar venta / beneficio
          </button>
          <button className="btn btn-green" onClick={() => document.getElementById('cobro-form').scrollIntoView({ behavior: 'smooth' })}>
            💶 Pedir mi cobro
          </button>
        </div>
      </div>

      {showSale && (
        <form className="card mb" onSubmit={registerSale}>
          <h2 style={{ marginTop: 0 }}>Registrar venta de afiliación</h2>
          <p className="muted" style={{ marginTop: -8 }}>Cuando Amazon confirme una venta por tus enlaces, regístrala aquí para sumarla a tus beneficios. También puedes conectar la API real.</p>
          <div className="grid grid-3">
            <div className="field">
              <label>Producto (opcional)</label>
              <input className="input" value={sale.product_id} onChange={(e) => setSale({ ...sale, product_id: e.target.value })} placeholder="ID de producto" />
            </div>
            <div className="field">
              <label>Importe de la comisión (€)</label>
              <input className="input" type="number" step="0.01" min="0" value={sale.amount} onChange={(e) => setSale({ ...sale, amount: e.target.value })} required />
            </div>
            <div className="field">
              <label>Fecha</label>
              <input className="input" type="date" value={sale.date} onChange={(e) => setSale({ ...sale, date: e.target.value })} />
            </div>
          </div>
          <button type="submit" className="btn btn-primary">Guardar venta</button>
        </form>
      )}

      <div className="grid grid-4 mb">
        <div className="stat" style={{ background: 'linear-gradient(135deg, #38bdf8, #1d7cb3)' }}>
          <div className="label">Beneficios generados</div>
          <div className="value">{money(balance.earned)}</div>
          <div className="sub">total acumulado</div>
          <span className="big-icon">💰</span>
        </div>
        <div className="stat" style={{ background: 'linear-gradient(135deg, #22c55e, #15803d)' }}>
          <div className="label">Saldo disponible</div>
          <div className="value">{money(balance.available)}</div>
          <div className="sub">listo para cobrar</div>
          <span className="big-icon">🏦</span>
        </div>
        <div className="stat" style={{ background: 'linear-gradient(135deg, #f59e0b, #b45309)' }}>
          <div className="label">En trámite</div>
          <div className="value">{money(balance.pending)}</div>
          <div className="sub">solicitudes pendientes</div>
          <span className="big-icon">⏳</span>
        </div>
        <div className="stat" style={{ background: 'linear-gradient(135deg, #a78bfa, #6d28d9)' }}>
          <div className="label">Cobrado</div>
          <div className="value">{money(balance.paid)}</div>
          <div className="sub">total retirado</div>
          <span className="big-icon">✅</span>
        </div>
      </div>

      <div className="grid grid-2 mb">
        <form id="cobro-form" className="card" onSubmit={request}>
          <h2 style={{ marginTop: 0 }}>Solicitar cobro</h2>
          <p className="muted" style={{ marginTop: -8 }}>
            El cobro se tramita con el método de pago que elijas. Las opciones se configuran en Panel de control.
          </p>

          <div className="field">
            <label>Importe a cobrar (€)</label>
            <input className="input" type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" required />
            <div className="row" style={{ gap: 6, marginTop: 6 }}>
              {[0.25, 0.5, 1].map((p) => (
                <button type="button" key={p} className="btn btn-ghost btn-xs" onClick={() => quick(p)}>
                  {p * 100}%
                </button>
              ))}
              <span className="muted" style={{ fontSize: 12 }}>Máx. {money(balance.available)}</span>
            </div>
          </div>

          <div className="field">
            <label>Método de pago</label>
            <select className="select" value={methodId} onChange={(e) => setMethodId(e.target.value)} required>
              <option value="">Elige un método…</option>
              {methods.filter((m) => m.enabled).map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          {used && used.config && (
            <div className="alert alert-info mb" style={{ marginTop: -6 }}>
              <strong>{used.name}:</strong> {Object.entries(used.config).map(([k, v]) => v ? <span key={k}> {k}: {v} ·</span> : null)}
            </div>
          )}

          <div className="field">
            <label>Notas (opcional)</label>
            <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Referencia interna…" />
          </div>

          <button type="submit" className="btn btn-green" style={{ width: '100%' }} disabled={balance.available <= 0}>
            💶 Cobrar {amount ? money(amount) : 'mi beneficio'}
          </button>
          {balance.available <= 0 && (
            <div className="alert alert-warn mt">No hay saldo disponible para cobrar todavía.</div>
          )}
        </form>

        <div className="card">
          <div className="card-title">
            <h2>Historial de cobros</h2>
            <span className="pill">{withdrawals.length} solicitudes</span>
          </div>
          {withdrawals.length === 0 ? (
            <div className="muted">Aún no has solicitado ningún cobro.</div>
          ) : (
            <table className="table">
              <thead>
                <tr><th>Fecha</th><th>Método</th><th>Importe</th><th>Estado</th><th>Acciones</th></tr>
              </thead>
              <tbody>
                {withdrawals.map((w) => (
                  <tr key={w.id}>
                    <td className="muted">{w.requested_at.slice(0, 10)}</td>
                    <td>{w.method}</td>
                    <td><strong>{money(w.amount)}</strong></td>
                    <td><span className={'badge ' + (STATUS_BADGE[w.status] || 'badge-pendiente-pago')}>{w.status}</span></td>
                    <td>
                      <div className="row" style={{ gap: 4 }}>
                        <button className="btn btn-ghost btn-xs" onClick={() => setStatus(w, 'pagado')}>Pagar</button>
                        <button className="btn btn-ghost btn-xs" onClick={() => setStatus(w, 'en proceso')}>Proceso</button>
                        <button className="btn btn-red btn-xs" onClick={() => setStatus(w, 'cancelado')}>X</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {toast && <div className={'toast ' + toast.type}>{toast.msg}</div>}
    </div>
  );
}
