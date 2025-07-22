import React from 'react';
import { useNavigate } from 'react-router-dom';
import logoRH from '../../imagenes/Logo_rh.jpeg';
import './principal.css';

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
        <p>Panel de administración</p>
        <h2>Bienvenido, {usuario?.Nombre_Completo || 'Usuario'} 👋</h2>
      </div>

      <div className="princ-grid-opciones">
        <button className="princ-opcion" onClick={() => navigate('/socios')}>
          Gestionar Socios
        </button>

        <button className="princ-opcion" onClick={() => navigate('/cuotas')}>
          Gestionar Cuotas
        </button>

        <button className="princ-opcion" onClick={() => navigate('/categorias')}>
          Gestionar Categorías
        </button>

        <button className="princ-opcion" onClick={() => navigate('/registro')}>
          Registro
        </button>

        <button className="princ-opcion" onClick={() => navigate('/contable')}>
          Contable
        </button>
      </div>

      <div className="princ-footer">
        <button onClick={cerrarSesion} className="princ-boton-salir">
          Cerrar Sesión
        </button>
      </div>
    </div>
  );
};

export default Principal;
