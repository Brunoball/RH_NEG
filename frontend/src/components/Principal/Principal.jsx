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
  faSignOutAlt
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
      <div className="princ-encabezado">
        <img src={logoRH} alt="Logo RH Negativo" className="princ-logo" />
        <h1>Sistema de Gestión RH Negativo</h1>
        <p>Panel de administración con todas las herramientas necesarias para gestionar tu organización</p>
        <h2>Bienvenido, {usuario?.Nombre_Completo || 'Usuario'} 👋</h2>
      </div>

      <div className="princ-grid-opciones">
        <button className="princ-opcion" onClick={() => navigate('/socios')}>
          <div className="princ-opcion-content">
            <FontAwesomeIcon icon={faUsers} className="princ-opcion-icono" />
            <span className="princ-opcion-texto">Gestionar Socios</span>
          </div>
        </button>

        <button className="princ-opcion" onClick={() => navigate('/cuotas')}>
          <div className="princ-opcion-content">
            <FontAwesomeIcon icon={faMoneyBillWave} className="princ-opcion-icono" />
            <span className="princ-opcion-texto">Gestionar Cuotas</span>
          </div>
        </button>

        <button className="princ-opcion" onClick={() => navigate('/categorias')}>
          <div className="princ-opcion-content">
            <FontAwesomeIcon icon={faTags} className="princ-opcion-icono" />
            <span className="princ-opcion-texto">Gestionar Categorías</span>
          </div>
        </button>

        <button className="princ-opcion" onClick={() => navigate('/registro')}>
          <div className="princ-opcion-content">
            <FontAwesomeIcon icon={faUserPlus} className="princ-opcion-icono" />
            <span className="princ-opcion-texto">Registro de Usuarios</span>
          </div>
        </button>

        <button className="princ-opcion" onClick={() => navigate('/contable')}>
          <div className="princ-opcion-content">
            <FontAwesomeIcon icon={faCalculator} className="princ-opcion-icono" />
            <span className="princ-opcion-texto">Contabilidad</span>
          </div>
        </button>
      </div>

      <div className="princ-footer">
        <button onClick={cerrarSesion} className="princ-boton-salir">
          Cerrar Sesión
          <FontAwesomeIcon icon={faSignOutAlt} className="princ-boton-salir-icono" />
        </button>
      </div>
    </div>
  );
};

export default Principal;
