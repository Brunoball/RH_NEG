// src/components/Cuotas/modales/ModalPagos.jsx
import React, { useEffect, useState, useMemo } from 'react';
import { FaCoins, FaCalendarAlt } from 'react-icons/fa';
import BASE_URL from '../../../config/config';
import Toast from '../../Global/Toast';
import './ModalPagos.css';
import { imprimirRecibosUnicos } from '../../../utils/Recibosunicos';

// ======= CONSTANTES LÓGICAS (no montos) =======
const MESES_ANIO = 6;     // cantidad de bimestres que equivale a "anual"
const ID_CONTADO_ANUAL = 7;
const MIN_YEAR = 2025;    // primer año visible en el selector

const obtenerPrimerMesDesdeNombre = (nombre) => {
  const match = nombre.match(/\d+/);
  return match ? parseInt(match[0], 10) : 1;
};

const construirListaAnios = (nowYear) => {
  const start = MIN_YEAR;
  const end = nowYear + 4;
  const arr = [];
  for (let y = start; y <= end; y++) arr.push(y);
  return arr;
};

/** Ventana anual activa: visible del 15-dic al 28/29-feb (implementado como [15-dic, 1-mar)). */
const ventanaAnualActiva = () => {
  const hoy = new Date();
  const y = hoy.getFullYear();
  const startActual = new Date(y, 11, 15);   // 15-dic-y
  const endSiguiente = new Date(y + 1, 2, 1); // 1-mar-(y+1)
  if (hoy >= startActual && hoy < endSiguiente) return true;

  const startPrev = new Date(y - 1, 11, 15); // 15-dic-(y-1)
  const endActual = new Date(y, 2, 1);       // 1-mar-y
  if (hoy >= startPrev && hoy < endActual) return true;

  return false;
};

