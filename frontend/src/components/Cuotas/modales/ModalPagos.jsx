// src/components/Cuotas/modales/ModalPagos.jsx
import React, { useEffect, useState, useMemo } from 'react';
import { FaCoins, FaCalendarAlt } from 'react-icons/fa';
import BASE_URL from '../../../config/config';
import Toast from '../../Global/Toast';
import './ModalPagos.css';
import { imprimirRecibosUnicos } from '../../../utils/Recibosunicos';
import { generarReciboPDFUnico } from '../../../utils/ReciboPDF';

// ======= CONSTANTES LÓGICAS (no montos) =======
const MESES_ANIO = 6;     // cantidad de bimestres que equivale a "anual"
const ID_CONTADO_ANUAL = 7;
const MIN_YEAR = 2025;    // primer año visible en el selector

// URL de la CABECERA para el PDF
const HEADER_IMG_URL = `${BASE_URL}/assets/cabecera_rh.png`;

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
  const startActual = new Date(y, 11, 15);
  const endSiguiente = new Date(y + 1, 2, 1);
  if (hoy >= startActual && hoy < endSiguiente) return true;

  const startPrev = new Date(y - 1, 11, 15);
  const endActual = new Date(y, 2, 1);
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
  const [montosListos, setMontosListos] = useState(false);

  // condonar
  const [condonar, setCondonar] = useState(false);

  // Medios de pago desde la lista global (TRANSFERENCIA/EFECTIVO)
  const [mediosPago, setMediosPago] = useState([]);
  const [medioPagoSeleccionado, setMedioPagoSeleccionado] = useState('');

  // Año de trabajo + selector
  const [anioTrabajo, setAnioTrabajo] = useState(Math.max(nowYear, MIN_YEAR));
  const [showYearPicker, setShowYearPicker] = useState(false);
  const yearOptions = useMemo(() => construirListaAnios(nowYear), [nowYear]);

  // Nuevo: modo de salida en la vista de éxito
  const [modoSalida, setModoSalida] = useState('imprimir'); // 'imprimir' | 'pdf'

  // NUEVO: modal de confirmación
  const [showConfirm, setShowConfirm] = useState(false);

  // Determinar si el socio tiene cobrador = "oficina"
  const esOficina = useMemo(() => {
    const cobrador = socio?.cobrador || socio?.medio_pago || '';
    return String(cobrador).toLowerCase() === 'oficina';
  }, [socio]);

  const mostrarToast = (tipo, mensaje, duracion = 3000) => {
    setToast({ tipo, mensaje, duracion });
  };

  // ===== Cargar medios de pago desde la lista global =====
  useEffect(() => {
    const fetchMediosPago = async () => {
      try {
        const res = await fetch(`${BASE_URL}/api.php?action=listas`);
        const data = await res.json();
        if (data?.exito && data?.listas?.medios_pago) {
          const medios = data.listas.medios_pago.map(m => m.nombre);
          setMediosPago(medios);
          setMedioPagoSeleccionado('');
        } else if (data?.exito && data?.listas?.cobradores) {
          const medios = data.listas.cobradores.map(c => c.nombre);
          setMediosPago(medios);
          setMedioPagoSeleccionado('');
        }
      } catch (error) {
        console.error('Error al cargar medios de pago:', error);
      }
    };

    if (esOficina) {
      fetchMediosPago();
      setMedioPagoSeleccionado('');
    }
  }, [esOficina]);

  // ===== helpers para (re)consultar montos exactos al instante =====
  const buildMontosQS = () => {
    const qs = new URLSearchParams();
    if (socio?.id_cat_monto) qs.set('id_cat_monto', String(socio.id_cat_monto));
    if (socio?.id_socio)     qs.set('id_socio',     String(socio.id_socio));
    return qs.toString();
  };

  const refrescarMontosActuales = async () => {
    try {
      setMontosListos(false);
      const res = await fetch(`${BASE_URL}/api.php?action=montos&${buildMontosQS()}`);
      const data = await res.json();
      if (data?.exito) {
        setMontoMensual(Number(data.mensual) || 0);
        setMontoAnual(Number(data.anual) || 0);
        setMontosListos(true);
      } else {
        setMontosListos(false);
        mostrarToast('advertencia', data?.mensaje || 'No se pudieron obtener los montos actualizados.');
      }
    } catch {
      setMontosListos(false);
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
  // *** CORREGIDO: ahora incluye el bimestre en el que entra el socio (7-8 si entra en mes 8) ***
  const filtrarPeriodosPorIngreso = () => {
    if (!fechaIngreso) return periodos;

    const fecha = new Date(fechaIngreso);
    const mesIngreso = fecha.getMonth() + 1;       // 1..12
    const anioIngreso = fecha.getFullYear();

    return periodos.filter((p) => {
      if (p.id === ID_CONTADO_ANUAL) return true;  // el anual se controla aparte

      const primerMes = obtenerPrimerMesDesdeNombre(p.nombre); // 1,3,5,7,9,11
      const segundoMes = primerMes + 1;                         // 2,4,6,8,10,12

      // Si el año de trabajo es posterior al año de ingreso → mostrar todos
      if (anioIngreso < anioTrabajo) return true;
      // Si es anterior, no debería ocurrir, pero por las dudas:
      if (anioIngreso > anioTrabajo) return false;

      // Mismo año: mostrar períodos cuyo rango [primerMes, segundoMes]
      // incluya el mes de ingreso o sean posteriores.
      // Ej: ingreso mes 8 → se muestran 7-8, 9-10, 11-12.
      return mesIngreso <= segundoMes;
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

  // ===== Helpers comunes para comprobante =====
  const buildSocioParaComprobante = (esAnualSeleccion) => {
    const periodoCodigo = esAnualSeleccion ? ID_CONTADO_ANUAL : (seleccionSinAnual[0] || 0);
    const importe =
      condonar
        ? 0
        : (esAnualSeleccion
            ? (Number(montoAnual) || 0)
            : (Number(montoMensual) || 0) * seleccionSinAnual.length);

    return {
      ...socio,
      id_periodo: periodoCodigo,
      periodo_texto: esAnualSeleccion
        ? `CONTADO ANUAL ${anioTrabajo}`
        : (periodoTextoFinal || ''),
      importe_total: importe,
      anio: anioTrabajo,
      medio_pago: esOficina ? medioPagoSeleccionado : socio.medio_pago || socio.cobrador,
    };
  };

  // ======= CONFIRMAR / ÉXITO =======
  const confirmar = async () => {
    if (seleccionados.length === 0) {
      mostrarToast('advertencia', 'Seleccioná al menos un período');
      return;
    }

    if (esOficina && !medioPagoSeleccionado) {
      mostrarToast('advertencia', 'Debés seleccionar un medio de pago');
      return;
    }

    if (aplicaAnualPorSeleccion) {
      await refrescarMontosActuales();
    }

    const montosValidos = aplicaAnualPorSeleccion
      ? Number(montoAnual) > 0
      : Number(montoMensual) > 0;

    if (!condonar && (!montosListos || !montosValidos)) {
      mostrarToast('advertencia', 'El monto aún no está listo. Esperá un segundo e intentá de nuevo.');
      return;
    }
    if (!condonar && (!total || Number(total) <= 0)) {
      mostrarToast('advertencia', 'El total calculado es inválido.');
      return;
    }

    setCargando(true);
    try {
      const esAnual = aplicaAnualPorSeleccion;
      const payload = {
        id_socio: socio.id_socio,
        periodos: seleccionados,
        condonar,
        anio: anioTrabajo,
        monto: Number(total) || 0,
        monto_por_periodo: esAnual ? 0 : (Number(montoMensual) || 0),
        medio_pago: esOficina ? medioPagoSeleccionado : socio.medio_pago || socio.cobrador,
      };

      const res = await fetch(`${BASE_URL}/api.php?action=registrar_pago`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (data.exito) {
        setPagoExitoso(true);
      } else {
        if (Array.isArray(data.ya_registrados) && data.ya_registrados.length > 0) {
          const detalles = data.ya_registrados
            .map(it => `${it.periodo ?? it} (${String(it.estado || 'ya existe').toUpperCase()})`)
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

  // ======= COMPROBANTE / IMPRESIÓN o PDF =======
  const handleImprimirComprobante = async () => {
    const esAnualSeleccion = aplicaAnualPorSeleccion;
    if (esAnualSeleccion) await refrescarMontosActuales();

    const socioParaImprimir = buildSocioParaComprobante(esAnualSeleccion);
    const periodoCodigo = socioParaImprimir.id_periodo;

    const win = window.open('', '_blank');
    if (!win) return alert('Habilitá ventanas emergentes para imprimir el comprobante.');
    await imprimirRecibosUnicos([socioParaImprimir], periodoCodigo, win);
  };

  const handleGenerarPDFComprobante = async () => {
    const esAnualSeleccion = aplicaAnualPorSeleccion;
    if (esAnualSeleccion) await refrescarMontosActuales();

    const socioParaImprimir = buildSocioParaComprobante(esAnualSeleccion);
    const periodoCodigo = socioParaImprimir.id_periodo;

    await generarReciboPDFUnico({
      listaSocios: [socioParaImprimir],
      periodoActual: periodoCodigo,
      anioSeleccionado: anioTrabajo,
      headerImageUrl: HEADER_IMG_URL,
      nombreArchivo: `Comprobante_${socio.id_socio}_${anioTrabajo}.pdf`,
      baseUrl: BASE_URL
    });
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
    const subExito = 'Elegí cómo querés obtener el comprobante.';

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

                <div className="output-mode">
                  <label className={`mode-option ${modoSalida === 'imprimir' ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="modoSalida"
                      value="imprimir"
                      checked={modoSalida === 'imprimir'}
                      onChange={() => setModoSalida('imprimir')}
                    />
                    <span className="mode-bullet" />
                    <span>Imprimir</span>
                  </label>

                  <label className={`mode-option ${modoSalida === 'pdf' ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="modoSalida"
                      value="pdf"
                      checked={modoSalida === 'pdf'}
                      onChange={() => setModoSalida('pdf')}
                    />
                    <span className="mode-bullet" />
                    <span>PDF</span>
                  </label>
                </div>
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

                {modoSalida === 'imprimir' ? (
                  <button className="btn btn-primary" onClick={handleImprimirComprobante}>
                    Imprimir
                  </button>
                ) : (
                  <button className="btn btn-primary" onClick={handleGenerarPDFComprobante}>
                    Descargar PDF
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ======= VISTA NORMAL =======
  const cantidadSeleccionados = seleccionados.length;

  const bloquearPorMontos =
    !condonar && (
      !montosListos ||
      (aplicaAnualPorSeleccion ? Number(montoAnual) <= 0 : Number(montoMensual) <= 0)
    );

  const deshabilitarConfirmar = 
    seleccionados.length === 0 || 
    cargando || 
    bloquearPorMontos ||
    (esOficina && !medioPagoSeleccionado);

  const handleAbrirConfirmacion = () => {
    if (deshabilitarConfirmar) return;
    setShowConfirm(true);
  };

  const handleConfirmarDesdeModal = () => {
    setShowConfirm(false);
    confirmar();
  };

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

            {esOficina && (
              <div className="medio-pago-section">
                <div className="section-header">
                  <h4 className="section-title">Medio de Pago*</h4>
                  <span className="required-badge">Requerido</span>
                </div>
                <div className="medio-pago-selector">
                  <select
                    value={medioPagoSeleccionado}
                    onChange={(e) => setMedioPagoSeleccionado(e.target.value)}
                    className="medio-pago-select"
                    disabled={cargando}
                    required
                  >
                    <option value="">Seleccionar medio de pago</option>
                    {mediosPago.map((medio, index) => (
                      <option key={index} value={medio}>
                        {medio}
                      </option>
                    ))}
                  </select>
                  <div className="medio-pago-hint">
                    Campo obligatorio para registrar el pago
                  </div>
                </div>
              </div>
            )}

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
                        const estadoExacto = estadosPorPeriodo[periodo.id];
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
              {esOficina && medioPagoSeleccionado && (
                <span className="medio-pago-badge">
                  Medio: {medioPagoSeleccionado}
                </span>
              )}
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
                className={`btn ${condonar ? 'btn-warnings' : 'btn-primary'}`}
                onClick={handleAbrirConfirmacion}
                disabled={deshabilitarConfirmar}
                title={deshabilitarConfirmar ? 
                  (esOficina && !medioPagoSeleccionado ? 'Seleccioná un medio de pago' : 
                   bloquearPorMontos ? 'Cargando montos…' : 
                   'Seleccioná al menos un período') : undefined}
              >
                {cargando ? (
                  <>
                    <span className="spinner-btn"></span> Procesando...
                  </>
                ) : (
                  condonar ? 'Condonar' : 'Pagar'
                )}
              </button>
            </div>
          </div>
        </div>

        {showConfirm && (
          <div className="confirm-pago-overlay">
            <div className="confirm-pago-card">
              <h3 className="confirm-pago-title">
                {condonar ? 'Confirmar condonación' : 'Confirmar pago'}
              </h3>

              <p className="confirm-pago-text">
                Estás a punto de {condonar ? 'registrar la condonación' : 'registrar el pago'} para:
              </p>

              <div className="confirm-pago-resumen">
                <div className="confirm-pago-row">
                  <span className="confirm-pago-label">Socio:</span>
                  <span className="confirm-pago-value">
                    {socio.id_socio} - {socio.nombre}
                  </span>
                </div>

                {periodoTextoFinal && (
                  <div className="confirm-pago-row">
                    <span className="confirm-pago-label">Período/s:</span>
                    <span className="confirm-pago-value">{periodoTextoFinal}</span>
                  </div>
                )}

                {esOficina && medioPagoSeleccionado && (
                  <div className="confirm-pago-row">
                    <span className="confirm-pago-label">Medio de pago:</span>
                    <span className="confirm-pago-value">{medioPagoSeleccionado}</span>
                  </div>
                )}

                <div className="confirm-pago-row total">
                  <span className="confirm-pago-label">Total:</span>
                  <span className="confirm-pago-value">
                    {condonar ? 'Condonado (sin cobro)' : formatearARS(total)}
                  </span>
                </div>
              </div>

              <p className="confirm-pago-warning">
                {condonar
                  ? 'Esta acción registrará la deuda como condonada.'
                  : 'Al confirmar, se registrará el pago de forma definitiva.'}
              </p>

              <div className="confirm-pago-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowConfirm(false)}
                  disabled={cargando}
                >
                  Revisar
                </button>
                <button
                  type="button"
                  className={`btn ${condonar ? 'btn-warnings' : 'btn-primary'}`}
                  onClick={handleConfirmarDesdeModal}
                  disabled={cargando}
                >
                  {cargando ? 'Procesando…' : (condonar ? 'Confirmar condonación' : 'Confirmar pago')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default ModalPagos;
