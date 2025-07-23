import React from 'react';
import { useNavigate } from 'react-router-dom';
import logoRH from '../../imagenes/Logo_rh.jpeg';
import './principal.css';

// Importa tus iconos como imágenes o SVG
import iconUsers from '../../imagenes/users-icon.svg';
import iconMoney from '../../imagenes/money-icon.svg';
import iconTags from '../../imagenes/tags-icon.svg';
import iconUserPlus from '../../imagenes/user-plus-icon.svg';
import iconCalculator from '../../imagenes/calculator-icon.svg';
import iconSignOut from '../../imagenes/sign-out-icon.svg';

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
            <img src={iconUsers} alt="Socios" className="princ-opcion-icono" />
            <span className="princ-opcion-texto">Gestionar Socios</span>
          </div>
        </button>

        <button className="princ-opcion" onClick={() => navigate('/cuotas')}>
          <div className="princ-opcion-content">
            <img src={iconMoney} alt="Cuotas" className="princ-opcion-icono" />
            <span className="princ-opcion-texto">Gestionar Cuotas</span>
          </div>
        </button>

        <button className="princ-opcion" onClick={() => navigate('/categorias')}>
          <div className="princ-opcion-content">
            <img src={iconTags} alt="Categorías" className="princ-opcion-icono" />
            <span className="princ-opcion-texto">Gestionar Categorías</span>
          </div>
        </button>

        <button className="princ-opcion" onClick={() => navigate('/registro')}>
          <div className="princ-opcion-content">
            <img src={iconUserPlus} alt="Registro" className="princ-opcion-icono" />
            <span className="princ-opcion-texto">Registro de Usuarios</span>
          </div>
        </button>

        <button className="princ-opcion" onClick={() => navigate('/contable')}>
          <div className="princ-opcion-content">
            <img src={iconCalculator} alt="Contable" className="princ-opcion-icono" />
            <span className="princ-opcion-texto">Contabilidad</span>
          </div>
        </button>
      </div>

      <div className="princ-footer">
        <button onClick={cerrarSesion} className="princ-boton-salir">
          Cerrar Sesión
          <img src={iconSignOut} alt="Salir" className="princ-boton-salir-icono" />
        </button>
      </div>
    </div>
  );
};

export default Principal;