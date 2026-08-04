import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  Tooltip, CartesianGrid, Legend
} from 'recharts';
import { api, money } from '../api.js';

const STAT_COLORS = [
  'linear-gradient(135deg, #38bdf8, #1d7cb3)',
  'linear-gradient(135deg, #22c55e, #15803d)',
  'linear-gradient(135deg, #a78bfa, #6d28d9)',
  'linear-gradient(135deg, #fb923c, #ea580c)'
];

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [top, setTop] = useState([]);
  const [sales, setSales] = useState([]);
  const [period, setPeriod] = useState('month');
  const [series, setSeries] = useState([]);
  const [balance, setBalance] = useState(null);

  useEffect(() => {
    api.summary().then(setData).catch(console.error);
    api.topProducts().then(setTop).catch(console.error);
    api.recentSales().then(setSales).catch(console.error);
    api.balance().then(setBalance).catch(console.error);
  }, []);

  useEffect(() => {
    api.earnings(period).then(setSeries).catch(console.error);
  }, [period]);

  if (!data) return <div className="muted">Cargando estadísticas…</div>;

  const { totals, products, stores, conversions, pendingWithdrawals } = data;

  const stats = [
    { label: 'Beneficios totales', value: money(totals.total), sub: `${money(totals.today)} hoy`, icon: '💰' },
    { label: 'Beneficios semana', value: money(totals.week), sub: 'últimos 7 días', icon: '📅' },
    { label: 'Beneficios mes', value: money(totals.month), sub: 'últimos 30 días', icon: '📆' },
    { label: 'Clics a productos', value: data.clicks.toLocaleString('es-ES'), sub: 'tráfico afiliado', icon: '🖱️' },
    { label: 'Productos', value: products.all, sub: `${products.published} publicados · ${products.pending} pendientes`, icon: '📦' },
    { label: 'Tiendas activas', value: stores, sub: 'tiendas online', icon: '🛍️' },
    { label: 'Ventas registradas', value: conversions, sub: 'conversiones', icon: '🛒' },
    { label: 'Saldo disponible', value: money(balance?.available), sub: `${money(pendingWithdrawals)} en trámite`, icon: '🏦' }
  ];

  return (
    <div>
      <div className="row between mb">
        <h1 style={{ margin: 0 }}>Dashboard</h1>
        <Link to="/cobros" className="btn btn-primary">💶 Cobrar mis beneficios</Link>
      </div>

      <div className="grid grid-4 mb">
        {stats.map((s, i) => (
          <div key={s.label} className="stat" style={{ background: STAT_COLORS[i % STAT_COLORS.length] }}>
            <div className="label">{s.label}</div>
            <div className="value">{s.value}</div>
            <div className="sub">{s.sub}</div>
            <span className="big-icon">{s.icon}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-2 mb">
        <div className="card">
          <div className="card-title">
            <h2>Evolución de beneficios</h2>
            <div className="tabs" style={{ margin: 0, border: 'none' }}>
              {['day', 'week', 'month'].map((p) => (
                <button key={p} onClick={() => setPeriod(p)}
                  className={'tab' + (period === p ? ' active' : '')}
                  style={{ padding: '6px 12px' }}>
                  {p === 'day' ? 'Días' : p === 'week' ? 'Semanas' : 'Meses'}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={series} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
              <defs>
                <linearGradient id="gBen" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2eef8" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} tickFormatter={(v) => String(v).slice(-5)} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => money(v)} />
              <Area type="monotone" dataKey="total" stroke="#38bdf8" strokeWidth={2.5} fill="url(#gBen)" name="Beneficios" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-title"><h2>Top productos por beneficio</h2></div>
          {top.length === 0 ? (
            <div className="muted">Aún no hay ventas. Busca productos y publícalos para empezar.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {top.slice(0, 6).map((p, i) => (
                <div key={p.product_id || i} className="row" style={{ justifyContent: 'space-between' }}>
                  <div className="row" style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 800, color: 'var(--blue-500)' }}>#{i + 1}</span>
                    {p.image_url && <img src={p.image_url} alt="" style={{ width: 38, height: 38, borderRadius: 8, objectFit: 'cover' }} />}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.title || 'Producto'}
                      </div>
                      <div className="muted" style={{ fontSize: 12 }}>{p.clicks || 0} clics · ★ {p.rating || 0}</div>
                    </div>
                  </div>
                  <strong style={{ color: 'var(--green)', whiteSpace: 'nowrap' }}>{money(p.total)}</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-title">
            <h2>Clics por periodo</h2>
            <span className="pill">🖱️ {data.clicks.toLocaleString('es-ES')} total</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={series} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2eef8" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} tickFormatter={(v) => String(v).slice(-5)} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="clicks" name="Clics" fill="#8cc9f6" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-title"><h2>Últimas ventas</h2></div>
          {sales.length === 0 ? (
            <div className="muted">Sin ventas registradas todavía.</div>
          ) : (
            <table className="table">
              <thead>
                <tr><th>Producto</th><th>Importe</th><th>Fecha</th></tr>
              </thead>
              <tbody>
                {sales.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <div style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.title || 'Venta directa'}
                      </div>
                    </td>
                    <td><strong style={{ color: 'var(--green)' }}>{money(s.amount)}</strong></td>
                    <td className="muted">{s.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
