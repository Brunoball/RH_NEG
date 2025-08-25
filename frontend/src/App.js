import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';

import Inicio from './components/Login/Inicio';
import Principal from './components/Principal/Principal';
import Registro from './components/Login/Registro';
import Socios from './components/Socios/socios';
import AgregarSocio from './components/Socios/AgregarSocio';
import EditarSocio from './components/Socios/EditarSocio';
import SociosBaja from './components/Socios/SociosBaja';
import Cuotas from './components/Cuotas/Cuotas';

// 🔹 importa tu panel contable (ajusta la ruta si tu archivo está en otra carpeta)
import DashboardContable from './components/Contable/DashboardContable';

/* =========================================================
   🔒 Cierre de sesión por inactividad (global)
   - Cambiá INACTIVITY_MINUTES para ajustar el tiempo.
   - Escucha mouse, teclado, scroll, toques y visibilidad.
   - Solo corre cuando hay 'usuario' y NO estás en "/".
========================================================= */
const INACTIVITY_MINUTES = 60; // ⬅️ ajustá acá (para pruebas podés usar 2)
const INACTIVITY_MS = INACTIVITY_MINUTES * 60 * 1000;

function InactivityLogout() {
  const navigate = useNavigate();
  const location = useLocation();

  React.useEffect(() => {
    let timerId = null;

    const hasSession = () => {
      try {
        return !!localStorage.getItem('usuario'); // tu RutaProtegida usa 'usuario'
      } catch {
        return false;
      }
    };

    const doLogout = () => {
      try { sessionStorage.clear(); } catch {}
      try {
        localStorage.removeItem('usuario');
        localStorage.removeItem('token'); // por si usás token
      } catch {}
      navigate('/', { replace: true });
    };

    const resetTimer = () => {
      if (!hasSession()) return;           // si no hay sesión, no corras
      if (location.pathname === '/') return; // en login no tiene sentido
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

    // iniciar el temporizador al montar/cambiar de ruta
    resetTimer();

    return () => {
      if (timerId) clearTimeout(timerId);
      activityEvents.forEach((ev) => window.removeEventListener(ev, onActivity));
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [location, navigate]);

  return null; // no renderiza nada
}

function App() {
  return (
    <Router>
      {/* ⬇️ Activa el cierre por inactividad en toda la app */}
      <InactivityLogout />

      <Routes>
        <Route path="/" element={<Inicio />} />
        <Route path="/panel" element={<RutaProtegida componente={<Principal />} />} />
        <Route path="/registro" element={<RutaProtegida componente={<Registro />} />} />
        <Route path="/socios" element={<RutaProtegida componente={<Socios />} />} />
        <Route path="/socios/agregar" element={<RutaProtegida componente={<AgregarSocio />} />} />
        <Route path="/socios/editar/:id" element={<RutaProtegida componente={<EditarSocio />} />} />
        <Route path="/socios/baja" element={<RutaProtegida componente={<SociosBaja />} />} />
        <Route path="/cuotas" element={<RutaProtegida componente={<Cuotas />} />} />

        {/* 🔹 nueva ruta protegida al panel contable */}
        <Route path="/contable" element={<RutaProtegida componente={<DashboardContable />} />} />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

function RutaProtegida({ componente }) {
  const usuario = JSON.parse(localStorage.getItem('usuario'));
  return usuario ? componente : <Navigate to="/" />;
}

export default App;
