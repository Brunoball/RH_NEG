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
  faTags,
  faUserPlus,
  faSignOutAlt,
  faFileInvoiceDollar,
  faExclamationTriangle
} from '@fortawesome/free-solid-svg-icons';

/* ===== Modal de confirmación ===== */
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

  const overlayStyle = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 9999
  };
  const modalStyle = {
    background: '#fff', color: '#1f2937', width: 'min(520px, 92vw)',
    borderRadius: '14px', boxShadow: '0 15px 40px rgba(0,0,0,0.25)',
    overflow: 'hidden'
  };
  const headerStyle = {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '16px 20px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb'
  };
  const bodyStyle = { padding: '18px 20px', fontSize: 16, lineHeight: 1.5 };
  const footerStyle = {
    padding: '14px 20px', display: 'flex', gap: 12, justifyContent: 'flex-end',
    background: '#f9fafb', borderTop: '1px solid #e5e7eb'
  };
  const btn = {
    base: { padding: '10px 14px', borderRadius: 10, border: '1px solid transparent', cursor: 'pointer', fontWeight: 600 },
    secondary: { background: '#fff', borderColor: '#d1d5db', color: '#374151' },
    danger: { background: '#ef4444', color: '#fff' }
  };

  return (
    <div style={overlayStyle} role="dialog" aria-modal="true" onClick={onCancel}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <FontAwesomeIcon icon={faExclamationTriangle} style={{ color: '#f59e0b', fontSize: 20 }} />
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
            Confirmar cierre de sesión
          </h3>
        </div>
        <div style={bodyStyle}>
          ¿Estás seguro de que deseas cerrar la sesión?
        </div>
        <div style={footerStyle}>
          <button
            type="button"
            onClick={onCancel}
            style={{ ...btn.base, ...btn.secondary }}
            autoFocus
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{ ...btn.base, ...btn.danger }}
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
