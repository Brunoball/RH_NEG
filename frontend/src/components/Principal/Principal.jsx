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
  const usuario = JSON.parse(localStorage.getItem('usuario'));
  const navigate = useNavigate();
  const [showConfirm, setShowConfirm] = useState(false);

  // 🧹 Al entrar a Principal, limpiar filtros/caches de Socios
  useEffect(() => {
    const KEYS_A_LIMPIAR = [
      'filtros_socios',
      // Por si más adelante usás caches:
      'socios_cache',
      'listas_cache',
      'socios_cache_etag',
      'socios_cache_exp',
    ];
    KEYS_A_LIMPIAR.forEach((k) => localStorage.removeItem(k));
    // Si usaste sessionStorage para algo relacionado a Socios:
    sessionStorage.removeItem('filtros_socios');
  }, []);

  const pedirConfirmacion = () => setShowConfirm(true);

  const doLogout = useCallback(() => {
    localStorage.removeItem('usuario');
    setShowConfirm(false);
    navigate('/');
  }, [navigate]);

  const redirectTo3Devs = () => {
    window.open('https://3devsnet.com', '_blank');
  };

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
          <button className="princ-opcion princ-opcion-socios" onClick={() => navigate('/socios')}>
            <div className="princ-opcion-content">
              <div className="princ-opcion-icono-container">
                <FontAwesomeIcon icon={faUsers} className="princ-opcion-icono" />
              </div>
              <span className="princ-opcion-texto">Gestionar Socios</span>
              <span className="princ-opcion-desc">Administra el listado de socios</span>
            </div>
          </button>

          <button className="princ-opcion princ-opcion-cuotas" onClick={() => navigate('/cuotas')}>
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
            onClick={() => navigate('/contable')}
          >
            <div className="princ-opcion-content">
              <div className="princ-opcion-icono-container">
                <FontAwesomeIcon icon={faFileInvoiceDollar} className="princ-opcion-icono" />
              </div>
              <span className="princ-opcion-texto">Gestión contable</span>
              <span className="princ-opcion-desc">Ingresos por mes y categorías</span>
            </div>
          </button>

          <button className="princ-opcion princ-opcion-usuarios" onClick={() => navigate('/registro')}>
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
