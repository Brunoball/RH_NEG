import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FaExclamationTriangle,
  FaFileImport,
  FaSearch,
  FaTimes,
  FaUserPlus,
  FaUserMinus,
  FaFileExcel,
  FaInfoCircle,
} from 'react-icons/fa';
import * as XLSX from 'xlsx';
import BASE_URL from '../../../config/config';
import './ModalBalanceAnual.css';

const obtenerFechaLocalISO = (fecha) => {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
};

const obtenerRangoBalancePorDefecto = () => {
  const hoy = new Date();
  const anioActual = hoy.getFullYear();
  const mesActual = hoy.getMonth() + 1;

  if (mesActual <= 6) {
    return {
      desde: `${anioActual - 1}-07-01`,
      hasta: `${anioActual}-06-30`,
    };
  }

  return {
    desde: `${anioActual}-07-01`,
    hasta: obtenerFechaLocalISO(hoy),
  };
};

const LIMITE_REGISTROS_DETALLE = 100;

const PERIODOS_MAP = {
  1: '1 Y 2',
  2: '3 Y 4',
  3: '5 Y 6',
  4: '7 Y 8',
  5: '9 Y 10',
  6: '11 Y 12',
  7: 'CONTADO ANUAL',
};

const formatearDinero = (valor) => {
  const n = Number(valor || 0);
  return n.toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
};

const formatearFecha = (fecha) => {
  if (!fecha) return '-';
  const partes = String(fecha).split('-');
  if (partes.length !== 3) return fecha;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
};

const obtenerRangoTexto = (desde, hasta) => {
  if (!desde || !hasta) return 'Seleccioná un rango de fechas';
  return `Del ${formatearFecha(desde)} al ${formatearFecha(hasta)}`;
};

const normalizarTexto = (valor) => {
  return String(valor || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
};

const quitarPalabraPeriodo = (texto) => {
  return String(texto || '')
    .replace(/\bPERÍODO\b\s*/gi, '')
    .replace(/\bPERIODO\b\s*/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*\/\s*/g, ' / ')
    .trim();
};

const limpiarNombreArchivo = (texto) => {
  return String(texto || '')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '_')
    .trim();
};

const obtenerPeriodoPagoTexto = (pago) => {
  const anio = pago.anio_aplicado || pago.anio || '';

  let idPeriodo =
    pago.id_periodo ||
    pago.idPeriodo ||
    pago.periodo_id ||
    pago.periodo ||
    null;

  idPeriodo = Number(idPeriodo);

  let nombrePeriodo = '';

  if (PERIODOS_MAP[idPeriodo]) {
    nombrePeriodo = PERIODOS_MAP[idPeriodo];
  } else if (pago.periodo_nombre) {
    nombrePeriodo = pago.periodo_nombre;
  } else if (pago.periodo_label) {
    nombrePeriodo = String(pago.periodo_label)
      .replace(/\s*\/\s*\d{4}/g, '')
      .trim();
  } else {
    nombrePeriodo = '-';
  }

  const periodoLimpio = quitarPalabraPeriodo(nombrePeriodo);

  return anio ? `${periodoLimpio} / ${anio}` : periodoLimpio;
};

const obtenerMontoAdeudado = (item) => {
  return Number(
    item?.monto_adeudado ||
      item?.monto_periodo ||
      item?.monto_estimado ||
      0
  );
};

const obtenerTotalAdeudado = (obj) => {
  return Number(
    obj?.monto_total_adeudado ||
      obj?.monto_adeudado_total ||
      obj?.monto_total_estimado ||
      obj?.monto_total ||
      obj?.monto_adeudado ||
      0
  );
};

const obtenerTotalPagadoPeriodo = (periodo) => {
  return Number(
    periodo?.monto_pagado_total ||
      periodo?.monto_total_pagado ||
      periodo?.monto_total ||
      0
  );
};

/* ─── Celda de motivo (tabla / desktop) ─── */
const MotivoCeldaTabla = ({ motivo, onClick }) => {
  const textRef = useRef(null);
  const [truncado, setTruncado] = useState(false);

  const chequearTruncado = () => {
    const el = textRef.current;
    if (!el) return;
    setTruncado(el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight);
  };

  useEffect(() => {
    chequearTruncado();
  }, [motivo]);

  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    let ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(chequearTruncado);
      ro.observe(el);
    }
    const t = setTimeout(chequearTruncado, 0);
    window.addEventListener('resize', chequearTruncado);
    window.addEventListener('orientationchange', chequearTruncado);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', chequearTruncado);
      window.removeEventListener('orientationchange', chequearTruncado);
      clearTimeout(t);
    };
  }, []);

  return (
    <div className="mba-motivo-celda" title={motivo || 'Sin motivo'}>
      <span ref={textRef} className="mba-motivo-texto">
        {motivo || '-'}
      </span>
      {truncado && (
        <button
          type="button"
          className="mba-motivo-btn-ver"
          onClick={onClick}
        >
        <FaInfoCircle className="soc-icono-info-motivo" />
        </button>
      )}
    </div>
  );
};

