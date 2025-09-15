// src/App.js
import React from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from 'react-router-dom';

import Inicio from './components/Login/Inicio';
import Principal from './components/Principal/Principal';
import Registro from './components/Login/Registro';
import Socios from './components/Socios/socios';
import AgregarSocio from './components/Socios/AgregarSocio';
import EditarSocio from './components/Socios/EditarSocio';
import SociosBaja from './components/Socios/SociosBaja';
import Cuotas from './components/Cuotas/Cuotas';

// 🔹 Panel contable
import DashboardContable from './components/Contable/DashboardContable';

// 🔹 Sección Categorías
import Categorias from './components/Categorias/Categorias';
import AgregarCategoria from './components/Categorias/AgregarCategoria';
import EditarCategoria from './components/Categorias/EditarCategoria';

// 🔹 Familias (ubicado dentro de components/Socios)
import Familias from './components/Socios/Familias';

/* =========================================================
   🔒 Cierre de sesión por inactividad (global)
========================================================= */
const INACTIVITY_MINUTES = 60;
const INACTIVITY_MS = INACTIVITY_MINUTES * 60 * 1000;

function InactivityLogout() {
  const navigate = useNavigate();
  const location = useLocation();

  React.useEffect(() => {
    let timerId = null;

    const hasSession = () => {
      try {
        return !!localStorage.getItem('usuario');
      } catch {
        return false;
      }
    };

    const doLogout = () => {
      try { sessionStorage.clear(); } catch {}
      try {
        localStorage.removeItem('usuario');
        localStorage.removeItem('token');
      } catch {}
      navigate('/', { replace: true });
    };

    const resetTimer = () => {
      if (!hasSession()) return;
      if (location.pathname === '/') return; // no correr timer en login
      if (timerId) clearTimeout(timerId);
      timerId = setTimeout(doLogout, INACTIVITY_MS);
    };

    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    const onActivity = () => resetTimer();

    const onVisibility = () => {
      if (document.visibilityState === 'visible') resetTimer();
    };

    activityEvents.forEach((ev) => window.addEventListener(ev, onActivity, { passive: true }));
    document.addEventListener('visibilitychange', onVisibility);

    resetTimer();

    return () => {
      if (timerId) clearTimeout(timerId);
      activityEvents.forEach((ev) => window.removeEventListener(ev, onActivity));
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [location, navigate]);

  return null;
}

/* =========================================================
   🔐 Ruta protegida
========================================================= */
function RutaProtegida({ componente }) {
  let usuario = null;
  try {
    usuario = JSON.parse(localStorage.getItem('usuario'));
  } catch {
    usuario = null;
  }
  return usuario ? componente : <Navigate to="/" replace />;
}

function App() {
  return (
    <Router>
      <InactivityLogout />

      <Routes>
        {/* Público */}
        <Route path="/" element={<Inicio />} />

        {/* Protegidas */}
        <Route path="/panel" element={<RutaProtegida componente={<Principal />} />} />
        <Route path="/registro" element={<RutaProtegida componente={<Registro />} />} />

        <Route path="/socios" element={<RutaProtegida componente={<Socios />} />} />
        <Route path="/socios/agregar" element={<RutaProtegida componente={<AgregarSocio />} />} />
        <Route path="/socios/editar/:id" element={<RutaProtegida componente={<EditarSocio />} />} />
        <Route path="/socios/baja" element={<RutaProtegida componente={<SociosBaja />} />} />

        {/* Familias (Grupos familiares) */}
        <Route path="/familias" element={<RutaProtegida componente={<Familias />} />} />

        <Route path="/cuotas" element={<RutaProtegida componente={<Cuotas />} />} />

        {/* Panel contable */}
        <Route path="/contable" element={<RutaProtegida componente={<DashboardContable />} />} />

        {/* Categorías */}
        <Route path="/categorias" element={<RutaProtegida componente={<Categorias />} />} />
        <Route path="/categorias/nueva" element={<RutaProtegida componente={<AgregarCategoria />} />} />
        <Route path="/categorias/editar/:id" element={<RutaProtegida componente={<EditarCategoria />} />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