const ModalPagos = ({ socio, onClose }) => {
  const nowYear = new Date().getFullYear();

  const [periodos, setPeriodos] = useState([]);
  const [seleccionados, setSeleccionados] = useState([]);
  const [periodosPagados, setPeriodosPagados] = useState([]);
  const [estadosPorPeriodo, setEstadosPorPeriodo] = useState({});
  const [fechaIngreso, setFechaIngreso] = useState('');
  const [cargando, setCargando] = useState(false);
  const [toast, setToast] = useState(null);
  const [todosSeleccionados, setTodosSeleccionados] = useState(false);
  const [pagoExitoso, setPagoExitoso] = useState(false);

  // Montos desde DB (depende de la categoría del socio)
  const [montoMensual, setMontoMensual] = useState(0);
  const [montoAnual, setMontoAnual] = useState(0);

  // condonar
  const [condonar, setCondonar] = useState(false);

  // Año de trabajo + selector
  const [anioTrabajo, setAnioTrabajo] = useState(Math.max(nowYear, MIN_YEAR));
  const [showYearPicker, setShowYearPicker] = useState(false);
  const yearOptions = useMemo(() => construirListaAnios(nowYear), [nowYear]);

  const mostrarToast = (tipo, mensaje, duracion = 3000) => {
    setToast({ tipo, mensaje, duracion });
  };

  // ===== helpers para (re)consultar montos exactos al instante =====
  const buildMontosQS = () => {
    const qs = new URLSearchParams();
    if (socio?.id_cat_monto) qs.set('id_cat_monto', String(socio.id_cat_monto));
    if (socio?.id_socio)     qs.set('id_socio',     String(socio.id_socio));
    return qs.toString();
  };

  const refrescarMontosActuales = async () => {
    try {
      const res = await fetch(`${BASE_URL}/api.php?action=montos&${buildMontosQS()}`);
      const data = await res.json();
      if (data?.exito) {
        setMontoMensual(Number(data.mensual) || 0);
        setMontoAnual(Number(data.anual) || 0);
      } else {
        mostrarToast('advertencia', data?.mensaje || 'No se pudieron obtener los montos actualizados.');
      }
    } catch {
      mostrarToast('error', 'Error al consultar montos actualizados.');
    }
  };

  /* ===============================
   * CARGA DE MONTOS POR CATEGORÍA (inicial)
   * =============================== */
  useEffect(() => {
    if (!socio) return;
    refrescarMontosActuales();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socio]);

  // Carga inicial + cuando cambia el año elegido
  useEffect(() => {
    const fetchDatos = async () => {
      setCargando(true);
      try {
        const [resListas, resPagados] = await Promise.all([
          fetch(`${BASE_URL}/api.php?action=listas`),
          fetch(`${BASE_URL}/api.php?action=periodos_pagados&id_socio=${socio.id_socio}&anio=${anioTrabajo}`)
        ]);

        const dataListas = await resListas.json();
        const dataPagados = await resPagados.json();

        if (dataListas.exito) {
          const ordenados = dataListas.listas.periodos.sort((a, b) => a.id - b.id);
          setPeriodos(ordenados);
        }

        if (dataPagados.exito) {
          let mapa = dataPagados.estados_por_periodo;
          if (!mapa || typeof mapa !== 'object') {
            mapa = {};
            (dataPagados.periodos_pagados || []).forEach((id) => { mapa[id] = 'pagado'; });
          }
          setEstadosPorPeriodo(mapa);
          setPeriodosPagados(Object.keys(mapa).map((k) => parseInt(k, 10)).filter(Number.isFinite));
          setFechaIngreso(dataPagados.ingreso);
        } else {
          setEstadosPorPeriodo({});
          setPeriodosPagados([]);
          mostrarToast('advertencia', 'No se pudieron obtener períodos marcados para el año seleccionado');
        }
      } catch (error) {
        console.error('Error al obtener datos:', error);
        mostrarToast('error', 'Error al obtener datos del servidor');
      } finally {
        setCargando(false);
      }
    };

    if (socio?.id_socio) fetchDatos();
    setSeleccionados([]); // limpiar selección al cambiar año
  }, [socio, anioTrabajo]);

  // ---- Helpers de selección ----
  const filtrarPeriodosPorIngreso = () => {
    if (!fechaIngreso) return periodos;

    const fecha = new Date(fechaIngreso);
    const mesIngreso = fecha.getMonth() + 1;
    const anioIngreso = fecha.getFullYear();

    return periodos.filter((p) => {
      if (p.id === ID_CONTADO_ANUAL) return true; // (visibilidad se controla más abajo)
      const primerMes = obtenerPrimerMesDesdeNombre(p.nombre);
      return (anioIngreso < anioTrabajo) || (anioIngreso === anioTrabajo && primerMes >= mesIngreso);
    });
  };

  // Base: según ingreso
  const periodosBase = filtrarPeriodosPorIngreso();

  // Visibilidad de ANUAL según ventana actual (computadora)
  const ventanaFlag = ventanaAnualActiva();
  const periodosDisponibles = useMemo(() => {
    return periodosBase.filter(p => {
      if (p.id === ID_CONTADO_ANUAL) return ventanaFlag; // solo visible en ventana
      return true;
    });
  }, [periodosBase, ventanaFlag]);

  const seleccionIncluyeAnual = seleccionados.includes(ID_CONTADO_ANUAL);
  const idsBimestralesDisponibles = periodosDisponibles
    .filter(p => p.id !== ID_CONTADO_ANUAL && !periodosPagados.includes(p.id))
    .map(p => p.id);

  useEffect(() => {
    const todos = idsBimestralesDisponibles.length > 0 &&
                  idsBimestralesDisponibles.every(id => seleccionados.includes(id));
    setTodosSeleccionados(todos);
  }, [seleccionados, idsBimestralesDisponibles]);

  const togglePeriodo = async (id) => {
    if (id === ID_CONTADO_ANUAL) {
      if (!ventanaFlag) return;
      await refrescarMontosActuales();
      setSeleccionados((prev) => {
        const ya = prev.includes(ID_CONTADO_ANUAL);
        return ya ? [] : [ID_CONTADO_ANUAL];
      });
      return;
    }

    setSeleccionados((prev) => {
      const base = prev.filter(pid => pid !== ID_CONTADO_ANUAL);
      const ya = base.includes(id);
      let next = ya ? base.filter(pid => pid !== id) : [...base, id];

      if (ventanaFlag) {
        const faltan = idsBimestralesDisponibles.filter(x => !next.includes(x));
        const hayAnualVisible = periodosDisponibles.some(p => p.id === ID_CONTADO_ANUAL);
        if (faltan.length === 0 && hayAnualVisible) {
          refrescarMontosActuales();
          return [ID_CONTADO_ANUAL];
        }
      }

      return next;
    });
  };

  const toggleSeleccionarTodos = async () => {
    const hayAnualVisible = periodosDisponibles.some(p => p.id === ID_CONTADO_ANUAL);

    if (todosSeleccionados) {
      setSeleccionados((prev) => prev.filter(id => !idsBimestralesDisponibles.includes(id)));
    } else {
      if (ventanaFlag && hayAnualVisible) {
        await refrescarMontosActuales();
        setSeleccionados([ID_CONTADO_ANUAL]);
        return;
      }
      setSeleccionados((prev) => {
        const sinAnual = prev.filter(id => id !== ID_CONTADO_ANUAL);
        const union = new Set([...sinAnual, ...idsBimestralesDisponibles]);
        return Array.from(union);
      });
    }
  };

  // ======= PRECIO / TOTAL =======
  const seleccionSinAnual = useMemo(
    () => seleccionados.filter(id => id !== ID_CONTADO_ANUAL),
    [seleccionados]
  );

  const aplicaAnualPorSeleccion =
    ventanaFlag && (seleccionIncluyeAnual || seleccionSinAnual.length === MESES_ANIO);

  const total = useMemo(() => {
    if (condonar) return 0;
    if (aplicaAnualPorSeleccion) return Number(montoAnual) || 0;
    const cantBimestres = seleccionSinAnual.length;
    return cantBimestres * (Number(montoMensual) || 0);
  }, [condonar, aplicaAnualPorSeleccion, montoAnual, montoMensual, seleccionSinAnual.length]);

  // Texto de períodos para el comprobante
  const periodoTextoFinal = useMemo(() => {
    if (aplicaAnualPorSeleccion) return `CONTADO ANUAL ${anioTrabajo}`;

    if (seleccionSinAnual.length === 0) return '';
    const partes = seleccionSinAnual
      .map(id => {
        const p = periodos.find(pp => pp.id === id);
        if (!p) return String(id);
        return p.nombre.replace(/^\s*per[ií]odo?s?\s*:?\s*/i, '').trim();
      });
    return `${partes.join(' / ')} ${anioTrabajo}`;
  }, [aplicaAnualPorSeleccion, seleccionSinAnual, periodos, anioTrabajo]);

  // ======= CONFIRMAR / ÉXITO =======
  const confirmar = async () => {
    if (seleccionados.length === 0) {
      mostrarToast('advertencia', 'Seleccioná al menos un período');
      return;
    }

    if (aplicaAnualPorSeleccion) {
      await refrescarMontosActuales();
    }

    setCargando(true);
    try {
      const res = await fetch(`${BASE_URL}/api.php?action=registrar_pago`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_socio: socio.id_socio,
          periodos: seleccionados,
          condonar: condonar,
          anio: anioTrabajo,
        })
      });

      const data = await res.json();

      if (data.exito) {
        setPagoExitoso(true);
      } else {
        if (Array.isArray(data.ya_registrados) && data.ya_registrados.length > 0) {
          const detalles = data.ya_registrados
            .map(it => `${it.periodo} (${String(it.estado).toUpperCase()})`)
            .join(', ');
          mostrarToast('advertencia', `Ya registrados: ${detalles}`);
        } else {
          mostrarToast('error', 'Error: ' + (data.mensaje || 'No se pudo registrar'));
        }
      }
    } catch (error) {
      console.error('Error al registrar:', error);
      mostrarToast('error', 'Error de conexión');
    } finally {
      setCargando(false);
    }
  };

  // ======= COMPROBANTE / IMPRESIÓN =======
  const handleImprimirComprobante = async () => {
    const esAnualSeleccion = aplicaAnualPorSeleccion;
    if (esAnualSeleccion) {
      await refrescarMontosActuales();
    }

    const periodoCodigo = esAnualSeleccion ? ID_CONTADO_ANUAL : (seleccionSinAnual[0] || 0);

    const importe =
      condonar
        ? 0
        : (esAnualSeleccion
            ? (Number(montoAnual) || 0)
            : (Number(montoMensual) || 0) * seleccionSinAnual.length);

    const socioParaImprimir = {
      ...socio,
      id_periodo: periodoCodigo,
      periodo_texto: esAnualSeleccion
        ? `CONTADO ANUAL ${anioTrabajo}`
        : (periodoTextoFinal || ''),
      importe_total: importe,
      anio: anioTrabajo,
    };

    const win = window.open('', '_blank');
    if (!win) return alert('Habilitá ventanas emergentes para imprimir el comprobante.');
    await imprimirRecibosUnicos([socioParaImprimir], periodoCodigo, win);
  };

  const formatearFecha = (fechaStr) => {
    const fecha = new Date(fechaStr);
    const dia = String(fecha.getDate()).padStart(2, '0');
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const anio = fecha.getFullYear();
    return `${dia}/${mes}/${anio}`;
  };

  const formatearARS = (monto) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(monto);

  if (!socio) return null;

  // ======= VISTA DE ÉXITO =======
  if (pagoExitoso) {
    const tituloExito = condonar ? '¡Condonación registrada con éxito!' : '¡Pago realizado con éxito!';
    const subExito = 'Podés generar el comprobante ahora mismo.';

    return (
      <>
        {toast && (
          <Toast
            tipo={toast.tipo}
            mensaje={toast.mensaje}
            duracion={toast.duracion}
            onClose={() => setToast(null)}
          />
        )}

        <div className="modal-pagos-overlay">
          <div className="modal-pagos-contenido">
            <div className="modal-header">
              <div className="modal-header-content">
                <div className="modal-icon-circle">
                  <FaCoins size={20} />
                </div>
                <h2 className="modal-title">Registro de Pagos</h2>
              </div>
              <button className="modal-close-btn" onClick={() => onClose(true)} disabled={cargando}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>

            <div className="modal-body">
              <div className="success-card">
                <h3 className="success-title">{tituloExito}</h3>
                <p className="success-sub">{subExito}</p>
              </div>
            </div>

            <div className="modal-footer">
              <div className="footer-left">
                <span className={`total-badge ${condonar ? 'total-badge-warning' : ''}`}>
                  Total: {formatearARS(total)}
                </span>
              </div>
              <div className="footer-actions">
                <button className="btn btn-secondary" onClick={() => onClose(true)}>
                  Cerrar
                </button>
                <button className="btn btn-primary" onClick={handleImprimirComprobante}>
                  Imprimir
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ======= VISTA NORMAL =======
  const cantidadSeleccionados = seleccionados.length;

  return (
    <>
      {toast && (
        <Toast
          tipo={toast.tipo}
          mensaje={toast.mensaje}
          duracion={toast.duracion}
          onClose={() => setToast(null)}
        />
      )}

      <div className="modal-pagos-overlay">
        <div className="modal-pagos-contenido">
          <div className="modal-header">
            <div className="modal-header-content">
              <div className="modal-icon-circle">
                <FaCoins size={20} />
              </div>
              <h2 className="modal-title">Registro de Pagos / Condonar</h2>
            </div>
            <button className="modal-close-btn" onClick={() => onClose(false)} disabled={cargando}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>

          <div className="modal-body">
            <div className="socio-info-card">
              <div className="socio-info-header">
                <h3 className="socio-nombre">{`${socio.id_socio} - ${socio.nombre}`}</h3>
                {fechaIngreso && (
                  <div className="socio-fecha">
                    <span className="fecha-label">Ingreso:</span>
                    <span className="fecha-valor">{formatearFecha(fechaIngreso)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Caja condonar + selector de AÑO */}
            <div className={`condonar-box ${condonar ? 'is-active' : ''}`}>
              <label className="condonar-check">
                <input
                  type="checkbox"
                  checked={condonar}
                  onChange={(e) => setCondonar(e.target.checked)}
                  disabled={cargando}
                />
                <span className="switch">
                  <span className="switch-thumb" />
                </span>
                <span className="switch-label">
                  Marcar como <strong>Condonado</strong> (no genera cobro)
                </span>
              </label>

              <div className="year-picker">
                <button
                  type="button"
                  className="year-button"
                  onClick={() => setShowYearPicker((s) => !s)}
                  disabled={cargando}
                  title="Cambiar año"
                >
                  <FaCalendarAlt />
                  <span>{anioTrabajo}</span>
                </button>

                {showYearPicker && (
                  <div className="year-popover" onMouseLeave={() => setShowYearPicker(false)}>
                    {yearOptions.map((y) => (
                      <button
                        key={y}
                        className={`year-item ${y === anioTrabajo ? 'active' : ''}`}
                        onClick={() => {
                          setAnioTrabajo(y);
                          setShowYearPicker(false);
                        }}
                      >
                        {y}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="periodos-section">
              <div className="section-header">
                <h4 className="section-title">Períodos Disponibles</h4>
                <div className="section-header-actions">
                  <button
                    className="btn btn-small btn-terciario"
                    onClick={toggleSeleccionarTodos}
                    disabled={cargando || idsBimestralesDisponibles.length === 0}
                  >
                    {todosSeleccionados ? 'Deseleccionar todos' : 'Seleccionar todos'} ({cantidadSeleccionados})
                  </button>
                </div>
              </div>

              {cargando && periodos.length === 0 ? (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <span>Cargando períodos...</span>
                </div>
              ) : (
                <>
                  <div className="periodos-grid-container">
                    <div className="periodos-grid">
                      {periodosDisponibles.map((periodo) => {
                        const estadoExacto = estadosPorPeriodo[periodo.id];  // 'pagado' | 'condonado' | undefined
                        const yaMarcado = !!estadoExacto;
                        const checked = seleccionados.includes(periodo.id);
                        const disabled = yaMarcado || cargando;

                        const etiquetaEstado =
                          estadoExacto === 'condonado'
                            ? 'Condonado'
                            : (estadoExacto === 'pagado' ? 'Pagado' : '');

                        return (
                          <div
                            key={periodo.id}
                            className={`periodo-card ${yaMarcado ? 'pagado' : ''} ${checked ? 'seleccionado' : ''}`}
                            onClick={() => !disabled && togglePeriodo(periodo.id)}
                          >
                            <div className="periodo-checkbox">
                              <input
                                type="checkbox"
                                id={`periodo-${periodo.id}`}
                                checked={checked}
                                // Evitar doble toggle desde checkbox
                                onClick={(e) => { e.stopPropagation(); togglePeriodo(periodo.id); }}
                                onChange={() => {}}
                                disabled={disabled}
                              />
                              <span className="checkmark"></span>
                            </div>
                            <div className="periodo-label">
                              {periodo.nombre}
                              {yaMarcado && (
                                <span className={`periodo-status ${estadoExacto === 'condonado' ? 'status-condonado' : 'status-pagado'}`}>
                                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                                    <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                  {etiquetaEstado}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="modal-footer">
            <div className="footer-left">
              <span className={`total-badge ${condonar ? 'total-badge-warning' : ''}`}>
                Total: {formatearARS(total)}
              </span>
            </div>

            <div className="footer-actions">
              <button
                className="btn btn-secondary"
                onClick={() => onClose(false)}
                disabled={cargando}
              >
                Cancelar
              </button>
              <button
                className={`btn ${condonar ? 'btn-warning' : 'btn-primary'}`}
                onClick={confirmar}
                disabled={seleccionados.length === 0 || cargando}
              >
                {cargando ? (
                  <>
                    <span className="spinner-btn"></span> Procesando...
                  </>
                ) : (
                  condonar ? 'Condonar' : 'Pagar'
                )}
              </button>
              {/* Botón Imprimir removido de la vista normal */}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ModalPagos;
