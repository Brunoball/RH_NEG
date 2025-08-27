import React, { useState, useEffect, useRef } from 'react';
import {
  FaTimes, FaCheck, FaSpinner, FaBarcode,
  FaUser, FaHome, FaPhone, FaCalendarAlt,
  FaMoneyBillWave, FaIdCard, FaBan, FaExclamationTriangle
} from 'react-icons/fa';
import BASE_URL from '../../../config/config';
import Toast from '../../Global/Toast';
import './ModalCodigoBarras.css';

const PRECIO_MENSUAL = 4000;
const PRECIO_ANUAL = 21000;

const ModalCodigoBarras = ({ onClose, periodo, onPagoRealizado }) => {
  const [codigo, setCodigo] = useState('');
  const [loadingPago, setLoadingPago] = useState(false);
  const [loadingCondonar, setLoadingCondonar] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState(false);

  const [socioEncontrado, setSocioEncontrado] = useState(null);
  const [estadoPeriodo, setEstadoPeriodo] = useState(null); // 'pendiente' | 'pagado' | 'condonado' | 'bloqueado' | null
  const [verificandoEstado, setVerificandoEstado] = useState(false);

  // TOAST
  const [toastVisible, setToastVisible] = useState(false);
  const [toastQueue, setToastQueue] = useState([]); // sin cola real, por compat
  const [currentToast, setCurrentToast] = useState(null);

  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);

  useEffect(() => {
    const delay = setTimeout(() => {
      if (!codigo.trim()) {
        setSocioEncontrado(null);
        setEstadoPeriodo(null);
        setMensaje('');
        return;
      }
      const limpio = codigo.replace(/[^0-9]/g, '');
      if (/^\d+$/.test(limpio)) {
        buscarPorCodigo(limpio);
      } else {
        setMensaje('⛔ Solo se permite ingresar código numérico del socio');
        setError(true);
      }
    }, 400);
    return () => clearTimeout(delay);
  }, [codigo]);

  const limpiarFormulario = () => {
    setCodigo('');
    setSocioEncontrado(null);
    setEstadoPeriodo(null);
    setMensaje('');
    setError(false);
    if (inputRef.current) inputRef.current.focus();
  };

  const mostrarToast = (tipo, mensaje, duracion = 3000) => {
    const nuevo = { id: Date.now() + Math.random(), tipo, mensaje, duracion };
    setCurrentToast(nuevo);
    setToastVisible(true);
    setToastQueue([]);
  };

  const handleToastClose = () => {
    const t = currentToast;
    setCurrentToast(null);
    setToastVisible(false);
    setToastQueue([]);
    if (t && t.tipo === 'exito' && (t.mensaje.includes('Pago registrado') || t.mensaje.includes('Condonación'))) {
      limpiarFormulario();
    }
  };

  /** === API: Buscar socio por código === */
  const buscarPorCodigo = async (input) => {
    if (input.length < 2) {
      setMensaje('⛔ El código debe tener al menos 2 dígitos (1 para período y al menos 1 para socio)');
      setError(true);
      return;
    }

    // Primer dígito = período (1..6 bimestrales, 7 = CONTADO ANUAL)
    const id_periodo = parseInt(input.charAt(0), 10);
    const id_socio = input.slice(1);

    if (!id_socio || isNaN(id_periodo) || id_periodo < 1 || id_periodo > 7) {
      setMensaje('⛔ Código inválido. Formato esperado: [1 dígito período (1..7)] + [ID socio]');
      setError(true);
      return;
    }

    setMensaje('');
    setError(false);
    setSocioEncontrado(null);
    setEstadoPeriodo(null);

    try {
      const res = await fetch(
        `${BASE_URL}/api.php?action=buscar_socio_codigo&id_socio=${id_socio}&id_periodo=${id_periodo}`
      );
      const data = await res.json();

      if (!data.exito) {
        // Error real (no encontrado, etc.)
        setMensaje(data.mensaje || 'Socio no encontrado');
        setError(true);
        mostrarToast('error', data.mensaje || 'Socio no encontrado');
        return;
      }

      const socio = data.socio;
      socio.telefono = socio.telefono_movil || socio.telefono_fijo || '';
      socio.domicilio_completo = [socio.domicilio, socio.numero].filter(Boolean).join(' ');
      const payload = { ...socio, id_periodo, id_socio: socio.id_socio };
      setSocioEncontrado(payload);
      setMensaje(`✅ Socio encontrado: ${socio.nombre}`);
      mostrarToast('exito', `Socio ${socio.nombre} encontrado`);

      // Si el backend marcó bloqueo, no dejamos operar pero mostramos los datos
      if (data.bloqueado) {
        setEstadoPeriodo('bloqueado');
        if (data.motivo_bloqueo) {
          mostrarToast('error', data.motivo_bloqueo);
        }
        return; // no consultar estado puntual
      }

      // Si no está bloqueado, verificamos estado puntual del período
      await verificarEstadoPeriodo(payload.id_socio, id_periodo);
    } catch {
      setMensaje('⛔ Error al conectar con el servidor');
      setError(true);
      mostrarToast('error', 'Error al conectar con el servidor');
    }
  };

  /** === API: Verificar estado del mismo período === */
  const verificarEstadoPeriodo = async (id_socio, id_periodo) => {
    setVerificandoEstado(true);
    try {
      const res = await fetch(
        `${BASE_URL}/api.php?action=estado_periodo_socio&id_socio=${id_socio}&id_periodo=${id_periodo}`
      );
      const data = await res.json();
      let estado = 'pendiente';
      if (data.exito) {
        estado = data.estado || 'pendiente';
        setEstadoPeriodo(estado);
        if (estado === 'pagado' || estado === 'condonado') {
          const etiqueta = estado === 'pagado' ? 'Pagado' : 'Condonado';
          mostrarToast('advertencia', `Este período ya está ${etiqueta}.`);
        }
      } else {
        setEstadoPeriodo('pendiente');
      }
      return estado;
    } catch {
      setEstadoPeriodo('pendiente');
      mostrarToast('error', 'No se pudo verificar el estado actual. Intentá nuevamente.');
      return 'pendiente';
    } finally {
      setVerificandoEstado(false);
    }
  };

  /** === Registrar pago / condonación === */
  const callRegistrar = async ({ condonar = false }) => {
    if (!socioEncontrado || !socioEncontrado.id_periodo) {
      setMensaje('⛔ No se puede registrar. Datos incompletos.');
      setError(true);
      mostrarToast('error', 'Datos incompletos para registrar');
      return;
    }

    // Si está bloqueado por reglas de negocio, no permitir
    if (estadoPeriodo === 'bloqueado') {
      mostrarToast('advertencia', 'Acción bloqueada por reglas de negocio.');
      return;
    }

    // Re-verificar estado exacto del período
    const estadoActual = await verificarEstadoPeriodo(socioEncontrado.id_socio, socioEncontrado.id_periodo);
    if (estadoActual === 'pagado' || estadoActual === 'condonado') {
      const etiqueta = estadoActual === 'pagado' ? 'Pagado' : 'Condonado';
      mostrarToast('advertencia', `No se puede registrar: ${etiqueta}.`);
      return;
    }

    condonar ? setLoadingCondonar(true) : setLoadingPago(true);
    try {
      const res = await fetch(`${BASE_URL}/api.php?action=registrar_pago`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_socio: socioEncontrado.id_socio,
          periodos: [socioEncontrado.id_periodo], // incluye 7 (anual)
          ...(condonar ? { condonar: true } : {})
        })
      });

      const data = await res.json();
      if (data.exito) {
        const okMsg = condonar ? 'Condonación registrada correctamente' : 'Pago registrado correctamente';
        setMensaje(`✅ ${okMsg}`);
        setError(false);
        mostrarToast('exito', okMsg);
        setEstadoPeriodo(condonar ? 'condonado' : 'pagado');
        onPagoRealizado && onPagoRealizado();
      } else {
        const errMsg = data.mensaje || (condonar ? '⛔ Error al condonar' : '⛔ Error al registrar el pago');
        setMensaje(errMsg);
        setError(true);
        mostrarToast('error', errMsg);
      }
    } catch {
      const errMsg = condonar ? 'Error al conectar (condonar)' : 'Error al conectar (pago)';
      setMensaje(`⛔ ${errMsg}`);
      setError(true);
      mostrarToast('error', errMsg);
    } finally {
      condonar ? setLoadingCondonar(false) : setLoadingPago(false);
    }
  };

  const registrarPago = () => callRegistrar({ condonar: false });

  const [mostrarConfirmarCondonacion, setMostrarConfirmarCondonacion] = useState(false);
  const abrirConfirmacionCondonar = () => setMostrarConfirmarCondonacion(true);
  const cerrarConfirmacionCondonar = () => setMostrarConfirmarCondonacion(false);
  const confirmarCondonacion = async () => {
    await callRegistrar({ condonar: true });
    setMostrarConfirmarCondonacion(false);
  };

  const mostrarPeriodoFormateado = (id) => {
    const mapa = { 1: '1/2', 2: '3/4', 3: '5/6', 4: '7/8', 5: '9/10', 6: '11/12', 7: 'CONTADO ANUAL' };
    return mapa[id] || `Período ${id}`;
  };

  const montoMostrar = (() => {
    if (!socioEncontrado) return PRECIO_MENSUAL;
    return socioEncontrado.id_periodo === 7 ? PRECIO_ANUAL : PRECIO_MENSUAL;
  })();

  const estadoBadge = (estado) => {
    if (!estado) return null;
    const map = {
      pagado: { text: 'Pagado', extra: { background: 'rgba(16,185,129,.12)', color: '#059669' } },
      condonado: { text: 'Condonado', extra: { background: 'rgba(245,158,11,.15)', color: '#B45309' } },
      pendiente: { text: 'Pendiente', extra: { background: 'rgba(37,99,235,.12)', color: '#2563EB' } },
      bloqueado: { text: 'Bloqueado', extra: { background: 'rgba(239,68,68,.15)', color: '#DC2626' } },
    };
    const cfg = map[estado] || map.pendiente;
    return <span className="codb-badge" style={cfg.extra}>{cfg.text}</span>;
  };

  const accionesDeshabilitadas =
    verificandoEstado ||
    loadingPago ||
    loadingCondonar ||
    estadoPeriodo === 'bloqueado' ||
    estadoPeriodo === 'pagado' ||
    estadoPeriodo === 'condonado';

  const formatearARS = (n) =>
    n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });

  return (
    <div className="codb-modal-overlay">
      <div className="codb-modal-container">
        <div className="codb-modal">
          <div className="codb-modal-header">
            <div className="codb-header-icon"><FaBarcode /></div>
            <div className="codb-header-text">
              <h2>Registro de Pagos</h2>
              <p>Escaneá el código de barras o ingresá manualmente el número</p>
            </div>
            <button className="codb-close-button" onClick={onClose}><FaTimes /></button>
          </div>

          <div className="codb-modal-content">
            <div className="codb-search-section">
              <div className="codb-search-input-container">
                <input
                  ref={inputRef}
                  type="text"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  placeholder="Ej: 7123 (Período + ID del socio) — 7 = Contado Anual"
                  className={`codb-search-input ${error ? 'codb-input-error' : ''}`}
                />
                <div className="codb-input-hint">
                  <FaIdCard /> Formato: PERÍODO (1 dígito: 1..7) + ID del socio
                </div>
              </div>
            </div>

            {socioEncontrado && (
              <div className="codb-member-info">
                <div className="codb-info-header">
                  <h3>Información del Socio</h3>
                  <div className="codb-member-id">ID: {socioEncontrado.id_socio}</div>
                </div>

                <div className="codb-info-grid">
                  <div className="codb-info-row">
                    <div className="codb-info-label"><FaUser /> Nombre:</div>
                    <div className="codb-info-value">{socioEncontrado.nombre}</div>
                  </div>
                  <div className="codb-info-row">
                    <div className="codb-info-label"><FaHome /> Domicilio:</div>
                    <div className="codb-info-value">{socioEncontrado.domicilio_completo}</div>
                  </div>
                  <div className="codb-info-row">
                    <div className="codb-info-label"><FaPhone /> Teléfono:</div>
                    <div className="codb-info-value">{socioEncontrado.telefono}</div>
                  </div>
                  <div className="codb-info-row">
                    <div className="codb-info-label"><FaCalendarAlt /> Período:</div>
                    <div className="codb-info-value codb-badge">
                      {mostrarPeriodoFormateado(socioEncontrado.id_periodo)}
                    </div>
                  </div>
                  <div className="codb-info-row">
                    <div className="codb-info-label"><FaMoneyBillWave /> Estado:</div>
                    <div className="codb-info-value">
                      {verificandoEstado ? 'Verificando...' : estadoBadge(estadoPeriodo)}
                    </div>
                  </div>
                  <div className="codb-info-row">
                    <div className="codb-info-label"><FaMoneyBillWave /> Monto:</div>
                    <div className="codb-info-value codb-amount">
                      {formatearARS(montoMostrar)}
                    </div>
                  </div>
                </div>

                <div className="codb-actions-row">
                  <button
                    onClick={() => setMostrarConfirmarCondonacion(true)}
                    disabled={accionesDeshabilitadas}
                    className="codb-condonar-button"
                    title="Condonar período"
                  >
                    {loadingCondonar ? (
                      <>
                        <FaSpinner className="codb-spinner" /> Condonando...
                      </>
                    ) : (
                      <>
                        <FaBan /> Condonar
                      </>
                    )}
                  </button>

                  <button
                    onClick={registrarPago}
                    disabled={accionesDeshabilitadas}
                    className="codb-payment-button"
                    title="Registrar pago"
                  >
                    {loadingPago ? (
                      <>
                        <FaSpinner className="codb-spinner" /> Procesando...
                      </>
                    ) : (
                      <>
                        <FaCheck /> Registrar Pago
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmación CONDONAR */}
      {mostrarConfirmarCondonacion && socioEncontrado && (
        <div className="soc-modal-overlay-condonar" role="dialog" aria-modal="true">
          <div className="soc-modal-contenido-condonar" role="document">
            <div className="soc-modal-icono-condonar">
              <FaExclamationTriangle />
            </div>
            <h3 className="soc-modal-titulo-condonar">Confirmar Condonación</h3>
            <p className="soc-modal-texto-condonar">
              Vas a <strong>CONDONAR</strong> el período{' '}
              <span className="codb-confirm-pill">{mostrarPeriodoFormateado(socioEncontrado.id_periodo)}</span>{' '}
              del socio <strong>{socioEncontrado.nombre}</strong> (ID {socioEncontrado.id_socio}).
            </p>
            <div className="soc-modal-botones-condonar">
              <button
                className="soc-boton-cancelar-condonar"
                onClick={() => setMostrarConfirmarCondonacion(false)}
                disabled={loadingCondonar}
              >
                Cancelar
              </button>
              <button
                className="soc-boton-confirmar-condonar"
                onClick={async () => await confirmarCondonacion()}
                disabled={loadingCondonar || estadoPeriodo === 'pagado' || estadoPeriodo === 'condonado' || estadoPeriodo === 'bloqueado'}
                title="Condonar período"
              >
                {loadingCondonar ? (
                  <>
                    <FaSpinner className="codb-spinner" /> Condonando...
                  </>
                ) : (
                  'Condonar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {toastVisible && currentToast && (
        <Toast
          key={currentToast.id}
          tipo={currentToast.tipo}
          mensaje={currentToast.mensaje}
          duracion={currentToast.duracion ?? 3000}
          onClose={handleToastClose}
        />
      )}
    </div>
  );
};

export default ModalCodigoBarras;
