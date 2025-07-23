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
      setError('Por favor complete todos los campos');
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
      setError('Error del servidor. Intente más tarde.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ini_wrapper">
      <main className="ini_contenedor">
        {/* Mensaje de error */}
        {error && (
          <div className="ini_error-container">
            <div className="ini_error">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          </div>
        )}

        <form className="ini_formulario" onSubmit={manejarEnvio}>
          <div className="ini_logo-container">
            <img 
              src={logoCirculo} 
              alt="Logo de la empresa" 
              className="ini_logo" 
              loading="lazy"
            />
            <h1 className="ini_title">Bienvenido</h1>
            <p className="ini_subtitle">Inicie sesión para continuar</p>
          </div>

          <div className='ini_input-grup-container'>
            <div className="ini_input-group">
              <svg className="ini_input-icon" viewBox="0 0 24 24" width="20" height="20">
                <path fill="currentColor" d="M12 4a4 4 0 014 4 4 4 0 01-4 4 4 4 0 01-4-4 4 4 0 014-4m0 10c4.42 0 8 1.79 8 4v2H4v-2c0-2.21 3.58-4 8-4z"/>
              </svg>
              <input
                id="usuario"
                type="text"
                className="ini_input-field"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder=" "
                disabled={loading}
              />
              <label htmlFor="usuario" className="ini_input-label">Usuario</label>
            </div>

            <div className="ini_input-group ini_input-group2">
              <svg className="ini_input-icon" viewBox="0 0 24 24" width="20" height="20">
                <path fill="currentColor" d="M12 17a2 2 0 01-2-2c0-1.11.89-2 2-2a2 2 0 012 2 2 2 0 01-2 2m6-9a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V10a2 2 0 012-2h1V6a5 5 0 015-5 5 5 0 015 5v2h1m-6-5a3 3 0 00-3 3v2h6V6a3 3 0 00-3-3z"/>
              </svg>
              <input
                id="contrasena"
                type="password"
                className="ini_input-field"
                value={contrasena}
                onChange={(e) => setContrasena(e.target.value)}
                placeholder=" "
                disabled={loading}
              />
              <label htmlFor="contrasena" className="ini_input-label">Contraseña</label>
            </div>
          </div>
          
          <button 
            type="submit" 
            className="ini_button"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="loading-spinner"></span>
                <span>Procesando...</span>
              </>
            ) : (
              'Iniciar Sesión'
            )}
          </button>
        </form>
      </main>
    </div>
  );
};

export default Inicio;