// src/components/Principal/Principal.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import logoRH from '../../imagenes/Logo_rh.jpeg';
import './principal.css';
import '../Global/roots.css';

// Font Awesome
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUsers,
  faMoneyBillWave,
  faUserPlus,
  faSignOutAlt,
  faFileInvoiceDollar
} from '@fortawesome/free-solid-svg-icons';

/* ================================
   Util: limpiar TODO lo de Socios
===================================*/
function clearSociosFiltersAndCaches() {
  try {
    // Claves históricas y actuales en localStorage
    const LS_KEYS = [
      'filtros_socios',        // legacy
      'filtros_socios_v2',     // versión actual usada por Socios.jsx
      'socios_cache',
      'listas_cache',
      'socios_cache_etag',
      'socios_cache_exp',
      'token_socios',          // por si hubiera alguno adicional
    ];
    LS_KEYS.forEach(k => localStorage.removeItem(k));
  } catch {}

  try {
    // Claves de sesión que usa Socios.jsx para restaurar estado/scroll
    const SS_KEYS = [
      'filtros_socios',        // legacy
      'socios_last_filters',
      'socios_last_scroll',
      'socios_last_sel_id',
      'socios_last_ts',
    ];
    SS_KEYS.forEach(k => sessionStorage.removeItem(k));

    // Borrar prefetch de socio puntual
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith('socio_prefetch_')) {
        sessionStorage.removeItem(key);
      }
    }
  } catch {}
}

/* ===== Modal de confirmación (unificado con el estilo LALCEC) ===== */
function ConfirmLogoutModal({ open, onConfirm, onCancel }) {
  // Cerrar con ESC y confirmar con Enter
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel?.();
      if (e.key === 'Enter') onConfirm?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onConfirm, onCancel]);

  if (!open) return null;

  return (
    <div
      className="logout-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-modal-title"
      onClick={onCancel}
    >
      <div
        className="logout-modal-container logout-modal--danger"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="logout-modal__icon" aria-hidden="true">
          <FontAwesomeIcon icon={faSignOutAlt} />
        </div>

        <h3
          id="logout-modal-title"
          className="logout-modal-title logout-modal-title--danger"
        >
          Confirmar cierre de sesión
        </h3>

        <p className="logout-modal-text">
          ¿Estás seguro de que deseas cerrar la sesión?
        </p>

        <div className="logout-modal-buttons">
          <button
            className="logout-btn logout-btn--ghost"
            onClick={onCancel}
            autoFocus
          >
            Cancelar
          </button>
          <button
            className="logout-btn logout-btn--solid-danger"
            onClick={onConfirm}
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

const Principal = () => {
  const usuario = (() => {
    try {
      return JSON.parse(localStorage.getItem('usuario'));
    } catch {
      return null;
    }
  })();

  const navigate = useNavigate();
  const [showConfirm, setShowConfirm] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  // Detectar cambios en el tamaño de la pantalla
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 🧹 Al entrar a Principal, limpiar SIEMPRE filtros/caches de Socios
  useEffect(() => {
    clearSociosFiltersAndCaches();
  }, []);

  const pedirConfirmacion = () => setShowConfirm(true);

  const doLogout = useCallback(() => {
    try { sessionStorage.clear(); } catch {}
    try {
      localStorage.removeItem('usuario');
      localStorage.removeItem('token'); // 🔒 por si usás token
    } catch {}
    setShowConfirm(false);
    navigate('/', { replace: true });
  }, [navigate]);

  const redirectTo3Devs = () => {
    window.open('https://3devsnet.com', '_blank');
  };

  // Navegación garantizando limpieza inmediata antes de entrar a Socios
  const goSocios = useCallback(() => {
    clearSociosFiltersAndCaches();
    navigate('/socios');
  }, [navigate]);

  const goCuotas = useCallback(() => {
    navigate('/cuotas');
  }, [navigate]);

  const goContable = useCallback(() => {
    navigate('/contable');
  }, [navigate]);

  const goRegistro = useCallback(() => {
    navigate('/registro');
  }, [navigate]);

  return (
    <div className="princ-contenedor-padre">
      <div className="princ-contenedor">
        <div className="princ-glass-effect"></div>

        <div className="princ-encabezado">
          <div className="princ-logo-container">
            <img src={logoRH} alt="Logo RH Negativo" className="princ-logo" />
            <div className="princ-logo-glow"></div>
          </div>
          <h1>Sistema de Gestión <span>Círculo RH Negativo</span></h1>
          <p className="princ-subtitulo">Panel de administración integral para la gestión eficiente de tu organización</p>

          <div className="princ-usuario-info">
            <h2>Bienvenido, <span>{usuario?.Nombre_Completo || 'Usuario'}</span></h2>
            <div className="princ-usuario-status"></div>
          </div>
        </div>

        <div className="princ-grid-opciones">
          <button className="princ-opcion princ-opcion-socios" onClick={goSocios}>
            <div className="princ-opcion-content">
              <div className="princ-opcion-icono-container">
                <FontAwesomeIcon icon={faUsers} className="princ-opcion-icono" />
              </div>
              <span className="princ-opcion-texto">Gestionar Socios</span>
              <span className="princ-opcion-desc">Administra el listado de socios</span>
            </div>
          </button>

          <button className="princ-opcion princ-opcion-cuotas" onClick={goCuotas}>
            <div className="princ-opcion-content">
              <div className="princ-opcion-icono-container">
                <FontAwesomeIcon icon={faMoneyBillWave} className="princ-opcion-icono" />
              </div>
              <span className="princ-opcion-texto">Gestionar Cuotas</span>
              <span className="princ-opcion-desc">Control de pagos y cuotas</span>
            </div>
          </button>

          <button
            className="princ-opcion princ-opcion-categorias"
            onClick={goContable}
          >
            <div className="princ-opcion-content">
              <div className="princ-opcion-icono-container">
                <FontAwesomeIcon icon={faFileInvoiceDollar} className="princ-opcion-icono" />
              </div>
              <span className="princ-opcion-texto">Gestión contable</span>
              <span className="princ-opcion-desc">Ingresos por mes y categorías</span>
            </div>
          </button>

          <button className="princ-opcion princ-opcion-usuarios" onClick={goRegistro}>
            <div className="princ-opcion-content">
              <div className="princ-opcion-icono-container">
                <FontAwesomeIcon icon={faUserPlus} className="princ-opcion-icono" />
              </div>
              <span className="princ-opcion-texto">Registro de Usuarios</span>
              <span className="princ-opcion-desc">Administra accesos al sistema</span>
            </div>
          </button>
        </div>

        <div className="princ-footer">
          <div className="princ-footer-container">
            <div className="princ-creditos-container">
              <p
                className="princ-creditos"
                onClick={redirectTo3Devs}
              >
                Desarrollado por 3devs.solutions
              </p>
            </div>
            <div className="princ-boton-salir-container">
              <button onClick={pedirConfirmacion} className="princ-boton-salir">
                <FontAwesomeIcon icon={faSignOutAlt} className="princ-boton-salir-icono" />
                <span>Cerrar Sesión</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de confirmación */}
      <ConfirmLogoutModal
        open={showConfirm}
        onConfirm={doLogout}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
};

export default Principal;