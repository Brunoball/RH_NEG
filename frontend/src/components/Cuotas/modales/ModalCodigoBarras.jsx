// src/components/Cuotas/modales/ModalCodigoBarras.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  FaTimes, FaCheck, FaSpinner, FaBarcode,
  FaUser, FaHome, FaPhone, FaCalendarAlt,
  FaMoneyBillWave, FaIdCard, FaBan, FaExclamationTriangle, FaTag
} from 'react-icons/fa';
import BASE_URL from '../../../config/config';
import Toast from '../../Global/Toast';
import './ModalCodigoBarras.css';

const ANUAL_ID = 7; // Contado anual

const ModalCodigoBarras = ({ onClose, periodo, onPagoRealizado }) => {
  const [codigo, setCodigo] = useState('');
  const [loadingPago, setLoadingPago] = useState(false);
  const [loadingCondonar, setLoadingCondonar] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState(false);

  const [socioEncontrado, setSocioEncontrado] = useState(null);
  const [estadoPeriodo, setEstadoPeriodo] = useState(null); // 'pendiente' | 'pagado' | 'condonado' | 'bloqueado' | null
  const [verificandoEstado, setVerificandoEstado] = useState(false);

  // MONTOS dinámicos (desde DB) — igual que ModalPagos
  const [montoMensual, setMontoMensual] = useState(0);
  const [montoAnual, setMontoAnual] = useState(0);

  // TOAST
  const [toastVisible, setToastVisible] = useState(false);
  const [currentToast, setCurrentToast] = useState(null);

  // Modales de confirmación
  const [mostrarConfirmarCondonacion, setMostrarConfirmarCondonacion] = useState(false);
  const [mostrarConfirmarPago, setMostrarConfirmarPago] = useState(false);

  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);

  // === Cargar MONTOS al tener socioEncontrado (igual que ModalPagos) ===
  useEffect(() => {
    const cargarMontos = async () => {
      if (!socioEncontrado) {
        setMontoMensual(0);
        setMontoAnual(0);
        return;
      }
      try {
        const qs = new URLSearchParams();
        if (socioEncontrado.id_cat_monto) qs.set('id_cat_monto', String(socioEncontrado.id_cat_monto));
        if (socioEncontrado.id_socio)     qs.set('id_socio',     String(socioEncontrado.id_socio));

        const res = await fetch(`${BASE_URL}/api.php?action=montos&${qs.toString()}`);
        const data = await res.json();

        if (data?.exito) {
          setMontoMensual(Number(data.mensual) || 0);
          setMontoAnual(Number(data.anual) || 0);
        } else {
          setMontoMensual(0);
          setMontoAnual(0);
          mostrarToast('advertencia', data?.mensaje || 'No se pudieron obtener los montos para la categoría del socio.');
        }
      } catch {
        setMontoMensual(0);
        setMontoAnual(0);
        mostrarToast('error', 'Error al consultar montos para la categoría del socio.');
      }
    };

    cargarMontos();
  }, [socioEncontrado]);

  useEffect(() => {
    const delay = setTimeout(() => {
      if (!codigo.trim()) {
        setSocioEncontrado(null);
        setEstadoPeriodo(null);
        setMensaje('');
        setError(false);
        return;
      }

      const limpio = codigo.replace(/[^0-9]/g, '');
      if (!/^\d+$/.test(limpio)) {
        setMensaje('⛔ Solo se permite ingresar números');
        setError(true);
        return;
      }

      // FORMATO: P (1 dígito) + AA (2 dígitos) + ID (>=1 dígito)
      if (limpio.length < 4) {
        setMensaje('⛔ El código debe tener al menos 4 dígitos: PERÍODO (1) + AÑO (2) + ID socio (>=1)');
        setError(true);
        setSocioEncontrado(null);
        setEstadoPeriodo(null);
        return;
      }

      buscarPorCodigo(limpio);
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
  };

  const handleToastClose = () => {
    const t = currentToast;
    setCurrentToast(null);
    setToastVisible(false);
    if (t && t.tipo === 'exito' && (t.mensaje.includes('Pago registrado') || t.mensaje.includes('Condonación'))) {
      limpiarFormulario();
    }
  };

  /** === API: Buscar socio por código (P + AA + ID) === */
  const buscarPorCodigo = async (digits) => {
    if (digits.length < 4) {
      setMensaje('⛔ Código incompleto (PERÍODO + AÑO + ID).');
      setError(true);
      return;
    }

    try {
      const res = await fetch(
        `${BASE_URL}/api.php?action=buscar_socio_codigo&codigo=${encodeURIComponent(digits)}`
      );
      const data = await res.json();

      if (!data.exito) {
        setMensaje(data.mensaje || 'Socio no encontrado');
        setError(true);
        mostrarToast('error', data.mensaje || 'Socio no encontrado');
        setSocioEncontrado(null);
        setEstadoPeriodo(null);
        return;
      }

      const socio = data.socio;
      socio.telefono = socio.telefono_movil || socio.telefono_fijo || '';
      socio.domicilio_completo = [socio.domicilio, socio.numero].filter(Boolean).join(' ');

      // El backend devuelve anio e id_periodo interpretados del código
      const payload = {
        ...socio,
        id_socio: socio.id_socio,
        id_periodo: data.id_periodo,
        anio: data.anio
      };

      setSocioEncontrado(payload);
      setMensaje(`✅ Socio encontrado: ${socio.nombre}`);
      setError(false);
      mostrarToast('exito', `Socio ${socio.nombre} encontrado`);

      // Bloqueos de reglas de negocio
      if (data.bloqueado) {
        setEstadoPeriodo('bloqueado');
        if (data.motivo_bloqueo) mostrarToast('error', data.motivo_bloqueo);
        return;
      }

      // ⬅️ Verificar estado usando el AÑO correcto
      await verificarEstadoPeriodo(payload.id_socio, payload.id_periodo, payload.anio);
    } catch {
      setMensaje('⛔ Error al conectar con el servidor');
      setError(true);
      mostrarToast('error', 'Error al conectar con el servidor');
    }
  };

  /** === API: Verificar estado del período (con año) === */
  const verificarEstadoPeriodo = async (id_socio, id_periodo, anio) => {
    setVerificandoEstado(true);
    try {
      const res = await fetch(
        `${BASE_URL}/api.php?action=estado_periodo_socio&id_socio=${id_socio}&id_periodo=${id_periodo}&anio=${anio}`
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

    if (estadoPeriodo === 'bloqueado') {
      mostrarToast('advertencia', 'Acción bloqueada por reglas de negocio.');
      return;
    }

    // Re-verificar usando el año correcto
    const estadoActual = await verificarEstadoPeriodo(
      socioEncontrado.id_socio,
      socioEncontrado.id_periodo,
      socioEncontrado.anio
    );
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
          anio: socioEncontrado.anio,
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

  // Antes pagaba directo; ahora se confirma
  const registrarPago = () => callRegistrar({ condonar: false });

  const abrirConfirmacionCondonar = () => setMostrarConfirmarCondonacion(true);
  const cerrarConfirmacionCondonar = () => setMostrarConfirmarCondonacion(false);
  const confirmarCondonacion = async () => {
    await callRegistrar({ condonar: true });
    setMostrarConfirmarCondonacion(false);
  };

  const abrirConfirmacionPago = () => setMostrarConfirmarPago(true);
  const cerrarConfirmacionPago = () => setMostrarConfirmarPago(false);
  const confirmarPago = async () => {
    await registrarPago();
    setMostrarConfirmarPago(false); // ✅ correcto
  };

  const mostrarPeriodoFormateado = (id) => {
    const mapa = { 1: '1/2', 2: '3/4', 3: '5/6', 4: '7/8', 5: '9/10', 6: '11/12', 7: 'CONTADO ANUAL' };
    return mapa[id] || `Período ${id}`;
  };

  /** =========
   * PRECIO a mostrar (según socio/categoría) con lógica de anual con o sin descuento.
   * - Enero/Febrero del AÑO del código → usa montoAnual (se asume con descuento). Fallback: mensual*6.
   * - Desde Marzo → mensual*6 (sin descuento).
   * - Períodos normales → mensual.
   * ========= */
  const { montoMostrar, anualConDescuento } = useMemo(() => {
    if (!socioEncontrado) return { montoMostrar: 0, anualConDescuento: false };

    // Período NO anual: siempre "montoMensual" (monto por período)
    if (Number(socioEncontrado.id_periodo) !== ANUAL_ID) {
      return { montoMostrar: Number(montoMensual) || 0, anualConDescuento: false };
    }

    // Período ANUAL:
    const hoy = new Date();
    const mesActual = hoy.getMonth(); // 0 = enero, 1 = febrero, 2 = marzo...
    const anioActual = hoy.getFullYear();

    // El código trae AA → "anio" (YYYY) para el que se paga el anual
    const anioCodigo = Number(socioEncontrado.anio) || anioActual;

    // Si estamos en ENE/FEB del mismo año del código → descuento
    const esEneFeb = (mesActual === 0 || mesActual === 1) && anioActual === anioCodigo;

    if (esEneFeb) {
      const prefer = Number(montoAnual) || 0;              // se asume "con descuento" desde el backend
      const fallback = (Number(montoMensual) || 0) * 6;    // por si anual no viene
      return { montoMostrar: prefer || fallback, anualConDescuento: true };
    }

    // Desde marzo (o si el año no coincide): sin descuento => 6 períodos
    const sinDesc = (Number(montoMensual) || 0) * 6;
    return { montoMostrar: sinDesc, anualConDescuento: false };
  }, [socioEncontrado, montoMensual, montoAnual]);

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
                  placeholder="Ej: 1251393  (P=1, AA=25, ID=1393)"
                  className={`codb-search-input ${error ? 'codb-input-error' : ''}`}
                />
                <div className="codb-input-hint">
                  <FaIdCard /> Formato: <strong>PERÍODO (1 dígito)</strong> + <strong>AÑO (2 dígitos)</strong> + <strong>ID del socio</strong>
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
                    <div className="codb-info-value codb-amount" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {formatearARS(montoMostrar)}
                      {Number(socioEncontrado.id_periodo) === ANUAL_ID && anualConDescuento && (
                        <span className="codb-discount-pill">
                          <FaTag style={{ marginRight: 4 }} />
                          con descuento (Ene/Feb)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="codb-actions-row">
                  <button
                    onClick={abrirConfirmacionCondonar}
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
                    onClick={abrirConfirmacionPago}
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
                onClick={cerrarConfirmacionCondonar}
                disabled={loadingCondonar}
              >
                Cancelar
              </button>
              <button
                className="soc-boton-confirmar-condonar"
                onClick={confirmarCondonacion}
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

      {/* Confirmación PAGAR */}
      {mostrarConfirmarPago && socioEncontrado && (
        <div className="soc-modal-overlay-pagar" role="dialog" aria-modal="true">
          <div className="soc-modal-contenido-pagar" role="document">
            <div className="soc-modal-icono-pagar">
              <FaCheck />
            </div>
            <h3 className="soc-modal-titulo-pagar">Confirmar Pago</h3>
            <p className="soc-modal-texto-pagar">
              Vas a <strong>REGISTRAR EL PAGO</strong> del período{' '}
              <span className="codb-confirm-pill">{mostrarPeriodoFormateado(socioEncontrado.id_periodo)}</span>{' '}
              del socio <strong>{socioEncontrado.nombre}</strong> (ID {socioEncontrado.id_socio}) por un monto de{' '}
              <strong>{formatearARS(montoMostrar)}</strong>.
            </p>
            <div className="soc-modal-botones-pagar">
              <button
                className="soc-boton-cancelar-pagar"
                onClick={cerrarConfirmacionPago}
                disabled={loadingPago}
              >
                Cancelar
              </button>
              <button
                className="soc-boton-confirmar-pagar"
                onClick={confirmarPago}
                disabled={loadingPago || estadoPeriodo === 'pagado' || estadoPeriodo === 'condonado' || estadoPeriodo === 'bloqueado'}
                title="Registrar pago"
              >
                {loadingPago ? (
                  <>
                    <FaSpinner className="codb-spinner" /> Procesando...
                  </>
                ) : (
                  'Confirmar Pago'
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
