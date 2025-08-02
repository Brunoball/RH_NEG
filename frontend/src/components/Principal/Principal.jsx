import React from 'react';
import { useNavigate } from 'react-router-dom';
import logoRH from '../../imagenes/Logo_rh.jpeg';
import './principal.css';

// Font Awesome
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUsers,
  faMoneyBillWave,
  faTags,
  faUserPlus,
  faCalculator,
  faSignOutAlt,
  faChartLine,
  faCog
} from '@fortawesome/free-solid-svg-icons';

const Principal = () => {
  const usuario = JSON.parse(localStorage.getItem('usuario'));
  const navigate = useNavigate();

  const cerrarSesion = () => {
    localStorage.removeItem('usuario');
    navigate('/');
  };

  return (
    <div className="princ-contenedor">
      <div className="princ-glass-effect"></div>
      
      <div className="princ-encabezado">
        <div className="princ-logo-container">
          <img src={logoRH} alt="Logo RH Negativo" className="princ-logo" />
          <div className="princ-logo-glow"></div>
        </div>
        <h1>Sistema de Gestión <span>RH Negativo</span></h1>
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
            <span className="princ-opcion-desc">Administra el listado completo de socios</span>
          </div>
        </button>

        <button className="princ-opcion princ-opcion-cuotas" onClick={() => navigate('/cuotas')}>
          <div className="princ-opcion-content">
            <div className="princ-opcion-icono-container">
              <FontAwesomeIcon icon={faMoneyBillWave} className="princ-opcion-icono" />
            </div>
            <span className="princ-opcion-texto">Gestionar Cuotas</span>
            <span className="princ-opcion-desc">Control de pagos y cuotas mensuales</span>
          </div>
        </button>

        <button className="princ-opcion princ-opcion-categorias" disabled>
          <div className="princ-opcion-content">
            <div className="princ-opcion-icono-container">
              <FontAwesomeIcon icon={faTags} className="princ-opcion-icono" />
            </div>
            <span className="princ-opcion-texto">Gestionar Categorías</span>
            <span className="princ-opcion-desc">Próximamente</span>
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
        <button onClick={cerrarSesion} className="princ-boton-salir">
          <FontAwesomeIcon icon={faSignOutAlt} className="princ-boton-salir-icono" />
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </div>
  );
};

export default Principal;