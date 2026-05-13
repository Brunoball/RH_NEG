// src/App.js
import React from 'react';
import {
  HashRouter as Router,
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
   🔒 Cierre de sesión por inactividad global
   - Funciona con la app abierta.
   - Funciona aunque cierres la pestaña/navegador y vuelvas después.
   - Funciona al volver desde suspensión, minimizar o cambiar de pestaña.
========================================================= */
const INACTIVITY_MINUTES = 60;
const INACTIVITY_MS = INACTIVITY_MINUTES * 60 * 1000;

const AUTH_USER_KEY = 'usuario';
const AUTH_TOKEN_KEY = 'token';
const LAST_ACTIVITY_KEY = 'app_last_activity_at';
const EXPIRES_AT_KEY = 'app_session_expires_at';

const getNow = () => Date.now();

const hasSession = () => {
  try {
    return !!localStorage.getItem(AUTH_USER_KEY);
  } catch {
    return false;
  }
};

const clearAuthSession = () => {
  try {
    sessionStorage.clear();
  } catch {}

  try {
    localStorage.removeItem(AUTH_USER_KEY);
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    localStorage.removeItem(EXPIRES_AT_KEY);
  } catch {}
};

const getExpiresAt = () => {
  try {
    return Number(localStorage.getItem(EXPIRES_AT_KEY) || 0);
  } catch {
    return 0;
  }
};

const getLastActivityAt = () => {
  try {
    return Number(localStorage.getItem(LAST_ACTIVITY_KEY) || 0);
  } catch {
    return 0;
  }
};

const isSessionExpired = () => {
  if (!hasSession()) return false;

  const now = getNow();
  const expiresAt = getExpiresAt();
  const lastActivityAt = getLastActivityAt();

  if (expiresAt && now >= expiresAt) return true;
  if (lastActivityAt && now - lastActivityAt >= INACTIVITY_MS) return true;

  return false;
};

const registerActivity = () => {
  if (!hasSession()) return;

  const now = getNow();

  try {
    localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
    localStorage.setItem(EXPIRES_AT_KEY, String(now + INACTIVITY_MS));
  } catch {}
};

function InactivityLogout() {
  const navigate = useNavigate();
  const location = useLocation();

  const logoutAndRedirect = React.useCallback(() => {
    clearAuthSession();
    navigate('/', { replace: true });
  }, [navigate]);

  React.useEffect(() => {
    let timerId = null;

    const isLoginRoute = location.pathname === '/';

    const clearTimer = () => {
      if (timerId) {
        clearTimeout(timerId);
        timerId = null;
      }
    };

    const scheduleLogout = () => {
      clearTimer();

      if (!hasSession() || isLoginRoute) return;

      const expiresAt = getExpiresAt();

      if (!expiresAt) {
        registerActivity();
      }

      const finalExpiresAt = getExpiresAt();
      const remainingMs = finalExpiresAt - getNow();

      if (remainingMs <= 0) {
        logoutAndRedirect();
        return;
      }

      timerId = setTimeout(() => {
        logoutAndRedirect();
      }, remainingMs);
    };

    const checkSession = () => {
      if (!hasSession()) {
        clearTimer();
        return;
      }

      if (isLoginRoute) {
        clearTimer();
        return;
      }

      if (isSessionExpired()) {
        logoutAndRedirect();
        return;
      }

      scheduleLogout();
    };

    const onActivity = () => {
      if (!hasSession() || isLoginRoute) return;

      if (isSessionExpired()) {
        logoutAndRedirect();
        return;
      }

      registerActivity();
      scheduleLogout();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkSession();
      }
    };

    const onStorage = (event) => {
      if (
        event.key === AUTH_USER_KEY ||
        event.key === AUTH_TOKEN_KEY ||
        event.key === EXPIRES_AT_KEY ||
        event.key === LAST_ACTIVITY_KEY
      ) {
        checkSession();
      }
    };

    const onPageShow = () => {
      checkSession();
    };

    const onFocus = () => {
      checkSession();
    };

    /*
      IMPORTANTE:
      Primero verificamos si ya venció.
      Después recién registramos actividad.
      Así, si cerraste la pestaña y volvés después de 60 minutos,
      NO te renueva la sesión automáticamente: te manda al login.
    */
    if (hasSession() && !isLoginRoute) {
      if (isSessionExpired()) {
        logoutAndRedirect();
        return () => clearTimer();
      }

      if (!getExpiresAt()) {
        registerActivity();
      }

      scheduleLogout();
    }

    const activityEvents = [
      'mousemove',
      'mousedown',
      'keydown',
      'scroll',
      'touchstart',
      'click',
    ];

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, onActivity, { passive: true });
    });

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('storage', onStorage);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('focus', onFocus);

    return () => {
      clearTimer();

      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, onActivity);
      });

      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('focus', onFocus);
    };
  }, [location.pathname, logoutAndRedirect]);

  return null;
}

/* =========================================================
   🔐 Ruta protegida
========================================================= */
function RutaProtegida({ componente }) {
  let usuario = null;

  try {
    usuario = JSON.parse(localStorage.getItem(AUTH_USER_KEY));
  } catch {
    usuario = null;
  }

  /*
    Si el usuario vuelve después de mucho tiempo, esta validación
    corta la sesión antes de renderizar la pantalla protegida.
  */
  if (usuario && isSessionExpired()) {
    clearAuthSession();
    return <Navigate to="/" replace />;
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
