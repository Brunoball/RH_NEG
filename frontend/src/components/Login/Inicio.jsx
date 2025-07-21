import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BASE_URL from '../../config/config';
import './inicio.css';
import logoCirculo from '../../imagenes/Logo_rh.jpeg';

const Inicio = () => {
  const [nombre, setNombre] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const manejarEnvio = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!nombre || !contrasena) {
      setError('Por favor, completá todos los campos.');
      setLoading(false);
      return;
    }

    try {
      const respuesta = await fetch(`${BASE_URL}/api.php?action=inicio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, contrasena })
      });

      const data = await respuesta.json();

      if (data.exito) {
        localStorage.setItem('usuario', JSON.stringify(data.usuario));
        localStorage.setItem('token', data.token);
        navigate('/panel');
      } else {
        setError(data.mensaje || 'Credenciales incorrectas');
      }
    } catch (err) {
      console.error('Error al iniciar sesión:', err);
      setError('Error del servidor. Intentalo más tarde.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="ini_contenedor">
      <form className="ini_formulario" onSubmit={manejarEnvio} aria-label="Formulario de inicio de sesión">
        <div className="ini_logo-container">
          <img 
            src={logoCirculo} 
            alt="Logo de la empresa" 
            className="ini_logo" 
            width="150"
            height="150"
            loading="lazy"
          />
          <h1>Bienvenido</h1>
          <p className="ini_subtitle">Inicia sesión para continuar</p>
        </div>
        
        {error && (
          <div className="ini_error" role="alert">
            <span className="ini_error-icon" aria-hidden="true">⚠️</span>
            {error}
          </div>
        )}
        
        <div className="ini_input-group">
          <label htmlFor="nombre-usuario" className="ini_sr-only">Usuario</label>
          <input 
            id="nombre-usuario"
            type="text" 
            placeholder="Usuario" 
            className="ini_input-field"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            disabled={loading}
            aria-required="true"
          />
          <span className="ini_input-icon" aria-hidden="true">👤</span>
        </div>
        
        <div className="ini_input-group">
          <label htmlFor="contrasena" className="ini_sr-only">Contraseña</label>
          <input 
            id="contrasena"
            type="password" 
            placeholder="Contraseña" 
            className="ini_input-field"
            value={contrasena}
            onChange={(e) => setContrasena(e.target.value)}
            disabled={loading}
            aria-required="true"
          />
          <span className="ini_input-icon" aria-hidden="true">🔒</span>
        </div>
        
        <button 
          type="submit" 
          className="ini_button"
          disabled={loading}
          aria-busy={loading}
        >
          {loading ? (
            <span className="ini_button-loading" aria-hidden="true"></span>
          ) : (
            <>
              <span className="ini_button-text">Iniciar Sesión</span>
              <span className="ini_button-icon" aria-hidden="true">→</span>
            </>
          )}
          <span className="ini_sr-only">{loading ? 'Cargando...' : 'Iniciar sesión'}</span>
        </button>
        
        <div className="ini_footer">
          <p className="ini_register-text">
            ¿No tienes cuenta? 
            <button 
              type="button"
              className="ini_register-link"
              onClick={() => navigate('/registro')}
              aria-label="Ir al registro"
            >
              Regístrate
            </button>
          </p>
          
          <button
            type="button"
            className="ini_forgot-link"
            onClick={() => navigate('/olvide-contrasena')}
            aria-label="Recuperar contraseña"
          >
            <span className="ini_icon" aria-hidden="true">🔑</span>
            ¿Olvidaste tu contraseña?
          </button>
        </div>
      </form>
      
      <div className="ini_floating-shapes" aria-hidden="true">
        <div className="ini_shape ini_circle"></div>
        <div className="ini_shape ini_triangle"></div>
        <div className="ini_shape ini_square"></div>
      </div>
    </main>
  );
};

export default Inicio;