/* ─── Celda de motivo (mobile / ancho fijo) ─── */
const MotivoCeldaMobile = ({ motivo, onShow }) => {
  const ref = useRef(null);
  const [desborda, setDesborda] = useState(false);

  useEffect(() => {
    const check = () => {
      const el = ref.current;
      if (!el) return;
      setDesborda(el.scrollWidth > el.clientWidth);
    };
    check();
    const ro =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(check) : null;
    if (ro && ref.current) ro.observe(ref.current);
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, [motivo]);

  return (
    <div className="mba-motivo-mobile-wrap">
      <span ref={ref} className="mba-motivo-mobile" title={motivo || 'Sin motivo'}>
        {motivo || '-'}
      </span>
      {desborda && (
        <button type="button" className="mba-motivo-btn-ver" onClick={onShow}>
          Ver todo
        </button>
      )}
    </div>
  );
};

/* ─── Subcomponentes de filas ─── */

const FilaInscripcion = ({ item, obtenerFechasPago, obtenerMediosPago }) => (
  <div className="mba-drow mba-drow--inscripciones">
    <div className="mba-dcell">{item.id_socio}</div>
    <div className="mba-dcell mba-dcell--nombre">{item.nombre}</div>
    <div className="mba-dcell">{item.dni || '-'}</div>
    <div className="mba-dcell">
      <span className={`mba-badge ${item.estado_descripcion?.toLowerCase().includes('activ') ? 'mba-badge--ok' : item.estado_descripcion?.toLowerCase().includes('pasiv') ? 'mba-badge--warn' : 'mba-badge--neu'}`}>
        {item.estado_descripcion || item.grupo_label || '-'}
      </span>
    </div>
    <div className="mba-dcell">{formatearFecha(item.fecha_alta || item.ingreso)}</div>
    <div className="mba-dcell">{quitarPalabraPeriodo(item.periodo_label || item.periodo_balance || '-')}</div>
    <div className="mba-dcell">{obtenerFechasPago(item)}</div>
    <div className="mba-dcell">{obtenerMediosPago(item)}</div>
  </div>
);

const FilaBaja = ({ item, onVerMotivo }) => {
  const pagos = item.pagos || [];
  return (
    <div className="mba-drow mba-drow--bajas">
      <div className="mba-dcell">{item.id_socio}</div>
      <div className="mba-dcell mba-dcell--nombre">{item.nombre}</div>
      <div className="mba-dcell">
        <span className={`mba-badge ${item.estado_descripcion?.toLowerCase().includes('activ') ? 'mba-badge--ok' : 'mba-badge--warn'}`}>
          {item.estado_descripcion || item.grupo_label}
        </span>
      </div>
      <div className="mba-dcell">{formatearFecha(item.fecha_baja)}</div>
      <div className="mba-dcell">{quitarPalabraPeriodo(item.periodo_label || item.periodo || '-')}</div>
      <div className="mba-dcell mba-dcell--pagos">
        {pagos.length > 0 ? (
          pagos.map((pago) => {
            const esCondonacion = String(pago.estado || '').toLowerCase() === 'condonado';
            return (
              <div key={`${item.id_socio}-${pago.id_pago}`} className="mba-pago-item">
                <strong>{obtenerPeriodoPagoTexto(pago)}{esCondonacion ? ' · CONDONADO' : ''}</strong>
                <span>{esCondonacion ? 'SIN COBRO' : formatearDinero(pago.monto)}</span>
              </div>
            );
          })
        ) : (
          <span className="mba-dcell--vacio">-</span>
        )}
      </div>
      <div className="mba-dcell">{formatearDinero(item.pagos_monto_total || 0)}</div>
      <div className="mba-dcell mba-dcell--motivo">
        <MotivoCeldaTabla
          motivo={item.motivo}
          onClick={() => onVerMotivo(item.motivo)}
        />
      </div>
    </div>
  );
};

const FilaDeudor = ({ item }) => (
  <div className="mba-drow mba-drow--deudores">
    <div className="mba-dcell">{quitarPalabraPeriodo(item.periodo_label || '-')}</div>
    <div className="mba-dcell">{item.id_socio}</div>
    <div className="mba-dcell mba-dcell--nombre">{item.nombre}</div>
    <div className="mba-dcell">{item.dni || '-'}</div>
    <div className="mba-dcell">
      <span className={`mba-badge ${item.estado_descripcion?.toLowerCase().includes('activ') ? 'mba-badge--ok' : 'mba-badge--warn'}`}>
        {item.estado_descripcion || item.grupo_label || '-'}
      </span>
    </div>
    <div className="mba-dcell">{item.categoria_descripcion || item.cat_monto_nombre || '-'}</div>
    <div className="mba-dcell">{formatearFecha(item.ingreso)}</div>
    <div className="mba-dcell mba-dcell--wrap">{item.domicilio || '-'}</div>
    <div className="mba-dcell">{item.telefono_movil || item.telefono_fijo || '-'}</div>
    <div className="mba-dcell">{item.cobrador || '-'}</div>
    <div className="mba-dcell mba-dcell--monto">{formatearDinero(obtenerMontoAdeudado(item))}</div>
  </div>
);

/* ─── Componente principal ─── */

const ModalBalanceAnual = ({ onClose }) => {
  const rangoInicial = useMemo(() => obtenerRangoBalancePorDefecto(), []);

  const [fechaDesde, setFechaDesde] = useState(rangoInicial.desde);
  const [fechaHasta, setFechaHasta] = useState(rangoInicial.hasta);
  const [rangoAplicado, setRangoAplicado] = useState(null);

  const [balance, setBalance] = useState(null);
  const [inscripciones, setInscripciones] = useState(null);
  const [deudores, setDeudores] = useState(null);

  const [loading, setLoading] = useState(false);
  const [balanceCargado, setBalanceCargado] = useState(false);
  const [cargandoPestania, setCargandoPestania] = useState(false);

  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [pestaniaActiva, setPestaniaActiva] = useState('inscripciones');
  const [mostrarTodosRegistros, setMostrarTodosRegistros] = useState({
    inscripciones: false,
    bajas: false,
    deudores: false,
  });

  /* ─── Estado modal motivo ─── */
  const [motivoModal, setMotivoModal] = useState({ visible: false, texto: '' });

  const timeoutPestaniaRef = useRef(null);
  const fechaDesdeRef = useRef(null);
  const fechaHastaRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timeoutPestaniaRef.current) clearTimeout(timeoutPestaniaRef.current);
    };
  }, []);

  const abrirCalendario = (inputRef, deshabilitado = false) => {
    if (deshabilitado) return;
    const input = inputRef.current;
    if (!input) return;
    input.focus({ preventScroll: true });
    try {
      if (typeof input.showPicker === 'function') input.showPicker();
      else input.click();
    } catch {
      input.click();
    }
  };

  const resetMostrarTodosRegistros = () => {
    setMostrarTodosRegistros({
      inscripciones: false,
      bajas: false,
      deudores: false,
    });
  };

  const rangoTexto = useMemo(() => {
    const desde = rangoAplicado?.desde || fechaDesde;
    const hasta = rangoAplicado?.hasta || fechaHasta;
    return obtenerRangoTexto(desde, hasta);
  }, [rangoAplicado, fechaDesde, fechaHasta]);

  const cargarJson = async (url) => {
    const res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
    const data = await res.json();
    if (!res.ok || !data.exito) throw new Error(data.mensaje || 'No se pudo obtener la información.');
    return data;
  };

  const cargarBalance = async (e) => {
    if (e) e.preventDefault();

    if (!fechaDesde || !fechaHasta) {
      setError('Seleccioná la fecha desde y la fecha hasta para generar el balance.');
      return;
    }
    if (fechaDesde > fechaHasta) {
      setError('La fecha desde no puede ser mayor que la fecha hasta.');
      return;
    }

    setLoading(true);
    setError('');
    setCargandoPestania(false);

    try {
      const ts = Date.now();
      const desdeUrl = encodeURIComponent(fechaDesde);
      const hastaUrl = encodeURIComponent(fechaHasta);

      const [dataBajas, dataInscripciones, dataDeudores] = await Promise.all([
        cargarJson(`${BASE_URL}/api.php?action=balance_anual_preview&desde=${desdeUrl}&hasta=${hastaUrl}&ts=${ts}`),
        cargarJson(`${BASE_URL}/api.php?action=balance_anual_inscripciones&desde=${desdeUrl}&hasta=${hastaUrl}&ts=${ts}`),
        cargarJson(`${BASE_URL}/api.php?action=balance_anual_deudores&desde=${desdeUrl}&hasta=${hastaUrl}&ts=${ts}`),
      ]);

      setBalance(dataBajas);
      setInscripciones(dataInscripciones);
      setDeudores(dataDeudores);
      setRangoAplicado({ desde: fechaDesde, hasta: fechaHasta });
      setBalanceCargado(true);
      setBusqueda('');
      setPestaniaActiva('inscripciones');
      resetMostrarTodosRegistros();
    } catch (e) {
      setError(e.message || 'Error al cargar el balance.');
      setBalanceCargado(false);
    } finally {
      setLoading(false);
    }
  };

  const restaurarRangoPorDefecto = () => {
    const nuevoRango = obtenerRangoBalancePorDefecto();
    setFechaDesde(nuevoRango.desde);
    setFechaHasta(nuevoRango.hasta);
    setError('');
  };

  const cambiarPestania = (pestania) => {
    if (pestania === pestaniaActiva) return;
    if (timeoutPestaniaRef.current) clearTimeout(timeoutPestaniaRef.current);
    setBusqueda('');
    setMostrarTodosRegistros((prev) => ({ ...prev, [pestania]: false }));
    setPestaniaActiva(pestania);
    setCargandoPestania(true);
    timeoutPestaniaRef.current = setTimeout(() => setCargandoPestania(false), 260);
  };

  const obtenerTextoCargaPestania = () => {
    if (pestaniaActiva === 'inscripciones') return 'Cargando inscripciones del balance...';
    if (pestaniaActiva === 'bajas') return 'Cargando bajas del balance...';
    if (pestaniaActiva === 'deudores') return 'Cargando deudores por período...';
    return 'Cargando información...';
  };

  /* ─── Handler motivo ─── */
  const verMotivoCompleto = (motivo) => {
    setMotivoModal({ visible: true, texto: motivo || 'No hay motivo especificado.' });
  };

  const cerrarMotivoModal = () => {
    setMotivoModal({ visible: false, texto: '' });
  };

  /* ─── Datos derivados ─── */

  const totales = balance?.totales || {};
  const resumen = balance?.resumen || {};
  const items = balance?.items || [];

  const inscTotales = inscripciones?.totales || {};
  const inscPeriodos = inscripciones?.periodos || [];
  const inscItems = inscripciones?.items || [];

  const deudoresTotales = deudores?.totales || {};
  const deudoresPeriodos = deudores?.periodos || [];
  const deudoresItems = deudores?.items || [];

  const gruposResumen = useMemo(() => ([
    { key: 'pasivos',    titulo: 'Bajas pasivos',    cantidad: resumen?.pasivos?.cantidad || 0,    periodos: resumen?.pasivos?.periodos || [] },
    { key: 'activos',    titulo: 'Bajas activos',    cantidad: resumen?.activos?.cantidad || 0,    periodos: resumen?.activos?.periodos || [] },
    { key: 'sin_estado', titulo: 'Bajas sin estado', cantidad: resumen?.sin_estado?.cantidad || 0, periodos: resumen?.sin_estado?.periodos || [] },
  ]), [resumen]);

  /* ─── Filtros ─── */

  const itemsFiltrados = useMemo(() => {
    const q = normalizarTexto(busqueda);
    if (!q) return items;
    return items.filter((item) => {
      const pagosTexto = (item.pagos || [])
        .map((p) => [obtenerPeriodoPagoTexto(p), p.monto, p.periodo_label, p.periodo_nombre, p.periodo_meses].filter(Boolean).join(' '))
        .join(' ');
      const textoItem = [item.id_socio, item.nombre, item.estado_descripcion, item.grupo_label, item.fecha_baja, item.periodo_label, item.periodo, item.motivo, item.pagos_monto_total, pagosTexto].filter(Boolean).join(' ');
      return normalizarTexto(textoItem).includes(q);
    });
  }, [items, busqueda]);

  const inscripcionesFiltradas = useMemo(() => {
    const q = normalizarTexto(busqueda);
    if (!q) return inscItems;
    return inscItems.filter((item) => {
      const pagosTexto = (item.pagos || [])
        .map((p) => [p.id_inscripcion, p.monto, p.fecha_pago, p.id_medio_pago, p.medio_pago_nombre].filter(Boolean).join(' '))
        .join(' ');
      const textoItem = [item.id_socio, item.nombre, item.dni, item.ingreso, item.fecha_alta, item.periodo_label, item.periodo_nombre, item.periodo_meses, item.estado_descripcion, item.grupo_label, item.monto_total, item.monto_inscripcion, item.fecha_pago_inscripcion, item.medio_pago_inscripcion, pagosTexto].filter(Boolean).join(' ');
      return normalizarTexto(textoItem).includes(q);
    });
  }, [inscItems, busqueda]);

  const deudoresFiltrados = useMemo(() => {
    const q = normalizarTexto(busqueda);
    if (!q) return deudoresItems;
    return deudoresItems.filter((item) => {
      const textoItem = [item.id_socio, item.nombre, item.dni, item.estado_descripcion, item.grupo_label, item.periodo_label, item.periodo_nombre, item.periodo_meses, item.ingreso, item.categoria_descripcion, item.cat_monto_nombre, item.cobrador, item.domicilio, item.domicilio_cobro, item.telefono_movil, item.telefono_fijo, item.monto_adeudado, item.monto_periodo, item.monto_estimado].filter(Boolean).join(' ');
      return normalizarTexto(textoItem).includes(q);
    });
  }, [deudoresItems, busqueda]);

  const inscripcionesVisibles = useMemo(() => {
    if (mostrarTodosRegistros.inscripciones) return inscripcionesFiltradas;
    return inscripcionesFiltradas.slice(0, LIMITE_REGISTROS_DETALLE);
  }, [inscripcionesFiltradas, mostrarTodosRegistros.inscripciones]);

  const itemsVisibles = useMemo(() => {
    if (mostrarTodosRegistros.bajas) return itemsFiltrados;
    return itemsFiltrados.slice(0, LIMITE_REGISTROS_DETALLE);
  }, [itemsFiltrados, mostrarTodosRegistros.bajas]);

  const deudoresVisibles = useMemo(() => {
    if (mostrarTodosRegistros.deudores) return deudoresFiltrados;
    return deudoresFiltrados.slice(0, LIMITE_REGISTROS_DETALLE);
  }, [deudoresFiltrados, mostrarTodosRegistros.deudores]);

  /* ─── Helpers medios/fechas pago ─── */

  const obtenerMediosPago = (item) => {
    const pagos = item.pagos || [];
    const mediosPago = item.medios_pago_inscripcion || [];
    if (mediosPago.length > 0) return mediosPago.join(' / ');
    if (pagos.length > 0) return pagos.map((p) => p.medio_pago_nombre || '').filter(Boolean).join(' / ') || '-';
    return '-';
  };

  const obtenerFechasPago = (item) => {
    const pagos = item.pagos || [];
    const fechasPago = item.fechas_pago_inscripcion || [];
    const fechasTexto = fechasPago.length > 0
      ? fechasPago.map(formatearFecha).join(' / ')
      : pagos.length > 0
        ? pagos.map((p) => formatearFecha(p.fecha_pago)).join(' / ')
        : '-';

    if (item.registro_sin_importe) {
      return fechasTexto === '-' ? 'REGISTRO SIN IMPORTE' : `${fechasTexto} · SIN IMPORTE`;
    }

    return fechasTexto;
  };

  /* ─── Excel ─── */

  const armarFilasResumenInscripciones = (periodosBase = [], detalle = []) => {
    const mapa = new Map();

    periodosBase.forEach((periodo) => {
      mapa.set(periodo.key, {
        key: periodo.key,
        periodo_label: periodo.periodo_label || '',
        periodo_meses: periodo.periodo_meses || periodo.meses_incluidos || '',
        cantidad_total: 0,
        activos_cantidad: 0,
        pasivos_cantidad: 0,
        sin_estado_cantidad: 0,
        pagados_cantidad: 0,
        sin_pago_cantidad: 0,
        registros_sin_importe_cantidad: 0,
        sin_registro_pago_cantidad: 0,
        monto_pagado_total: 0,
      });
    });

    detalle.forEach((item) => {
      const key = item.periodo_key || `${item.anio || ''}-${item.id_periodo || ''}`;
      if (!mapa.has(key)) {
        mapa.set(key, {
          key,
          periodo_label: item.periodo_label || item.periodo_balance || '',
          periodo_meses: item.periodo_meses || '',
          cantidad_total: 0,
          activos_cantidad: 0,
          pasivos_cantidad: 0,
          sin_estado_cantidad: 0,
          pagados_cantidad: 0,
          sin_pago_cantidad: 0,
          registros_sin_importe_cantidad: 0,
          sin_registro_pago_cantidad: 0,
          monto_pagado_total: 0,
        });
      }

      const fila = mapa.get(key);
      fila.cantidad_total += 1;
      if (item.grupo === 'activos') fila.activos_cantidad += 1;
      else if (item.grupo === 'pasivos') fila.pasivos_cantidad += 1;
      else fila.sin_estado_cantidad += 1;

      if (item.pagado) fila.pagados_cantidad += 1;
      else fila.sin_pago_cantidad += 1;
      if (item.registro_sin_importe) fila.registros_sin_importe_cantidad += 1;
      if (item.sin_registro_pago) fila.sin_registro_pago_cantidad += 1;

      fila.monto_pagado_total += Number(item.monto_pagado_total || item.monto_inscripcion || item.monto_total || 0);
    });

    const resumenFiltrado = Array.from(mapa.values()).sort((a, b) => String(a.key).localeCompare(String(b.key)));
    const filas = resumenFiltrado.map((periodo) => ({
      Período: quitarPalabraPeriodo(periodo.periodo_label || ''),
      'Meses incluidos': periodo.periodo_meses || '',
      Total: periodo.cantidad_total,
      Activos: periodo.activos_cantidad,
      Pasivos: periodo.pasivos_cantidad,
      Pagadas: periodo.pagados_cantidad,
      'Registros sin importe': periodo.registros_sin_importe_cantidad,
      'Sin registro de pago': periodo.sin_registro_pago_cantidad,
      'Total cobrado': Number(periodo.monto_pagado_total || 0),
    }));

    if (filas.length > 0) {
      filas.push({
        Período: 'TOTAL GENERAL',
        'Meses incluidos': '',
        Total: detalle.length,
        Activos: detalle.filter((item) => item.grupo === 'activos').length,
        Pasivos: detalle.filter((item) => item.grupo === 'pasivos').length,
        Pagadas: detalle.filter((item) => Boolean(item.pagado)).length,
        'Registros sin importe': detalle.filter((item) => Boolean(item.registro_sin_importe)).length,
        'Sin registro de pago': detalle.filter((item) => Boolean(item.sin_registro_pago)).length,
        'Total cobrado': detalle.reduce(
          (total, item) => total + Number(item.monto_pagado_total || item.monto_inscripcion || item.monto_total || 0),
          0
        ),
      });
    }

    return filas;
  };

  const armarFilasResumenBajas = (_grupos = [], detalle = []) => {
    const mapa = new Map();

    detalle.forEach((item) => {
      const grupo = item.grupo || 'sin_estado';
      const periodo = item.periodo_label || item.periodo || '-';
      const key = `${grupo}|${periodo}`;

      if (!mapa.has(key)) {
        mapa.set(key, {
          grupo,
          titulo: grupo === 'activos' ? 'Bajas activos' : grupo === 'pasivos' ? 'Bajas pasivos' : 'Bajas sin estado',
          periodo,
          cantidad: 0,
          pagos_cantidad: 0,
          condonaciones_cantidad: 0,
          pagos_monto_total: 0,
        });
      }

      const fila = mapa.get(key);
      fila.cantidad += 1;
      fila.pagos_cantidad += Number(item.pagos_cantidad || 0);
      fila.condonaciones_cantidad += Number(item.condonaciones_cantidad || 0);
      fila.pagos_monto_total += Number(item.pagos_monto_total || 0);
    });

    const ordenGrupo = { pasivos: 1, activos: 2, sin_estado: 3 };
    const resumenFiltrado = Array.from(mapa.values()).sort((a, b) => {
      const cmpGrupo = (ordenGrupo[a.grupo] || 9) - (ordenGrupo[b.grupo] || 9);
      return cmpGrupo !== 0 ? cmpGrupo : String(a.periodo).localeCompare(String(b.periodo));
    });

    const filas = resumenFiltrado.map((fila) => ({
      Grupo: fila.titulo,
      'Período baja / Año': quitarPalabraPeriodo(fila.periodo),
      Bajas: fila.cantidad,
      Pagos: fila.pagos_cantidad,
      Condonaciones: fila.condonaciones_cantidad,
      'Monto pagado': fila.pagos_monto_total,
    }));

    if (filas.length > 0) {
      filas.push({
        Grupo: 'TOTAL GENERAL',
        'Período baja / Año': '',
        Bajas: detalle.length,
        Pagos: detalle.reduce((total, item) => total + Number(item.pagos_cantidad || 0), 0),
        Condonaciones: detalle.reduce((total, item) => total + Number(item.condonaciones_cantidad || 0), 0),
        'Monto pagado': detalle.reduce((total, item) => total + Number(item.pagos_monto_total || 0), 0),
      });
    }

    return filas;
  };

  const armarFilasResumenDeudores = (periodosBase = [], detalle = []) => {
    const mapa = new Map();

    periodosBase.forEach((periodo) => {
      mapa.set(periodo.key, {
        key: periodo.key,
        periodo_label: periodo.periodo_label || '',
        deudores_cantidad: 0,
        activos_cantidad: 0,
        pasivos_cantidad: 0,
        sin_estado_cantidad: 0,
        monto_total_adeudado: 0,
      });
    });

    detalle.forEach((item) => {
      const key = item.periodo_key || `${item.anio || ''}-${item.id_periodo || ''}`;
      if (!mapa.has(key)) {
        mapa.set(key, {
          key,
          periodo_label: item.periodo_label || '',
          deudores_cantidad: 0,
          activos_cantidad: 0,
          pasivos_cantidad: 0,
          sin_estado_cantidad: 0,
          monto_total_adeudado: 0,
        });
      }

      const fila = mapa.get(key);
      fila.deudores_cantidad += 1;
      if (item.grupo === 'activos') fila.activos_cantidad += 1;
      else if (item.grupo === 'pasivos') fila.pasivos_cantidad += 1;
      else fila.sin_estado_cantidad += 1;
      fila.monto_total_adeudado += obtenerMontoAdeudado(item);
    });

    const resumenFiltrado = Array.from(mapa.values()).sort((a, b) => String(a.key).localeCompare(String(b.key)));
    const filas = resumenFiltrado.map((periodo) => ({
      Período: quitarPalabraPeriodo(periodo.periodo_label || ''),
      Deudores: periodo.deudores_cantidad,
      Activos: periodo.activos_cantidad,
      Pasivos: periodo.pasivos_cantidad,
      'Sin estado': periodo.sin_estado_cantidad,
      'Monto adeudado': periodo.monto_total_adeudado,
    }));

    if (filas.length > 0) {
      filas.push({
        Período: 'TOTAL GENERAL',
        Deudores: detalle.length,
        Activos: detalle.filter((item) => item.grupo === 'activos').length,
        Pasivos: detalle.filter((item) => item.grupo === 'pasivos').length,
        'Sin estado': detalle.filter((item) => item.grupo !== 'activos' && item.grupo !== 'pasivos').length,
        'Monto adeudado': detalle.reduce((total, item) => total + obtenerMontoAdeudado(item), 0),
      });
    }

    return filas;
  };

  const armarFilasInscripciones = (lista = []) =>
    lista.map((item) => ({
      ID: item.id_socio,
      Socio: item.nombre || '',
      DNI: item.dni || '',
      Estado: item.estado_descripcion || item.grupo_label || '',
      'Fecha alta': formatearFecha(item.fecha_alta || item.ingreso),
      'Período balance': quitarPalabraPeriodo(item.periodo_label || item.periodo_balance || ''),
      'Mes ingreso': item.mes_ingreso_nombre || '',
      'Estado pago': item.estado_pago_inscripcion || (item.pagado ? 'PAGADA' : 'SIN PAGO REGISTRADO'),
      'Fecha pago': obtenerFechasPago(item),
      'Medio pago': obtenerMediosPago(item),
      'Monto inscripción pagado': Number(item.monto_inscripcion || item.monto_pagado_total || item.monto_total || 0),
    }));

  const armarFilasBajas = (lista = []) =>
    lista.map((item) => {
      const pagos = item.pagos || [];
      const detallePagos = pagos.length
        ? pagos.map((p) => {
            const esCondonacion = String(p.estado || '').toLowerCase() === 'condonado';
            return esCondonacion
              ? `${obtenerPeriodoPagoTexto(p)}: CONDONADO`
              : `${obtenerPeriodoPagoTexto(p)}: ${formatearDinero(p.monto || 0)}`;
          }).join(' | ')
        : '-';
      return {
        ID: item.id_socio,
        Socio: item.nombre || '',
        Estado: item.estado_descripcion || item.grupo_label || '',
        'Fecha baja': formatearFecha(item.fecha_baja),
        'Período baja': quitarPalabraPeriodo(item.periodo_label || item.periodo || ''),
        'Períodos cubiertos': detallePagos,
        Pagos: Number(item.pagos_cantidad || 0),
        Condonaciones: Number(item.condonaciones_cantidad || 0),
        'Total pagado': Number(item.pagos_monto_total || 0),
        Motivo: item.motivo || '',
      };
    });

  const armarFilasDeudores = (lista = []) =>
    lista.map((item) => ({
      Período: quitarPalabraPeriodo(item.periodo_label || ''),
      ID: item.id_socio,
      Socio: item.nombre || '',
      DNI: item.dni || '',
      Estado: item.estado_descripcion || item.grupo_label || '',
      Categoría: item.categoria_descripcion || item.cat_monto_nombre || '',
      Ingreso: formatearFecha(item.ingreso),
      Domicilio: item.domicilio || '',
      'Domicilio cobro': item.domicilio_cobro || '',
      'Teléfono móvil': item.telefono_movil || '',
      'Teléfono fijo': item.telefono_fijo || '',
      Cobrador: item.cobrador || '',
      'Monto adeudado': obtenerMontoAdeudado(item),
      Observación: item.motivo_deuda || '',
    }));

  const nombreHojaSeguro = (nombre) =>
    String(nombre || 'Hoja').replace(/[\\/:*?\[\]]/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 31) || 'Hoja';

  const nombreHojaUnico = (workbook, nombre) => {
    const base = nombreHojaSeguro(nombre);
    const existentes = new Set(workbook.SheetNames || []);

    if (!existentes.has(base)) {
      return base;
    }

    for (let i = 2; i <= 99; i++) {
      const sufijo = ` (${i})`;
      const maxBase = 31 - sufijo.length;
      const candidato = `${base.substring(0, maxBase)}${sufijo}`;

      if (!existentes.has(candidato)) {
        return candidato;
      }
    }

    return `${base.substring(0, 25)} ${Date.now().toString().slice(-5)}`;
  };

  const ajustarColumnas = (worksheet, filas) => {
    if (!filas.length) return;
    worksheet['!cols'] = Object.keys(filas[0]).map((key) => ({
      wch: Math.min(Math.max(Math.max(key.length, ...filas.map((f) => String(f[key] ?? '').length)) + 2, 12), 55),
    }));
  };

  const agregarHoja = (workbook, nombreHoja, filas) => {
    const datos = filas.length ? filas : [{ Mensaje: 'No hay datos para exportar.' }];
    const worksheet = XLSX.utils.json_to_sheet(datos);
    ajustarColumnas(worksheet, datos);
    XLSX.utils.book_append_sheet(workbook, worksheet, nombreHojaUnico(workbook, nombreHoja));
  };

  const agregarHojasDeudores = (workbook, periodosBase = [], lista = []) => {
    let hojasAgregadas = 0;
    periodosBase.forEach((periodo) => {
      const filasPeriodo = lista.filter((item) => item.periodo_key === periodo.key);
      if (!filasPeriodo.length) return;
      const nombre = `Deudores ${String(periodo.periodo_nombre || '').replace('PERÍODO', 'P').replace('PERIODO', 'P').replace(' Y ', '-')} ${periodo.anio || ''}`;
      agregarHoja(workbook, nombre, armarFilasDeudores(filasPeriodo));
      hojasAgregadas++;
    });
    if (hojasAgregadas === 0) agregarHoja(workbook, 'Deudores por período', []);
  };

  const exportarPestaniaActual = () => {
    const wb = XLSX.utils.book_new();
    const sufijoArchivo = limpiarNombreArchivo(rangoTexto);

    if (pestaniaActiva === 'inscripciones') {
      agregarHoja(wb, 'Resumen inscripciones', armarFilasResumenInscripciones(inscPeriodos, inscripcionesFiltradas));
      agregarHoja(wb, 'Detalle inscripciones', armarFilasInscripciones(inscripcionesFiltradas));
      XLSX.writeFile(wb, `Balance_Anual_Inscripciones_${sufijoArchivo}.xlsx`);
      return;
    }

    if (pestaniaActiva === 'deudores') {
      agregarHoja(wb, 'Resumen deudores', armarFilasResumenDeudores(deudoresPeriodos, deudoresFiltrados));
      agregarHoja(wb, 'Detalle deudores', armarFilasDeudores(deudoresFiltrados));
      agregarHojasDeudores(wb, deudoresPeriodos, deudoresFiltrados);
      XLSX.writeFile(wb, `Balance_Anual_Deudores_${sufijoArchivo}.xlsx`);
      return;
    }

    agregarHoja(wb, 'Resumen bajas', armarFilasResumenBajas(gruposResumen, itemsFiltrados));
    agregarHoja(wb, 'Detalle bajas', armarFilasBajas(itemsFiltrados));
    XLSX.writeFile(wb, `Balance_Anual_Bajas_${sufijoArchivo}.xlsx`);
  };

  const exportarTodasLasPestanias = () => {
    const wb = XLSX.utils.book_new();
    const sufijoArchivo = limpiarNombreArchivo(rangoTexto);

    agregarHoja(wb, 'Resumen inscripciones', armarFilasResumenInscripciones(inscPeriodos, inscItems));
    agregarHoja(wb, 'Detalle inscripciones', armarFilasInscripciones(inscItems));

    agregarHoja(wb, 'Resumen bajas', armarFilasResumenBajas(gruposResumen, items));
    agregarHoja(wb, 'Detalle bajas', armarFilasBajas(items));

    agregarHoja(wb, 'Resumen deudores', armarFilasResumenDeudores(deudoresPeriodos, deudoresItems));
    agregarHoja(wb, 'Detalle deudores', armarFilasDeudores(deudoresItems));
    agregarHojasDeudores(wb, deudoresPeriodos, deudoresItems);

    XLSX.writeFile(wb, `Balance_Anual_Completo_${sufijoArchivo}.xlsx`);
  };

  /* ─── Buscador compartido ─── */

  const actualizarBusqueda = (valor) => {
    setBusqueda(valor);
    setMostrarTodosRegistros((prev) => ({
      ...prev,
      [pestaniaActiva]: false,
    }));
  };

  const Buscador = ({ placeholder }) => (
    <div className="mba-buscador">
      <FaSearch />
      <input
        type="text"
        value={busqueda}
        onChange={(e) => actualizarBusqueda(e.target.value)}
        placeholder={placeholder}
      />
      {busqueda && (
        <button type="button" onClick={() => actualizarBusqueda('')} title="Limpiar búsqueda">
          <FaTimes />
        </button>
      )}
    </div>
  );

  const BotonCargarTodos = ({ tipo, total }) => {
    const quedan = Math.max(total - LIMITE_REGISTROS_DETALLE, 0);

    if (total <= LIMITE_REGISTROS_DETALLE || mostrarTodosRegistros[tipo]) {
      return null;
    }

    return (
      <div className="mba-cargar-todos">
        <span>
          Se muestran los primeros {LIMITE_REGISTROS_DETALLE}.
          {quedan > 0 ? ` Quedan ${quedan} registros más.` : ''}
        </span>
        <button
          type="button"
          className="mba-btn mba-btn--secondary mba-btn--load-all"
          onClick={() => setMostrarTodosRegistros((prev) => ({ ...prev, [tipo]: true }))}
        >
          Cargar todos
        </button>
      </div>
    );
  };

  /* ─── Render ─── */

  return (
    <div className="mba-overlay">
      <div className="mba-modal">

        {/* HEADER */}
        <div className="mba-header">
          <div className="mba-title-wrap">
            <div className="mba-icon"><FaFileImport /></div>
            <div>
              <h3>Balance anual</h3>
              <p>{balanceCargado ? rangoTexto : 'Seleccioná el rango de fechas para generar el balance'}</p>
            </div>
          </div>
          <button type="button" className="mba-close" onClick={onClose} title="Cerrar">
            <FaTimes />
          </button>
        </div>

        {/* BODY SCROLLEABLE */}
        <div className="mba-body">

          {/* FORM RANGO */}
          <form
            className={`mba-rango-form ${balanceCargado ? 'mba-rango-form--compacto' : ''}`}
            onSubmit={cargarBalance}
          >
            {!balanceCargado && (
              <div className="mba-rango-info">
                <strong>Rango del balance</strong>
                <span>Elegí desde qué fecha hasta qué fecha querés analizar bajas, inscripciones y deudores.</span>
              </div>
            )}

            <label
              onPointerDown={(e) => { if (loading) return; e.preventDefault(); abrirCalendario(fechaDesdeRef, loading); }}
            >
              Desde
              <input ref={fechaDesdeRef} type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} disabled={loading} />
            </label>

            <label
              onPointerDown={(e) => { if (loading) return; e.preventDefault(); abrirCalendario(fechaHastaRef, loading); }}
            >
              Hasta
              <input ref={fechaHastaRef} type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} disabled={loading} />
            </label>

            <div className="mba-rango-actions">

              <button type="submit" className="mba-btn mba-btn--primary" disabled={loading}>
                {loading ? 'Generando...' : balanceCargado ? 'Actualizar balance' : 'Generar balance'}
              </button>
            </div>
          </form>

          {/* ESTADOS */}
          {loading ? (
            <div className="mba-loading">Obteniendo bajas, pagos, inscripciones y deudores del balance...</div>
          ) : error ? (
            <div className="mba-error"><FaExclamationTriangle /> {error}</div>
          ) : !balanceCargado ? (
            <div className="mba-empty">
              Seleccioná el rango de fechas y presioná <strong>Generar balance</strong> para ver la información.
            </div>
          ) : (
            <>
              {/* TABS */}
              <div className="mba-tabs">
                <button type="button" onClick={() => cambiarPestania('inscripciones')} className={`mba-btn ${pestaniaActiva === 'inscripciones' ? 'mba-btn--active' : 'mba-btn--secondary'}`}>
                  <FaUserPlus /> Inscripciones
                </button>
                <button type="button" onClick={() => cambiarPestania('bajas')} className={`mba-btn ${pestaniaActiva === 'bajas' ? 'mba-btn--active' : 'mba-btn--secondary'}`}>
                  <FaUserMinus /> Bajas
                </button>
                <button type="button" onClick={() => cambiarPestania('deudores')} className={`mba-btn ${pestaniaActiva === 'deudores' ? 'mba-btn--active' : 'mba-btn--secondary'}`}>
                  <FaExclamationTriangle /> Deudores por período
                </button>
                <div className="mba-tabs-actions">
                  <button type="button" className="mba-btn mba-btn--secondary" onClick={exportarPestaniaActual}>
                    <FaFileExcel /> Exportar pestaña actual
                  </button>
                  <button type="button" className="mba-btn mba-btn--secondary" onClick={exportarTodasLasPestanias}>
                    <FaFileExcel /> Exportar todas las pestañas
                  </button>
                </div>
              </div>

              {/* CONTENIDO */}
              {cargandoPestania ? (
                <div className="mba-tab-loading">
                  <div className="mba-tab-loading-card">
                    <div className="mba-loader-circle" />
                    <strong>{obtenerTextoCargaPestania()}</strong>
                    <span>Preparando la vista y los datos de la pestaña seleccionada.</span>
                  </div>
                  <div className="mba-skeleton-grid"><div /><div /><div /><div /></div>
                  <div className="mba-skeleton-table"><div /><div /><div /><div /><div /></div>
                </div>
              ) : (
                <>
                  {/* ── INSCRIPCIONES ── */}
                  {pestaniaActiva === 'inscripciones' && (
                    <>
                      <div className="mba-grid">
                        <div className="mba-card"><span>Inscripciones</span><strong>{inscTotales.total_inscripciones || 0}</strong></div>
                        <div className="mba-card mba-card--ok"><span>Inscripciones pagadas</span><strong>{inscTotales.pagados_cantidad || 0}</strong></div>
                        <div className="mba-card mba-card--warn"><span>Registros sin importe</span><strong>{inscTotales.registros_sin_importe_cantidad || 0}</strong></div>
                        <div className="mba-card mba-card--warn"><span>Sin registro de pago</span><strong>{inscTotales.sin_registro_pago_cantidad || 0}</strong></div>
                        <div className="mba-card mba-card--ok"><span>Total inscripción</span><strong>{formatearDinero(inscTotales.monto_total || 0)}</strong></div>
                        <div className="mba-card mba-card--ok"><span>Activos inscriptos</span><strong>{inscTotales.activos || 0}</strong></div>
                        <div className="mba-card mba-card--warn"><span>Pasivos inscriptos</span><strong>{inscTotales.pasivos || 0}</strong></div>
                      </div>

                      <div className="mba-section">
                        <div className="mba-section-head">
                          <h4>Resumen de inscripciones por período de ingreso</h4>
                        </div>
                        <div className="mba-dlist">
                          <div className="mba-drow-head mba-drow--periodos-insc">
                            <span>Período</span><span>Meses incluidos</span><span className="is-center">Total</span><span className="is-center">Activos</span><span className="is-center">Pasivos</span><span className="is-center">Pagadas</span><span className="is-center">Sin importe</span><span className="is-center">Sin registro</span><span>Total cobrado</span>
                          </div>
                          <div className="mba-dlist-body">
                            {inscPeriodos.length > 0 ? inscPeriodos.map((p) => (
                              <div key={p.key} className="mba-drow mba-drow--periodos-insc">
                                <div className="mba-dcell">{quitarPalabraPeriodo(p.periodo_label)}</div>
                                <div className="mba-dcell mba-dcell--wrap">{p.periodo_meses || '-'}</div>
                                <div className="is-center">{p.cantidad_total || 0}</div>
                                <div className="is-center">{p.activos_cantidad || 0}</div>
                                <div className="is-center">{p.pasivos_cantidad || 0}</div>
                                <div className="is-center">{p.pagados_cantidad || 0}</div>
                                <div className="is-center">{p.registros_sin_importe_cantidad || 0}</div>
                                <div className="is-center">{p.sin_registro_pago_cantidad || 0}</div>
                                <div className="mba-dcell mba-dcell--monto">{formatearDinero(obtenerTotalPagadoPeriodo(p))}</div>
                              </div>
                            )) : (
                              <div className="mba-drow-empty">No hay períodos de inscripción para mostrar.</div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mba-section">
                        <div className="mba-section-head mba-section-head--con-busqueda">
                          <div>
                            <h4>Detalle completo de socios inscriptos</h4>
                            <p>Mostrando {inscripcionesVisibles.length} de {inscripcionesFiltradas.length} socios ingresados.</p>
                          </div>
                          <Buscador placeholder="Buscar por ID, socio, DNI, estado, ingreso o período..." />
                        </div>
                        <div className="mba-dlist">
                          <div className="mba-drow-head mba-drow--inscripciones">
                            <span>ID</span><span>Socio</span><span>DNI</span><span>Estado</span><span>Fecha alta</span><span>Período</span><span>Fecha pago</span><span>Medio pago</span>
                          </div>
                          <div className="mba-dlist-body">
                            {inscripcionesFiltradas.length > 0 ? (
                              inscripcionesVisibles.map((item) => (
                                <FilaInscripcion
                                  key={`inscripcion-${item.id_socio}`}
                                  item={item}
                                  obtenerFechasPago={obtenerFechasPago}
                                  obtenerMediosPago={obtenerMediosPago}
                                />
                              ))
                            ) : (
                              <div className="mba-drow-empty">
                                {busqueda ? 'No se encontraron inscripciones con esa búsqueda.' : 'No hay socios ingresados en el rango seleccionado.'}
                              </div>
                            )}
                          </div>
                          <BotonCargarTodos tipo="inscripciones" total={inscripcionesFiltradas.length} />
                        </div>
                      </div>
                    </>
                  )}

                  {/* ── BAJAS ── */}
                  {pestaniaActiva === 'bajas' && (
                    <>
                      <div className="mba-grid">
                        <div className="mba-card"><span>Total bajas</span><strong>{totales.total_bajas || 0}</strong></div>
                        <div className="mba-card mba-card--warn"><span>Bajas pasivos</span><strong>{totales.pasivos || 0}</strong></div>
                        <div className="mba-card mba-card--ok"><span>Bajas activos</span><strong>{totales.activos || 0}</strong></div>
                        <div className="mba-card"><span>Pagos bajas</span><strong>{totales.pagos_detectados || 0}</strong></div>
                        <div className="mba-card mba-card--warn"><span>Condonaciones</span><strong>{totales.condonaciones_detectadas || 0}</strong></div>
                        <div className="mba-card mba-card--ok"><span>Total bajas pagado</span><strong>{formatearDinero(totales.pagos_monto_total || 0)}</strong></div>
                      </div>

                      <div className="mba-section">
                        <div className="mba-section-head">
                          <h4>Resumen por período de baja</h4>
                        </div>
                        <div className="mba-dlist">
                          <div className="mba-drow-head mba-drow--resumen-bajas">
                            <span>Grupo</span><span>Período baja / Año</span><span className='is-center'>Bajas</span><span className='is-center'>Pagos</span><span className='is-center'>Condonaciones</span><span>Monto pagado</span>
                          </div>
                          <div className="mba-dlist-body">
                            {gruposResumen.map((grupo) => {
                              if (!grupo.periodos.length) {
                                return (
                                  <div key={`${grupo.key}-vacio`} className="mba-drow mba-drow--resumen-bajas">
                                    <div>{grupo.titulo}</div><div>-</div><div>0</div><div>0</div><div>0</div><div>{formatearDinero(0)}</div>
                                  </div>
                                );
                              }
                              return grupo.periodos.map((periodo) => (
                                <div key={`${grupo.key}-${periodo.periodo_label}`} className="mba-drow mba-drow--resumen-bajas">
                                  <div>
                                    <span className={`mba-badge ${grupo.key === 'activos' ? 'mba-badge--ok' : 'mba-badge--warn'}`}>
                                      {grupo.titulo}
                                    </span>
                                  </div>
                                  <div >{quitarPalabraPeriodo(periodo.periodo_label || periodo.periodo)}</div>
                                  <div className='is-center'>{periodo.cantidad}</div>
                                  <div className='is-center'>{periodo.pagos_cantidad || 0}</div>
                                  <div className='is-center'>{periodo.condonaciones_cantidad || 0}</div>
                                  <div>{formatearDinero(periodo.pagos_monto_total || 0)}</div>
                                </div>
                              ));
                            })}
                          </div>
                        </div>
                      </div>

                      <div className="mba-section">
                        <div className="mba-section-head mba-section-head--con-busqueda">
                          <div>
                            <h4>Detalle de socios dados de baja</h4>
                            <p>Mostrando {itemsVisibles.length} de {itemsFiltrados.length} socios.</p>
                          </div>
                          <Buscador placeholder="Buscar por ID, socio, estado, período, baja o pago..." />
                        </div>
                        <div className="mba-dlist">
                          <div className="mba-drow-head mba-drow--bajas">
                            <span>ID</span><span>Socio</span><span>Estado</span><span>Fecha baja</span><span>Período baja</span><span>Períodos cubiertos</span><span>Total pagado</span><span>Motivo</span>
                          </div>
                          <div className="mba-dlist-body">
                            {itemsFiltrados.length > 0 ? (
                              itemsVisibles.map((item) => (
                                <FilaBaja
                                  key={`${item.id_socio}-${item.fecha_baja}`}
                                  item={item}
                                  onVerMotivo={verMotivoCompleto}
                                />
                              ))
                            ) : (
                              <div className="mba-drow-empty">
                                {busqueda ? 'No se encontraron socios dados de baja con esa búsqueda.' : 'No hay socios dados de baja en el rango seleccionado.'}
                              </div>
                            )}
                          </div>
                          <BotonCargarTodos tipo="bajas" total={itemsFiltrados.length} />
                        </div>
                      </div>
                    </>
                  )}

                  {/* ── DEUDORES ── */}
                  {pestaniaActiva === 'deudores' && (
                    <>
                      <div className="mba-grid">
                        <div className="mba-card"><span>Total deudas por período</span><strong>{deudoresTotales.total_deudores || 0}</strong></div>
                        <div className="mba-card mba-card--warn"><span>Socios pasivos deudores</span><strong>{deudoresTotales.pasivos || 0}</strong></div>
                        <div className="mba-card mba-card--ok"><span>Socios activos deudores</span><strong>{deudoresTotales.activos || 0}</strong></div>
                        <div className="mba-card"><span>Períodos analizados</span><strong>{deudoresTotales.periodos_cantidad || 0}</strong></div>
                        <div className="mba-card mba-card--warn"><span>Total adeudado</span><strong>{formatearDinero(obtenerTotalAdeudado(deudoresTotales))}</strong></div>
                      </div>

                      <div className="mba-section">
                        <div className="mba-section-head">
                          <h4>Resumen de deudores por período</h4>
                        </div>
                        <div className="mba-dlist">
                          <div className="mba-drow-head mba-drow--periodos-deudores">
                            <span>Período</span><span className='is-center'>Deudores</span><span className='is-center'>Activos</span><span className='is-center'>Pasivos</span><span className='is-center'>Sin estado</span><span>Monto adeudado</span>
                          </div>
                          <div className="mba-dlist-body">
                            {deudoresPeriodos.length > 0 ? deudoresPeriodos.map((p) => (
                              <div key={p.key} className="mba-drow mba-drow--periodos-deudores">
                                <div className="mba-dcell">{quitarPalabraPeriodo(p.periodo_label)}</div>
                                <div className='is-center'>{p.deudores_cantidad || 0}</div>
                                <div className='is-center'>{p.activos_cantidad || 0}</div>
                                <div className='is-center'>{p.pasivos_cantidad || 0}</div>
                                <div className='is-center'>{p.sin_estado_cantidad || 0}</div>
                                <div>{formatearDinero(obtenerTotalAdeudado(p))}</div>
                              </div>
                            )) : (
                              <div className="mba-drow-empty">No hay períodos de deudores para mostrar.</div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mba-section">
                        <div className="mba-section-head mba-section-head--con-busqueda">
                          <div>
                            <h4>Detalle completo de deudores por período</h4>
                            <p>Mostrando {deudoresVisibles.length} de {deudoresFiltrados.length} deudas por período.</p>
                          </div>
                          <Buscador placeholder="Buscar por ID, socio, DNI, estado, período, categoría o cobrador..." />
                        </div>
                        <div className="mba-dlist">
                          <div className="mba-drow-head mba-drow--deudores">
                            <span>Período</span><span>ID</span><span>Socio</span><span>DNI</span><span>Estado</span><span>Categoría</span><span>Ingreso</span><span>Domicilio</span><span>Teléfono</span><span>Cobrador</span><span>Monto</span>
                          </div>
                          <div className="mba-dlist-body">
                            {deudoresFiltrados.length > 0 ? (
                              deudoresVisibles.map((item) => (
                                <FilaDeudor key={`${item.periodo_key}-${item.id_socio}`} item={item} />
                              ))
                            ) : (
                              <div className="mba-drow-empty">
                                {busqueda ? 'No se encontraron deudores con esa búsqueda.' : 'No hay deudores en el rango seleccionado.'}
                              </div>
                            )}
                          </div>
                          <BotonCargarTodos tipo="deudores" total={deudoresFiltrados.length} />
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}


            </>
          )}
        </div>{/* /mba-body */}
      </div>

      {/* ── MODAL MOTIVO COMPLETO ── */}
      {motivoModal.visible && (
        <div
          className="mba-motivo-overlay"
          onClick={cerrarMotivoModal}
        >
          <div
            className="mba-motivo-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mba-motivo-modal-icon">
              <FaInfoCircle />
            </div>

            <h3 className="mba-motivo-modal-title">Motivo de la baja</h3>

            <div className="mba-motivo-modal-body">
              {motivoModal.texto}
            </div>

            <div className="mba-motivo-modal-actions">
              <button
                type="button"
                className="mba-motivo-modal-close"
                onClick={cerrarMotivoModal}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ModalBalanceAnual;

