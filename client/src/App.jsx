import React from 'react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard.jsx';
import Buscador from './pages/Buscador.jsx';
import Tiendas from './pages/Tiendas.jsx';
import Afiliados from './pages/Afiliados.jsx';
import Cobros from './pages/Cobros.jsx';
import Ajustes from './pages/Ajustes.jsx';
import PublicStore from './pages/PublicStore.jsx';

const NAV = [
  { to: '/', label: 'Dashboard', icon: '📊', end: true },
  { to: '/buscador', label: 'Buscador', icon: '🔍' },
  { to: '/tiendas', label: 'Tiendas', icon: '🛍️' },
  { to: '/afiliados', label: 'Afiliados', icon: '🤝' },
  { to: '/cobros', label: 'Cobros', icon: '💶' },
  { to: '/ajustes', label: 'Panel de control', icon: '⚙️' }
];

export default function App() {
  const location = useLocation();
  const isPublic = location.pathname.startsWith('/tienda/');

  if (isPublic) {
    return (
      <Routes>
        <Route path="/tienda/:slug" element={<PublicStore />} />
      </Routes>
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <span className="brand-logo">🏠</span>
            <span className="brand-name">DeCasa</span>
            <span className="brand-sub">Afiliación Amazon</span>
          </div>
          <nav className="nav">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => 'nav-btn' + (isActive ? ' active' : '')}
              >
                <span className="nav-icon">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/buscador" element={<Buscador />} />
          <Route path="/tiendas" element={<Tiendas />} />
          <Route path="/afiliados" element={<Afiliados />} />
          <Route path="/cobros" element={<Cobros />} />
          <Route path="/ajustes" element={<Ajustes />} />
        </Routes>
      </main>
    </div>
  );
}
