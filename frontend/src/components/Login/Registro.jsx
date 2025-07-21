import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BASE_URL from '../../config/config';
import './registro.css';
import logoRH from '../../imagenes/Logo_rh.jpeg';

const Registro = () => {
  const [nombre, setNombre] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [confirmarContrasena, setConfirmarContrasena] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(false);
  const navigate = useNavigate();

  const manejarRegistro = async (e) => {
    e.preventDefault();

    if (cargando) return;

    // Validaciones
    if (!nombre || !contrasena || !confirmarContrasena) {
      setMensaje('Por favor, completá todos los campos.');
      return;
    }

    if (nombre.trim().length < 4) {
      setMensaje('El nombre debe tener al menos 4 caracteres.');
      return;
    }

    if (contrasena.length < 6) {
      setMensaje('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (contrasena !== confirmarContrasena) {
      setMensaje('Las contraseñas no coinciden.');
      return;
    }

    try {
      setCargando(true);
      const respuesta = await fetch(`${BASE_URL}/api.php?action=registro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, contrasena })
      });

      const data = await respuesta.json();
      setCargando(false);

      if (data.exito) {
        localStorage.setItem('usuario', JSON.stringify(data.usuario));
        navigate('/panel');
      } else {
        setMensaje(data.mensaje || 'Error al registrar usuario.');
      }
    } catch (err) {
      console.error(err);
      setMensaje('Error del servidor.');
      setCargando(false);
    }
  };

  return (
    <div className="reg_contenedor">
      <div className="reg_encabezado">
        <img src={logoRH} alt="Logo RH" className="reg_logo" />
        <h1 className="reg_titulo">Crear Cuenta</h1>
        <p className="reg_subtitulo">Registrate para acceder al sistema</p>
        <h2 className="reg_bienvenido">Bienvenido</h2>
      </div>

      {mensaje && <p className="reg_mensaje">{mensaje}</p>}

      <form onSubmit={manejarRegistro} className="reg_formulario">
        <div className="reg_campo">
          <input 
            type="text" 
            placeholder="Usuario" 
            value={nombre} 
            onChange={(e) => setNombre(e.target.value)} 
            required
            className="reg_input"
          />
        </div>

        <div className="reg_campo reg_campo-password">
          <input 
            type="password" 
            placeholder="Contraseña" 
            value={contrasena} 
            onChange={(e) => setContrasena(e.target.value)} 
            required
            className="reg_input"
          />
          <button 
            type="button" 
            className="reg_toggle-password"
            aria-label="Mostrar contraseña"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
          </button>
        </div>

        <div className="reg_campo reg_campo-password">
          <input 
            type="password" 
            placeholder="Confirmar Contraseña" 
            value={confirmarContrasena} 
            onChange={(e) => setConfirmarContrasena(e.target.value)} 
            required
            className="reg_input"
          />
          <button 
            type="button" 
            className="reg_toggle-password"
            aria-label="Mostrar contraseña"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
          </button>
        </div>

        <div className="reg_footer">
          <button type="submit" className="reg_boton" disabled={cargando}>
            {cargando ? 'Registrando...' : 'Registrarse'}
          </button>
          <button type="button" onClick={() => navigate('/panel')} className="reg_boton reg_boton-secundario">
            Volver atrás
          </button>
        </div>
      </form>
    </div>
  );
};

export default Registro;