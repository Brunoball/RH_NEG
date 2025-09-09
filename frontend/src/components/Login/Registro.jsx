import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BASE_URL from '../../config/config';
import './registro.css';
import logoRH from '../../imagenes/Logo_rh.jpeg';
import Toast from '../Global/Toast';

const Registro = () => {
  const [nombre, setNombre] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [confirmarContrasena, setConfirmarContrasena] = useState('');
  const [rol, setRol] = useState('vista'); // 👈 selector de rol
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [toast, setToast] = useState(null);
  const navigate = useNavigate();

  const mostrarToast = (tipo, mensaje, duracion = 3000) => {
    setToast({ tipo, mensaje, duracion });
    setTimeout(() => setToast(null), duracion);
  };

  const manejarRegistro = async (e) => {
    e.preventDefault();
    if (cargando) return;

    if (!nombre || !contrasena || !confirmarContrasena) {
      setMensaje('Por favor, completá todos los campos.');
      mostrarToast('error', 'Por favor, completá todos los campos.');
      return;
    }
    if (nombre.trim().length < 4) {
      setMensaje('El nombre debe tener al menos 4 caracteres.');
      mostrarToast('error', 'El nombre debe tener al menos 4 caracteres.');
      return;
    }
    if (contrasena.length < 6) {
      setMensaje('La contraseña debe tener al menos 6 caracteres.');
      mostrarToast('error', 'La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (contrasena !== confirmarContrasena) {
      setMensaje('Las contraseñas no coinciden.');
      mostrarToast('error', 'Las contraseñas no coinciden.');
      return;
    }

    try {
      setCargando(true);
      mostrarToast('cargando', 'Registrando usuario...', 10000);

      const respuesta = await fetch(`${BASE_URL}/api.php?action=registro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, contrasena, rol }) // 👈 enviamos rol
      });

      const data = await respuesta.json();
      setCargando(false);

      if (data.exito) {
        if (data.usuario) {
          localStorage.setItem('usuario', JSON.stringify(data.usuario));
        }
        mostrarToast('exito', '¡Registro exitoso! Redirigiendo...', 2000);
        setTimeout(() => navigate('/panel'), 2000);
      } else {
        setMensaje(data.mensaje || 'Error al registrar usuario.');
        mostrarToast('error', data.mensaje || 'Error al registrar usuario.');
      }
    } catch (err) {
      console.error(err);
      setMensaje('Error del servidor.');
      setCargando(false);
      mostrarToast('error', 'Error del servidor.');
    }
  };

  return (
    <div className="reg_global-container">
      {toast && (
        <Toast
          tipo={toast.tipo}
          mensaje={toast.mensaje}
          duracion={toast.duracion}
          onClose={() => setToast(null)}
        />
      )}

      <div className="reg_contenedor">
        <div className="reg_encabezado">
          <img src={logoRH} alt="Logo RH" className="reg_logo" />
          <h1 className="reg_titulo">Crear Cuenta</h1>
          <p className="reg_subtitulo">Registrate para acceder al sistema</p>
        </div>

        {mensaje && <p className="reg_mensaje">{mensaje}</p>}

        <form onSubmit={manejarRegistro} className="reg_formulario">
          {/* FILA 1: Usuario */}
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

          {/* FILA 2: Rol (sin cuadrado azul, estilizado) */}
          <div className="reg_campo reg_campo-select">
            <select
              className="reg_input reg_select"
              value={rol}
              onChange={(e) => setRol(e.target.value)}
            >
              <option value="vista">Rol: Solo vista</option>
              <option value="admin">Rol: Admin (acceso completo)</option>
            </select>
          </div>

          {/* FILA 3: Contraseña y Confirmación lado a lado */}
          <div className="reg_row">
            <div className="reg_campo reg_campo-password">
              <input
                type={showPassword ? 'text' : 'password'}
                className="reg_input"
                placeholder="Contraseña"
                value={contrasena}
                onChange={(e) => setContrasena(e.target.value)}
                required
              />
              <button
                type="button"
                className="reg_toggle-password"
                onClick={() => setShowPassword(v => !v)}
                aria-label="Mostrar/Ocultar contraseña"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  {showPassword ? (
                    <>
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                    </>
                  ) : (
                    <>
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </>
                  )}
                </svg>
              </button>
            </div>

            <div className="reg_campo reg_campo-password">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirmar Contraseña"
                value={confirmarContrasena}
                onChange={(e) => setConfirmarContrasena(e.target.value)}
                required
                className="reg_input"
              />
              <button
                type="button"
                className="reg_toggle-password"
                onClick={() => setShowConfirmPassword(v => !v)}
                aria-label="Mostrar/Ocultar confirmación de contraseña"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  {showConfirmPassword ? (
                    <>
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                    </>
                  ) : (
                    <>
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </>
                  )}
                </svg>
              </button>
            </div>
          </div>

          {/* Botones */}
          <div className="reg_footer">
            <button type="submit" className="reg_boton" disabled={cargando}>
              {cargando ? 'Registrando...' : 'Registrarse'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/panel')}
              className="reg_boton reg_boton-secundario"
            >
              Volver atrás
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Registro;
