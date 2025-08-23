import React, { useState, useEffect, useRef } from 'react';
import {
  FaTimes, FaCheck, FaSpinner, FaBarcode,
  FaUser, FaHome, FaPhone, FaCalendarAlt,
  FaMoneyBillWave, FaIdCard, FaBan, FaExclamationTriangle
} from 'react-icons/fa';
import BASE_URL from '../../../config/config';
import Toast from '../../Global/Toast';
import './ModalCodigoBarras.css';

const ModalCodigoBarras = ({ onClose, periodo, onPagoRealizado }) => {
  const [codigo, setCodigo] = useState('');
  const [loadingPago, setLoadingPago] = useState(false);
  const [loadingCondonar, setLoadingCondonar] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState(false);

  const [socioEncontrado, setSocioEncontrado] = useState(null);
  const [estadoPeriodo, setEstadoPeriodo] = useState(null); // 'pendiente' | 'pagado' | 'condonado' | null
  const [verificandoEstado, setVerificandoEstado] = useState(false);

  // ====== Sistema de TOAST con reemplazo duro ======
  const [toastVisible, setToastVisible] = useState(false);
  // Conservamos la estructura por si en el futuro querés volver a usar cola,
  // pero ahora la dejamos SIEMPRE vacía cuando se reemplaza.
  const [toastQueue, setToastQueue] = useState([]); // no se usa para encolar; se limpia en reemplazos
  const [currentToast, setCurrentToast] = useState(null); // {id, tipo, mensaje, duracion}

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

  // ====== Helpers de Toast (reemplazo y sin cola) ======
  const mostrarToast = (tipo, mensaje, duracion = 3000) => {
    const nuevo = { id: Date.now() + Math.random(), tipo, mensaje, duracion };
    // Reemplazo duro: si hay uno visible, se reemplaza y se vacía la "cola".
    setCurrentToast(nuevo);
    setToastVisible(true);
    setToastQueue([]); // aseguramos que no quede nada por mostrar luego
  };

  const handleToastClose = () => {
    // Cerrar el actual; no mostramos nada más porque no hay cola.
    const toastQueCerro = currentToast;

    setCurrentToast(null);
    setToastVisible(false);
    setToastQueue([]); // por las dudas, vaciamos

    // Limpiar formulario sólo si el que se cerró fue de éxito por pago/condonación
    if (
      toastQueCerro &&
      toastQueCerro.tipo === 'exito' &&
      (toastQueCerro.mensaje.includes('Pago registrado') ||
       toastQueCerro.mensaje.includes('Condonación'))
    ) {
      limpiarFormulario();
    }
  };
  // ====== Fin sistema de TOAST ======

  /** === API: Buscar socio por código === */
  const buscarPorCodigo = async (input) => {
    if (input.length < 2) {
      setMensaje('⛔ El código debe tener al menos 2 dígitos (1 para período y al menos 1 para socio)');
      setError(true);
      return;
    }
    const id_periodo = parseInt(input.charAt(0), 10);
    const id_socio = input.slice(1);
    if (!id_socio || isNaN(id_periodo) || id_periodo < 1 || id_periodo > 6) {
      setMensaje('⛔ Código inválido. Formato esperado: [1 dígito periodo] + [ID socio]');
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
      if (data.exito) {
        const socio = data.socio;
        socio.telefono = socio.telefono_movil || socio.telefono_fijo || '';
        socio.domicilio_completo = [socio.domicilio, socio.numero].filter(Boolean).join(' ');
        const payload = { ...socio, id_periodo, id_socio: socio.id_socio };
        setSocioEncontrado(payload);
        setMensaje(`✅ Socio encontrado: ${socio.nombre}`);
        mostrarToast('exito', `Socio ${socio.nombre} encontrado`);
        // Verificar estado del período apenas se encuentra el socio
        await verificarEstadoPeriodo(payload.id_socio, id_periodo);
      } else {
        setMensaje(data.mensaje || 'Socio no encontrado');
        setError(true);
        mostrarToast('error', data.mensaje || 'Socio no encontrado');
      }
    } catch {
      setMensaje('⛔ Error al conectar con el servidor');
      setError(true);
      mostrarToast('error', 'Error al conectar con el servidor');
    }
  };

  /** === API: Verificar estado del período para el socio (devuelve estado) === */
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

  /** === Registrar pago o condonación con verificación previa (race-safe) === */
  const callRegistrar = async ({ condonar = false }) => {
    if (!socioEncontrado || !socioEncontrado.id_periodo) {
      setMensaje('⛔ No se puede registrar. Datos incompletos.');
      setError(true);
      mostrarToast('error', 'Datos incompletos para registrar');
      return;
    }

    // Re-verificar estado y usar el valor DEVUELTO (evita leer state desactualizado)
    const estadoActual = await verificarEstadoPeriodo(socioEncontrado.id_socio, socioEncontrado.id_periodo);
    if (estadoActual === 'pagado' || estadoActual === 'condonado') {
      const etiqueta = estadoActual === 'pagado' ? 'Pagado' : 'Condonado';
      mostrarToast('advertencia', `Ya estaba ${etiqueta}. No se puede ${condonar ? 'condonar' : 'registrar el pago'}.`);
      return;
    }

    condonar ? setLoadingCondonar(true) : setLoadingPago(true);
    try {
      const res = await fetch(`${BASE_URL}/api.php?action=registrar_pago`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_socio: socioEncontrado.id_socio,
          periodos: [socioEncontrado.id_periodo],
          ...(condonar ? { condonar: true } : {})
        })
      });

      const data = await res.json();
      if (data.exito) {
        const okMsg = condonar ? 'Condonación registrada correctamente' : 'Pago registrado correctamente';
        setMensaje(`✅ ${okMsg}`);
        setError(false);
        mostrarToast('exito', okMsg); // -> con key única, se ve siempre
        // Actualizar estado local para reflejar DB
        setEstadoPeriodo(condonar ? 'condonado' : 'pagado');
        onPagoRealizado && onPagoRealizado();
      } else if (data.mensaje?.includes('ya fue registrado anteriormente')) {
        setMensaje(data.mensaje);
        setError(false);
        mostrarToast('advertencia', data.mensaje);
        setEstadoPeriodo(condonar ? 'condonado' : 'pagado');
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
    const mapa = { 1: '1/2', 2: '3/4', 3: '5/6', 4: '7/8', 5: '9/10', 6: '11/12' };
    return mapa[id] || `Período ${id}`;
  };

  const estadoBadge = (estado) => {
    if (!estado) return null;
    const map = {
      pagado: { text: 'Pagado', className: 'codb-badge', extra: { background: 'rgba(16,185,129,.12)', color: '#059669' } },
      condonado: { text: 'Condonado', className: 'codb-badge', extra: { background: 'rgba(245,158,11,.15)', color: '#B45309' } },
      pendiente: { text: 'Pendiente', className: 'codb-badge', extra: { background: 'rgba(37,99,235,.12)', color: '#2563EB' } },
    };
    const cfg = map[estado] || map.pendiente;
    return <span className="codb-badge" style={cfg.extra}>{cfg.text}</span>;
  };

  const accionesDeshabilitadas =
    verificandoEstado ||
    loadingPago ||
    loadingCondonar ||
    (estadoPeriodo === 'pagado' || estadoPeriodo === 'condonado');

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
                  placeholder="Ej: 1123 (Período + ID del socio)"
                  className={`codb-search-input ${error ? 'codb-input-error' : ''}`}
                />
                <div className="codb-input-hint">
                  <FaIdCard /> Formato: PERÍODO (1 dígito) + ID del socio
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
                    <div className="codb-info-value codb-amount">$4,000.00</div>
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

      {/* === Modal de confirmación para CONDONAR (AMARILLO) === */}
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
                disabled={loadingCondonar || estadoPeriodo === 'pagado' || estadoPeriodo === 'condonado'}
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
          key={currentToast.id}              // fuerza remount y reinicia timers
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
