import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FaExclamationTriangle,
  FaFileImport,
  FaSearch,
  FaTimes,
  FaUserPlus,
  FaUserMinus,
  FaFileExcel,
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

const PERIODOS_MAP = {
  1: 'PERÍODO 1 Y 2',
  2: 'PERÍODO 3 Y 4',
  3: 'PERÍODO 5 Y 6',
  4: 'PERÍODO 7 Y 8',
  5: 'PERÍODO 9 Y 10',
  6: 'PERÍODO 11 Y 12',
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

  return anio ? `${nombrePeriodo} / ${anio}` : nombrePeriodo;
};

const obtenerMontoAdeudado = (item) => {
  return Number(item?.monto_adeudado || item?.monto_periodo || item?.monto_estimado || 0);
};

const obtenerTotalAdeudado = (obj) => {
  return Number(obj?.monto_total_adeudado || obj?.monto_total_estimado || 0);
};

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

  const timeoutPestaniaRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timeoutPestaniaRef.current) {
        clearTimeout(timeoutPestaniaRef.current);
      }
    };
  }, []);

  const rangoTexto = useMemo(() => {
    const desde = rangoAplicado?.desde || fechaDesde;
    const hasta = rangoAplicado?.hasta || fechaHasta;
    return obtenerRangoTexto(desde, hasta);
  }, [rangoAplicado, fechaDesde, fechaHasta]);

  const cargarJson = async (url) => {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    const data = await res.json();

    if (!res.ok || !data.exito) {
      throw new Error(data.mensaje || 'No se pudo obtener la información.');
    }

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

      const urlBajas = `${BASE_URL}/api.php?action=balance_anual_preview&desde=${desdeUrl}&hasta=${hastaUrl}&ts=${ts}`;
      const urlInscripciones = `${BASE_URL}/api.php?action=balance_anual_inscripciones&desde=${desdeUrl}&hasta=${hastaUrl}&ts=${ts}`;
      const urlDeudores = `${BASE_URL}/api.php?action=balance_anual_deudores&desde=${desdeUrl}&hasta=${hastaUrl}&ts=${ts}`;

      const [dataBajas, dataInscripciones, dataDeudores] = await Promise.all([
        cargarJson(urlBajas),
        cargarJson(urlInscripciones),
        cargarJson(urlDeudores),
      ]);

      setBalance(dataBajas);
      setInscripciones(dataInscripciones);
      setDeudores(dataDeudores);
      setRangoAplicado({ desde: fechaDesde, hasta: fechaHasta });
      setBalanceCargado(true);
      setBusqueda('');
      setPestaniaActiva('inscripciones');
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

    if (timeoutPestaniaRef.current) {
      clearTimeout(timeoutPestaniaRef.current);
    }

    setBusqueda('');
    setPestaniaActiva(pestania);
    setCargandoPestania(true);

    timeoutPestaniaRef.current = setTimeout(() => {
      setCargandoPestania(false);
    }, 260);
  };

  const obtenerTextoCargaPestania = () => {
    if (pestaniaActiva === 'inscripciones') return 'Cargando inscripciones del balance...';
    if (pestaniaActiva === 'bajas') return 'Cargando bajas del balance...';
    if (pestaniaActiva === 'deudores') return 'Cargando deudores por período...';
    return 'Cargando información...';
  };

  const totales = balance?.totales || {};
  const resumen = balance?.resumen || {};
  const items = balance?.items || [];

  const inscTotales = inscripciones?.totales || {};
  const inscPeriodos = inscripciones?.periodos || [];
  const inscItems = inscripciones?.items || [];

  const deudoresTotales = deudores?.totales || {};
  const deudoresPeriodos = deudores?.periodos || [];
  const deudoresItems = deudores?.items || [];

  const gruposResumen = useMemo(() => {
    return [
      {
        key: 'pasivos',
        titulo: 'Bajas pasivos',
        cantidad: resumen?.pasivos?.cantidad || 0,
        periodos: resumen?.pasivos?.periodos || [],
      },
      {
        key: 'activos',
        titulo: 'Bajas activos',
        cantidad: resumen?.activos?.cantidad || 0,
        periodos: resumen?.activos?.periodos || [],
      },
      {
        key: 'sin_estado',
        titulo: 'Bajas sin estado',
        cantidad: resumen?.sin_estado?.cantidad || 0,
        periodos: resumen?.sin_estado?.periodos || [],
      },
    ];
  }, [resumen]);

  const itemsFiltrados = useMemo(() => {
    const q = normalizarTexto(busqueda);
    if (!q) return items;

    return items.filter((item) => {
      const pagosTexto = (item.pagos || [])
        .map((pago) =>
          [
            obtenerPeriodoPagoTexto(pago),
            pago.monto,
            pago.periodo_label,
            pago.periodo_nombre,
            pago.periodo_meses,
          ]
            .filter(Boolean)
            .join(' ')
        )
        .join(' ');

      const textoItem = [
        item.id_socio,
        item.nombre,
        item.estado_descripcion,
        item.grupo_label,
        item.fecha_baja,
        item.periodo_label,
        item.periodo,
        item.motivo,
        item.pagos_monto_total,
        pagosTexto,
      ]
        .filter(Boolean)
        .join(' ');

      return normalizarTexto(textoItem).includes(q);
    });
  }, [items, busqueda]);

  const inscripcionesFiltradas = useMemo(() => {
    const q = normalizarTexto(busqueda);
    if (!q) return inscItems;

    return inscItems.filter((item) => {
      const pagosTexto = (item.pagos || [])
        .map((pago) =>
          [
            pago.id_inscripcion,
            pago.monto,
            pago.fecha_pago,
            pago.id_medio_pago,
            pago.medio_pago_nombre,
          ]
            .filter(Boolean)
            .join(' ')
        )
        .join(' ');

      const textoItem = [
        item.id_socio,
        item.nombre,
        item.dni,
        item.ingreso,
        item.fecha_alta,
        item.periodo_label,
        item.periodo_nombre,
        item.periodo_meses,
        item.estado_descripcion,
        item.grupo_label,
        item.monto_total,
        item.monto_inscripcion,
        item.fecha_pago_inscripcion,
        item.medio_pago_inscripcion,
        pagosTexto,
      ]
        .filter(Boolean)
        .join(' ');

      return normalizarTexto(textoItem).includes(q);
    });
  }, [inscItems, busqueda]);

  const deudoresFiltrados = useMemo(() => {
    const q = normalizarTexto(busqueda);
    if (!q) return deudoresItems;

    return deudoresItems.filter((item) => {
      const textoItem = [
        item.id_socio,
        item.nombre,
        item.dni,
        item.estado_descripcion,
        item.grupo_label,
        item.periodo_label,
        item.periodo_nombre,
        item.periodo_meses,
        item.ingreso,
        item.categoria_descripcion,
        item.cat_monto_nombre,
        item.cobrador,
        item.domicilio,
        item.domicilio_cobro,
        item.telefono_movil,
        item.telefono_fijo,
        item.monto_adeudado,
        item.monto_periodo,
        item.monto_estimado,
      ]
        .filter(Boolean)
        .join(' ');

      return normalizarTexto(textoItem).includes(q);
    });
  }, [deudoresItems, busqueda]);

  const obtenerMediosPago = (item) => {
    const pagos = item.pagos || [];
    const mediosPago = item.medios_pago_inscripcion || [];

    if (mediosPago.length > 0) return mediosPago.join(' / ');

    if (pagos.length > 0) {
      return (
        pagos
          .map((pago) => pago.medio_pago_nombre || '')
          .filter(Boolean)
          .join(' / ') || '-'
      );
    }

    return '-';
  };

  const obtenerFechasPago = (item) => {
    const pagos = item.pagos || [];
    const fechasPago = item.fechas_pago_inscripcion || [];

    if (fechasPago.length > 0) {
      return fechasPago.map((fecha) => formatearFecha(fecha)).join(' / ');
    }

    if (pagos.length > 0) {
      return pagos.map((pago) => formatearFecha(pago.fecha_pago)).join(' / ');
    }

    return '-';
  };

  const armarFilasInscripciones = (lista = []) => {
    return lista.map((item) => ({
      ID: item.id_socio,
      Socio: item.nombre || '',
      DNI: item.dni || '',
      Estado: item.estado_descripcion || item.grupo_label || '',
      'Fecha alta': formatearFecha(item.fecha_alta || item.ingreso),
      'Período balance': item.periodo_label || item.periodo_balance || '',
      'Pagó inscripción': item.pagado ? 'Sí' : 'No',
      'Monto inscripción': Number(item.monto_inscripcion || item.monto_total || 0),
      'Fecha pago': obtenerFechasPago(item),
      'Medio pago': obtenerMediosPago(item),
    }));
  };

  const armarFilasBajas = (lista = []) => {
    return lista.map((item) => {
      const pagos = item.pagos || [];

      const detallePagos = pagos.length
        ? pagos
            .map((pago) => {
              const periodoTexto = obtenerPeriodoPagoTexto(pago);
              const monto = formatearDinero(pago.monto || 0);
              return `${periodoTexto}: ${monto}`;
            })
            .join(' | ')
        : '-';

      return {
        ID: item.id_socio,
        Socio: item.nombre || '',
        Estado: item.estado_descripcion || item.grupo_label || '',
        'Fecha baja': formatearFecha(item.fecha_baja),
        'Período baja': item.periodo_label || item.periodo || '',
        'Períodos pagados': detallePagos,
        'Total pagado': Number(item.pagos_monto_total || 0),
        Motivo: item.motivo || '',
      };
    });
  };

  const armarFilasDeudores = (lista = []) => {
    return lista.map((item) => ({
      Período: item.periodo_label || '',
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
  };

  const nombreHojaSeguro = (nombre) => {
    const limpio = String(nombre || 'Hoja')
      .replace(/[\/:*?\[\]]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return limpio.substring(0, 31) || 'Hoja';
  };

  const ajustarColumnas = (worksheet, filas) => {
    if (!filas.length) return;

    const columnas = Object.keys(filas[0]).map((key) => {
      const maxLength = Math.max(
        key.length,
        ...filas.map((fila) => String(fila[key] ?? '').length)
      );

      return { wch: Math.min(Math.max(maxLength + 2, 12), 55) };
    });

    worksheet['!cols'] = columnas;
  };

  const agregarHoja = (workbook, nombreHoja, filas) => {
    const datos = filas.length ? filas : [{ Mensaje: 'No hay datos para exportar.' }];
    const worksheet = XLSX.utils.json_to_sheet(datos);

    ajustarColumnas(worksheet, datos);

    XLSX.utils.book_append_sheet(workbook, worksheet, nombreHojaSeguro(nombreHoja));
  };

  const agregarHojasDeudores = (workbook, periodosBase = [], lista = []) => {
    let hojasAgregadas = 0;

    periodosBase.forEach((periodo) => {
      const filasPeriodo = lista.filter((item) => item.periodo_key === periodo.key);

      if (!filasPeriodo.length) return;

      const nombre = `Deudores ${String(periodo.periodo_nombre || '')
        .replace('PERÍODO', 'P')
        .replace(' Y ', '-')} ${periodo.anio || ''}`;

      agregarHoja(workbook, nombre, armarFilasDeudores(filasPeriodo));
      hojasAgregadas++;
    });

    if (hojasAgregadas === 0) {
      agregarHoja(workbook, 'Deudores', []);
    }
  };

  const exportarPestaniaActual = () => {
    const workbook = XLSX.utils.book_new();

    if (pestaniaActiva === 'inscripciones') {
      const filas = armarFilasInscripciones(inscripcionesFiltradas);
      agregarHoja(workbook, 'Inscripciones', filas);
      XLSX.writeFile(
        workbook,
        `Balance_Anual_Inscripciones_${limpiarNombreArchivo(rangoTexto)}.xlsx`
      );
      return;
    }

    if (pestaniaActiva === 'deudores') {
      agregarHojasDeudores(workbook, deudoresPeriodos, deudoresFiltrados);
      XLSX.writeFile(
        workbook,
        `Balance_Anual_Deudores_${limpiarNombreArchivo(rangoTexto)}.xlsx`
      );
      return;
    }

    const filas = armarFilasBajas(itemsFiltrados);
    agregarHoja(workbook, 'Bajas', filas);
    XLSX.writeFile(
      workbook,
      `Balance_Anual_Bajas_${limpiarNombreArchivo(rangoTexto)}.xlsx`
    );
  };

  const exportarTodasLasPestanias = () => {
    const workbook = XLSX.utils.book_new();

    agregarHoja(workbook, 'Inscripciones', armarFilasInscripciones(inscItems));
    agregarHoja(workbook, 'Bajas', armarFilasBajas(items));
    agregarHojasDeudores(workbook, deudoresPeriodos, deudoresItems);

    XLSX.writeFile(
      workbook,
      `Balance_Anual_Completo_${limpiarNombreArchivo(rangoTexto)}.xlsx`
    );
  };

  return (
    <div className="mba-overlay">
      <div className="mba-modal">
        <div className="mba-header">
          <div className="mba-title-wrap">
            <div className="mba-icon">
              <FaFileImport />
            </div>

            <div>
              <h3>Balance anual</h3>
              <p>{balanceCargado ? rangoTexto : 'Seleccioná el rango de fechas para generar el balance'}</p>
            </div>
          </div>

          <button type="button" className="mba-close" onClick={onClose} title="Cerrar">
            <FaTimes />
          </button>
        </div>

        <form
          className={`mba-rango-form ${balanceCargado ? 'mba-rango-form-compacto' : ''}`}
          onSubmit={cargarBalance}
        >
          {!balanceCargado && (
            <div className="mba-rango-info">
              <strong>Rango del balance</strong>
              <span>Elegí desde qué fecha hasta qué fecha querés analizar bajas, inscripciones y deudores.</span>
            </div>
          )}

          <label>
            Desde
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              disabled={loading}
            />
          </label>

          <label>
            Hasta
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              disabled={loading}
            />
          </label>

          <div className="mba-rango-actions">
            <button type="button" className="mba-btn secondary" onClick={restaurarRangoPorDefecto} disabled={loading}>
              Rango por defecto
            </button>

            <button type="submit" className="mba-btn primary" disabled={loading}>
              {loading ? 'Generando...' : balanceCargado ? 'Actualizar balance' : 'Generar balance'}
            </button>
          </div>
        </form>

        {loading ? (
          <div className="mba-loading">
            Obteniendo bajas, pagos, inscripciones y deudores del balance...
          </div>
        ) : error ? (
          <div className="mba-error">
            <FaExclamationTriangle /> {error}
          </div>
        ) : !balanceCargado ? (
          <div className="mba-empty">
            Seleccioná el rango de fechas y presioná <strong>Generar balance</strong> para ver la información.
          </div>
        ) : (
          <>
            <div className="mba-tabs">
              <button
                type="button"
                onClick={() => cambiarPestania('inscripciones')}
                className={`mba-btn ${pestaniaActiva === 'inscripciones' ? 'active' : 'secondary'}`}
              >
                <FaUserPlus />
                Inscripciones
              </button>

              <button
                type="button"
                onClick={() => cambiarPestania('bajas')}
                className={`mba-btn ${pestaniaActiva === 'bajas' ? 'active' : 'secondary'}`}
              >
                <FaUserMinus />
                Bajas
              </button>

              <button
                type="button"
                onClick={() => cambiarPestania('deudores')}
                className={`mba-btn ${pestaniaActiva === 'deudores' ? 'active' : 'secondary'}`}
              >
                <FaExclamationTriangle />
                Deudores por período
              </button>

              <div className="mba-tabs-actions">
                <button type="button" className="mba-btn secondary" onClick={exportarPestaniaActual}>
                  <FaFileExcel />
                  Exportar pestaña actual
                </button>

                <button type="button" className="mba-btn secondary" onClick={exportarTodasLasPestanias}>
                  <FaFileExcel />
                  Exportar todas las pestañas
                </button>
              </div>
            </div>

            {cargandoPestania ? (
              <div className="mba-tab-loading">
                <div className="mba-tab-loading-card">
                  <div className="mba-loader-circle" />
                  <strong>{obtenerTextoCargaPestania()}</strong>
                  <span>Preparando la vista y los datos de la pestaña seleccionada.</span>
                </div>

                <div className="mba-skeleton-grid">
                  <div />
                  <div />
                  <div />
                  <div />
                </div>

                <div className="mba-skeleton-table">
                  <div />
                  <div />
                  <div />
                  <div />
                  <div />
                </div>
              </div>
            ) : (
              <>
                {pestaniaActiva === 'inscripciones' && (
                  <>
                    <div className="mba-grid">
                      <div className="mba-card">
                        <span>Inscripciones</span>
                        <strong>{inscTotales.total_inscripciones || 0}</strong>
                      </div>

                      <div className="mba-card ok">
                        <span>Inscripciones pagadas</span>
                        <strong>{inscTotales.pagados_cantidad || 0}</strong>
                      </div>

                      <div className="mba-card warn">
                        <span>Inscripciones sin pago</span>
                        <strong>{inscTotales.sin_pago_cantidad || 0}</strong>
                      </div>

                      <div className="mba-card ok">
                        <span>Total inscripción</span>
                        <strong>{formatearDinero(inscTotales.monto_total || 0)}</strong>
                      </div>

                      <div className="mba-card ok">
                        <span>Activos inscriptos</span>
                        <strong>{inscTotales.activos || 0}</strong>
                      </div>

                      <div className="mba-card warn">
                        <span>Pasivos inscriptos</span>
                        <strong>{inscTotales.pasivos || 0}</strong>
                      </div>
                    </div>

                    <div className="mba-revision">
                      <h4>Resumen de inscripciones por período de ingreso</h4>

                      <div className="mba-table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Período</th>
                              <th>Total ingresados</th>
                              <th>Activos</th>
                              <th>Pasivos</th>
                              <th>Sin estado</th>
                              <th>Pagaron inscripción</th>
                              <th>Sin pago</th>
                              <th>Monto total</th>
                            </tr>
                          </thead>

                          <tbody>
                            {inscPeriodos.length > 0 ? (
                              inscPeriodos.map((periodo) => (
                                <tr key={periodo.key}>
                                  <td>{periodo.periodo_label}</td>
                                  <td>{periodo.cantidad_total || 0}</td>
                                  <td>{periodo.activos_cantidad || 0}</td>
                                  <td>{periodo.pasivos_cantidad || 0}</td>
                                  <td>{periodo.sin_estado_cantidad || 0}</td>
                                  <td>{periodo.pagados_cantidad || 0}</td>
                                  <td>{periodo.sin_pago_cantidad || 0}</td>
                                  <td>{formatearDinero(periodo.monto_total || 0)}</td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan="8">No hay períodos de inscripción para mostrar.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="mba-revision">
                      <div className="mba-section-head">
                        <div>
                          <h4>Detalle completo de socios inscriptos</h4>
                          <p>
                            Mostrando {inscripcionesFiltradas.length} de {inscItems.length} socios ingresados.
                          </p>
                        </div>

                        <div className="mba-buscador">
                          <FaSearch />
                          <input
                            type="text"
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            placeholder="Buscar por ID, socio, DNI, estado, ingreso, pago o período..."
                          />

                          {busqueda && (
                            <button type="button" onClick={() => setBusqueda('')} title="Limpiar búsqueda">
                              <FaTimes />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="mba-table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>ID</th>
                              <th>Socio</th>
                              <th>DNI</th>
                              <th>Estado</th>
                              <th>Fecha alta</th>
                              <th>Período balance</th>
                              <th>Pagó inscripción</th>
                              <th>Monto inscripción</th>
                              <th>Fecha pago</th>
                              <th>Medio pago</th>
                            </tr>
                          </thead>

                          <tbody>
                            {inscripcionesFiltradas.length > 0 ? (
                              inscripcionesFiltradas.map((item) => (
                                <tr key={`inscripcion-${item.id_socio}`}>
                                  <td>{item.id_socio}</td>
                                  <td>{item.nombre}</td>
                                  <td>{item.dni || '-'}</td>
                                  <td>{item.estado_descripcion || item.grupo_label || '-'}</td>
                                  <td>{formatearFecha(item.fecha_alta || item.ingreso)}</td>
                                  <td>{item.periodo_label || item.periodo_balance || '-'}</td>
                                  <td>{item.pagado ? 'Sí' : 'No'}</td>
                                  <td>{formatearDinero(item.monto_inscripcion || item.monto_total || 0)}</td>
                                  <td>{obtenerFechasPago(item)}</td>
                                  <td>{obtenerMediosPago(item)}</td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan="10">
                                  {busqueda
                                    ? 'No se encontraron inscripciones con esa búsqueda.'
                                    : 'No hay socios ingresados en el rango seleccionado.'}
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}

                {pestaniaActiva === 'bajas' && (
                  <>
                    <div className="mba-grid">
                      <div className="mba-card">
                        <span>Total bajas</span>
                        <strong>{totales.total_bajas || 0}</strong>
                      </div>

                      <div className="mba-card warn">
                        <span>Bajas pasivos</span>
                        <strong>{totales.pasivos || 0}</strong>
                      </div>

                      <div className="mba-card ok">
                        <span>Bajas activos</span>
                        <strong>{totales.activos || 0}</strong>
                      </div>

                      <div className="mba-card">
                        <span>Pagos bajas</span>
                        <strong>{totales.pagos_detectados || 0}</strong>
                      </div>

                      <div className="mba-card ok">
                        <span>Total bajas pagado</span>
                        <strong>{formatearDinero(totales.pagos_monto_total || 0)}</strong>
                      </div>
                    </div>

                    <div className="mba-revision">
                      <h4>Resumen por período de baja</h4>

                      <div className="mba-table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Grupo</th>
                              <th>Período baja / Año</th>
                              <th>Bajas</th>
                              <th>Pagos encontrados</th>
                              <th>Monto pagado</th>
                            </tr>
                          </thead>

                          <tbody>
                            {gruposResumen.map((grupo) => {
                              if (!grupo.periodos.length) {
                                return (
                                  <tr key={`${grupo.key}-vacio`}>
                                    <td>{grupo.titulo}</td>
                                    <td>-</td>
                                    <td>0</td>
                                    <td>0</td>
                                    <td>{formatearDinero(0)}</td>
                                  </tr>
                                );
                              }

                              return grupo.periodos.map((periodo) => (
                                <tr key={`${grupo.key}-${periodo.periodo_label}`}>
                                  <td>{grupo.titulo}</td>
                                  <td>{periodo.periodo_label || periodo.periodo}</td>
                                  <td>{periodo.cantidad}</td>
                                  <td>{periodo.pagos_cantidad || 0}</td>
                                  <td>{formatearDinero(periodo.pagos_monto_total || 0)}</td>
                                </tr>
                              ));
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="mba-revision">
                      <div className="mba-section-head">
                        <div>
                          <h4>Detalle de socios dados de baja</h4>
                          <p>
                            Mostrando {itemsFiltrados.length} de {items.length} socios.
                          </p>
                        </div>

                        <div className="mba-buscador">
                          <FaSearch />
                          <input
                            type="text"
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            placeholder="Buscar por ID, socio, estado, período, baja o pago..."
                          />

                          {busqueda && (
                            <button type="button" onClick={() => setBusqueda('')} title="Limpiar búsqueda">
                              <FaTimes />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="mba-table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>ID</th>
                              <th>Socio</th>
                              <th>Estado</th>
                              <th>Fecha baja</th>
                              <th>Período baja</th>
                              <th>Períodos pagados</th>
                              <th>Total pagado</th>
                              <th>Motivo</th>
                            </tr>
                          </thead>

                          <tbody>
                            {itemsFiltrados.length > 0 ? (
                              itemsFiltrados.map((item) => {
                                const pagos = item.pagos || [];

                                return (
                                  <tr key={`${item.id_socio}-${item.fecha_baja}`}>
                                    <td>{item.id_socio}</td>
                                    <td>{item.nombre}</td>
                                    <td>{item.estado_descripcion || item.grupo_label}</td>
                                    <td>{formatearFecha(item.fecha_baja)}</td>
                                    <td>{item.periodo_label || item.periodo}</td>

                                    <td>
                                      {pagos.length > 0 ? (
                                        <div className="mba-pagos-lista">
                                          {pagos.map((pago) => (
                                            <div
                                              key={`${item.id_socio}-${pago.id_pago}`}
                                              className="mba-pago-item"
                                            >
                                              <strong>{obtenerPeriodoPagoTexto(pago)}</strong>
                                              <span>{formatearDinero(pago.monto)}</span>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <span>-</span>
                                      )}
                                    </td>

                                    <td>{formatearDinero(item.pagos_monto_total || 0)}</td>
                                    <td>{item.motivo || '-'}</td>
                                  </tr>
                                );
                              })
                            ) : (
                              <tr>
                                <td colSpan="8">
                                  {busqueda
                                    ? 'No se encontraron socios dados de baja con esa búsqueda.'
                                    : 'No hay socios dados de baja en el rango seleccionado.'}
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}

                {pestaniaActiva === 'deudores' && (
                  <>
                    <div className="mba-grid">
                      <div className="mba-card">
                        <span>Total deudas por período</span>
                        <strong>{deudoresTotales.total_deudores || 0}</strong>
                      </div>

                      <div className="mba-card warn">
                        <span>Socios pasivos deudores</span>
                        <strong>{deudoresTotales.pasivos || 0}</strong>
                      </div>

                      <div className="mba-card ok">
                        <span>Socios activos deudores</span>
                        <strong>{deudoresTotales.activos || 0}</strong>
                      </div>

                      <div className="mba-card">
                        <span>Períodos analizados</span>
                        <strong>{deudoresTotales.periodos_cantidad || 0}</strong>
                      </div>

                      <div className="mba-card warn">
                        <span>Total adeudado</span>
                        <strong>{formatearDinero(obtenerTotalAdeudado(deudoresTotales))}</strong>
                      </div>
                    </div>

                    <div className="mba-revision">
                      <h4>Resumen de deudores por período</h4>

                      <div className="mba-table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Período</th>
                              <th>Deudores</th>
                              <th>Activos</th>
                              <th>Pasivos</th>
                              <th>Sin estado</th>
                              <th>Monto adeudado</th>
                            </tr>
                          </thead>

                          <tbody>
                            {deudoresPeriodos.length > 0 ? (
                              deudoresPeriodos.map((periodo) => (
                                <tr key={periodo.key}>
                                  <td>{periodo.periodo_label}</td>
                                  <td>{periodo.deudores_cantidad || 0}</td>
                                  <td>{periodo.activos_cantidad || 0}</td>
                                  <td>{periodo.pasivos_cantidad || 0}</td>
                                  <td>{periodo.sin_estado_cantidad || 0}</td>
                                  <td>{formatearDinero(obtenerTotalAdeudado(periodo))}</td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan="6">No hay períodos de deudores para mostrar.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="mba-revision">
                      <div className="mba-section-head">
                        <div>
                          <h4>Detalle completo de deudores por período</h4>
                          <p>
                            Mostrando {deudoresFiltrados.length} de {deudoresItems.length} deudas por período.
                          </p>
                        </div>

                        <div className="mba-buscador">
                          <FaSearch />
                          <input
                            type="text"
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            placeholder="Buscar por ID, socio, DNI, estado, período, categoría o cobrador..."
                          />

                          {busqueda && (
                            <button type="button" onClick={() => setBusqueda('')} title="Limpiar búsqueda">
                              <FaTimes />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="mba-table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Período</th>
                              <th>ID</th>
                              <th>Socio</th>
                              <th>DNI</th>
                              <th>Estado</th>
                              <th>Categoría</th>
                              <th>Ingreso</th>
                              <th>Domicilio</th>
                              <th>Teléfono</th>
                              <th>Cobrador</th>
                              <th>Monto adeudado</th>
                            </tr>
                          </thead>

                          <tbody>
                            {deudoresFiltrados.length > 0 ? (
                              deudoresFiltrados.map((item) => (
                                <tr key={`${item.periodo_key}-${item.id_socio}`}>
                                  <td>{item.periodo_label || '-'}</td>
                                  <td>{item.id_socio}</td>
                                  <td>{item.nombre}</td>
                                  <td>{item.dni || '-'}</td>
                                  <td>{item.estado_descripcion || item.grupo_label || '-'}</td>
                                  <td>{item.categoria_descripcion || item.cat_monto_nombre || '-'}</td>
                                  <td>{formatearFecha(item.ingreso)}</td>
                                  <td>{item.domicilio || '-'}</td>
                                  <td>{item.telefono_movil || item.telefono_fijo || '-'}</td>
                                  <td>{item.cobrador || '-'}</td>
                                  <td>{formatearDinero(obtenerMontoAdeudado(item))}</td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan="11">
                                  {busqueda
                                    ? 'No se encontraron deudores con esa búsqueda.'
                                    : 'No hay deudores en el rango seleccionado.'}
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}

            <div className="mba-actions">
              <button type="button" className="mba-btn secondary" onClick={onClose}>
                Cerrar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ModalBalanceAnual;