// src/components/Login/Inicio.jsx
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BASE_URL from '../../config/config';
import './inicio.css';
import logoRH from '../../imagenes/Logo_rh.jpeg';

const SESSION_DURATION_MS = 60 * 60 * 1000;
const LAST_ACTIVITY_KEY = 'app_last_activity_at';
const EXPIRES_AT_KEY = 'app_session_expires_at';

const iniciarVigenciaSesion = () => {
  const ahora = Date.now();
  localStorage.setItem(LAST_ACTIVITY_KEY, String(ahora));
  localStorage.setItem(EXPIRES_AT_KEY, String(ahora + SESSION_DURATION_MS));
};

const Inicio = () => {
  const [nombre, setNombre] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [recordar, setRecordar] = useState(
    () => localStorage.getItem('recordarCuenta') === '1'
  );

  const enviandoRef = useRef(false);
  const navigate = useNavigate();

  // Prefill si estaba recordado.
  useEffect(() => {
    if (!recordar) return;

    const usuarioRecordado = localStorage.getItem('usuarioRecordado') || '';
    const passRecordada = localStorage.getItem('passRecordada') || '';

    if (usuarioRecordado) setNombre(usuarioRecordado);
    if (passRecordada) setContrasena(passRecordada);
  }, [recordar]);

  const togglePasswordVisibility = () => setShowPassword((visible) => !visible);

  const redirigirAlPanel = () => {
    /*
      La aplicación usa HashRouter, por lo que la navegación debe hacerse solo
      con React Router. Un window.location.replace('/panel') recarga el sitio
      fuera de #/panel y puede devolver al login, que era el efecto de "primer
      clic recarga / segundo clic entra".
    */
    navigate('/panel', { replace: true });
  };

  const manejarEnvio = async (e) => {
    e.preventDefault();

    // useState no bloquea dos eventos ocurridos dentro del mismo render.
    // El ref sí lo hace de forma inmediata y evita solicitudes duplicadas.
    if (enviandoRef.current) return;

    setMensaje('');

    // Se leen los valores reales del formulario para cubrir correctamente el
    // autocompletado del navegador/gestor de contraseñas, que a veces muestra
    // datos en pantalla antes de sincronizarlos con el estado de React.
    const formData = new FormData(e.currentTarget);
    const user = String(formData.get('nombre') ?? nombre).trim();
    const pass = String(formData.get('contrasena') ?? contrasena);

    if (!user || !pass) {
      setMensaje('Por favor complete todos los campos');
      return;
    }

    enviandoRef.current = true;
    setCargando(true);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(`${BASE_URL}/api.php?action=inicio`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        cache: 'no-store',
        signal: controller.signal,
        body: JSON.stringify({ nombre: user, contrasena: pass }),
      });

      let data = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok || !data) {
        throw new Error(
          (data && (data.mensaje || data.error)) || 'Error del servidor'
        );
      }

      if (!data.exito) {
        setMensaje(data.mensaje || 'Credenciales incorrectas');
        return;
      }

      if (!data.usuario) {
        throw new Error('El servidor no devolvió los datos del usuario.');
      }

      /*
        localStorage es sincrónico. Primero persistimos toda la sesión y
        renovamos sus timestamps; recién después navegamos. Esto reemplaza
        cualquier vencimiento viejo que haya quedado guardado desde la última
        vez que se usó la computadora.
      */
      localStorage.setItem('usuario', JSON.stringify(data.usuario));

      if (data.token) {
        localStorage.setItem('token', data.token);
      } else {
        localStorage.removeItem('token');
      }

      iniciarVigenciaSesion();

      // Recordar cuenta (solo completa el formulario; no inicia sesión solo).
      if (recordar) {
        localStorage.setItem('recordarCuenta', '1');
        localStorage.setItem('usuarioRecordado', user);
        localStorage.setItem('passRecordada', pass);
      } else {
        localStorage.removeItem('recordarCuenta');
        localStorage.removeItem('usuarioRecordado');
        localStorage.removeItem('passRecordada');
      }

      redirigirAlPanel();
    } catch (err) {
      console.error('Error al iniciar sesión:', err);

      if (err?.name === 'AbortError') {
        setMensaje('El servidor tardó demasiado en responder. Intente nuevamente.');
      } else {
        setMensaje(err?.message || 'Error del servidor. Intente más tarde.');
      }
    } finally {
      window.clearTimeout(timeoutId);
      enviandoRef.current = false;
      setCargando(false);
    }
  };

  return (
    <div className="ini_contenedor-principal">
      <div className="ini_contenedor">
        <div className="ini_encabezado">
          <img src={logoRH} alt="Logo RH" className="ini_logo" />
          <h1 className="ini_titulo">Iniciar Sesión</h1>
          <p className="ini_subtitulo">Ingresa tus credenciales para acceder al sistema</p>
        </div>

        {mensaje && (
          <p className="ini_mensaje" role="alert" aria-live="polite">
            {mensaje}
          </p>
        )}

        <form
          onSubmit={manejarEnvio}
          className="ini_formulario"
          aria-busy={cargando}
        >
          <div className="ini_campo">
            <input
              type="text"
              name="nombre"
              placeholder="Usuario"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              onInput={(e) => setNombre(e.currentTarget.value)}
              required
              className="ini_input"
              autoComplete="username"
              autoFocus
              disabled={cargando}
            />
          </div>

          <div className="ini_campo ini_campo-password">
            <input
              type={showPassword ? 'text' : 'password'}
              name="contrasena"
              className="ini_input"
              placeholder="Contraseña"
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
              onInput={(e) => setContrasena(e.currentTarget.value)}
              required
              autoComplete="current-password"
              disabled={cargando}
            />
            <button
              type="button"
              className="ini_toggle-password"
              onClick={togglePasswordVisibility}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              disabled={cargando}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                {showPassword ? (
                  <>
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </>
                ) : (
                  <>
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </>
                )}
              </svg>
            </button>
          </div>

          <div className="ini_recordar">
            <label className="ini_check">
              <input
                type="checkbox"
                checked={recordar}
                onChange={(e) => setRecordar(e.target.checked)}
                disabled={cargando}
              />
              <span>Recordar cuenta</span>
            </label>
          </div>

          <div className="ini_footer">
            <button type="submit" className="ini_boton" disabled={cargando}>
              {cargando ? 'Iniciando...' : 'Iniciar Sesión'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Inicio;
