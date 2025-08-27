// src/components/Cuotas/Cuotas.jsx
import React, {
  useEffect,
  useState,
  useMemo,
  useRef,
  useCallback,
  useDeferredValue,
  useTransition,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import BASE_URL from '../../config/config';
import {
  FaDollarSign,
  FaPrint,
  FaSpinner,
  FaBarcode,
  FaSearch,
  FaCalendarAlt,
  FaFilter,
  FaUndo,
  FaSort,
  FaUsers,
  FaTimes,
  FaCheckCircle,
  FaTimesCircle,
  FaExclamationTriangle,
} from 'react-icons/fa';
import { FiChevronLeft, FiChevronRight, FiChevronUp, FiChevronDown } from 'react-icons/fi';
import ModalPagos from './modales/ModalPagos';
import ModalCodigoBarras from './modales/ModalCodigoBarras';
import ModalEliminarPago from './modales/ModalEliminarPago';
import ModalEliminarCondonacion from './modales/ModalEliminarCondonacion';
import { imprimirRecibos } from '../../utils/imprimirRecibos';
import { imprimirRecibosUnicos } from '../../utils/Recibosunicos';
import Toast from '../Global/Toast';
import './Cuotas.css';
import axios from 'axios';
import ModalMesCuotas from './modales/ModalMesCuotas';

/* =========================
 * API con interceptor
 * ========================= */
const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
});
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const status = error?.response?.status;
    const server = error?.response?.data;
    const msg = server?.mensaje || error.message || 'Error en la petición';
    console.error(`HTTP ${status || ''} – ${msg}`, server || error);
    return Promise.reject({ ...error, message: msg, server, status });
  }
);

const PRECIO_MENSUAL = 4000;
const PRECIO_ANUAL_CON_DESCUENTO = 21000;

const Cuotas = () => {
  const navigate = useNavigate();
  const [isPending, startTransition] = useTransition();

  // ===== Estado UI =====
  const [cuotas, setCuotas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingPrint, setLoadingPrint] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [busquedaId, setBusquedaId] = useState('');
  const [estadoPagoSeleccionado, setEstadoPagoSeleccionado] = useState('deudor'); // 'deudor' | 'pagado' | 'condonado'
  const [estadoSocioSeleccionado, setEstadoSocioSeleccionado] = useState('');
  const [medioPagoSeleccionado, setMedioPagoSeleccionado] = useState('');
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState('');
  const [mediosPago, setMediosPago] = useState([]);
  const [periodos, setPeriodos] = useState([]);
  const [estados, setEstados] = useState([]);
  const [mostrarModalPagos, setMostrarModalPagos] = useState(false);
  const [mostrarModalCodigoBarras, setMostrarModalCodigoBarras] = useState(false);
  const [mostrarModalEliminarPago, setMostrarModalEliminarPago] = useState(false);
  const [mostrarModalEliminarCond, setMostrarModalEliminarCond] = useState(false);
  const [socioParaPagar, setSocioParaPagar] = useState(null);
  const [filtrosExpandidos, setFiltrosExpandidos] = useState(true);
  const [orden, setOrden] = useState({ campo: 'nombre', ascendente: true });
  const [toastVisible, setToastVisible] = useState(false);
  const [toastTipo, setToastTipo] = useState('exito');
  const [toastMensaje, setToastMensaje] = useState('');

  // Selector de períodos previo a imprimir
  const [mostrarModalSeleccionPeriodos, setMostrarModalSeleccionPeriodos] = useState(false);
  const [periodosAImprimir, setPeriodosAImprimir] = useState([]); // array de IDs
  const [imprimirContable, setImprimirContable] = useState(false);
  const [cuotaParaImprimir, setCuotaParaImprimir] = useState(null); // si es null => imprimir todos

  // ===== Caché (memoria) + TTL =====
  const cacheRef = useRef({
    ttl: 30 * 60 * 1000, // 30 minutos
    mutationTs: 0,        // timestamp de la última mutación global
    cuotas: {},           // clave: "estado|periodo" => {data, ts}
    listas: { data: null, ts: 0 },
  });
  const [cacheVersion, setCacheVersion] = useState(0);
  const bumpCacheVersion = useCallback(() => setCacheVersion((v) => v + 1), []);

  // Control de operaciones para ignorar respuestas viejas
  const currentOpIdRef = useRef(0);

  // ===== Scroll control =====
  const listRef = useRef(null);
  const scrollToTopSafe = useCallback(() => {
    requestAnimationFrame(() => {
      try {
        listRef.current?.scrollTo(0);
      } catch {}
    });
  }, []);

  // isFresh también verifica que sea posterior a mutationTs
  const isFresh = (ts) => {
    const { ttl, mutationTs } = cacheRef.current;
    return ts && ts >= mutationTs && (Date.now() - ts < ttl);
  };

  const getCuotasKey = useCallback(
    (estadoPago, periodoId) => `${estadoPago}|${periodoId || 'NO_PERIODO'}`,
    []
  );

  // ===== Debounce =====
  const [debouncedBusqueda, setDebouncedBusqueda] = useState('');
  const [debouncedBusquedaId, setDebouncedBusquedaId] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedBusqueda(busqueda), 300);
    return () => clearTimeout(t);
  }, [busqueda]);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedBusquedaId(busquedaId), 200);
    return () => clearTimeout(t);
  }, [busquedaId]);

  // ===== Valores diferidos =====
  const deferredBusqueda   = useDeferredValue(debouncedBusqueda);
  const deferredBusquedaId = useDeferredValue(debouncedBusquedaId);

  // ===== Helpers de ID =====
  const getId = (c) => String(c?.id_socio ?? c?.idSocio ?? c?.idsocio ?? c?.id ?? '');
  const getIdNumber = (c) => {
    const n = Number(getId(c));
    return Number.isFinite(n) ? n : null;
  };
  const equalId = (c, needle) => {
    if (!needle.trim()) return true;
    const a = Number(getId(c));
    const b = Number(needle);
    if (Number.isNaN(a) || Number.isNaN(b)) return false;
    return a === b;
  };

  // =========================
  // Carga de LISTAS
  // =========================
  const fetchListas = useCallback(async () => {
    const listasCache = cacheRef.current.listas;
    if (listasCache.data && isFresh(listasCache.ts)) {
      const d = listasCache.data;
      setMediosPago(d.mediosPago);
      setPeriodos(d.periodos);
      setEstados(d.estados);
      return;
    }
    const dataListas = await api.get('/api.php?action=listas');
    if (dataListas?.exito) {
      const medios = (dataListas.listas.cobradores || []).map((c) => c.nombre);
      const pers = (dataListas.listas.periodos || []).map((p) => ({ id: p.id, nombre: p.nombre }));
      const ests = (dataListas.listas.estados || []).map((e) => e.descripcion);
      cacheRef.current.listas = {
        data: { mediosPago: medios, periodos: pers, estados: ests },
        ts: Date.now(),
      };
      setMediosPago(medios);
      setPeriodos(pers);
      setEstados(ests);
    }
  }, []);

  // ===================================
  // Carga de CUOTAS
  // ===================================
  const applyVisibleData = useCallback((arr, { resetScroll = false } = {}) => {
    startTransition(() => setCuotas(arr));
    if (resetScroll) scrollToTopSafe();
  }, [scrollToTopSafe, startTransition]);

  const fetchCuotas = useCallback(
    async (estadoPago, periodoId, { force = false, setAsVisible = false, resetScroll = false } = {}) => {
      if (!periodoId) {
        if (setAsVisible) applyVisibleData([], { resetScroll });
        return [];
      }
      const key = getCuotasKey(estadoPago, periodoId);
      const cached = cacheRef.current.cuotas[key];

      if (!force && cached && isFresh(cached.ts)) {
        if (setAsVisible) applyVisibleData(cached.data, { resetScroll });
        return cached.data;
      }

      let qs = '';
      if (estadoPago === 'pagado') qs = '&pagados=1';
      else if (estadoPago === 'condonado') qs = '&condonados=1';
      if (periodoId) qs += `&id_periodo=${encodeURIComponent(periodoId)}`;

      try {
        const dataCuotas = await api.get(`/api.php?action=cuotas${qs}`);
        const arr = dataCuotas?.exito ? (dataCuotas.cuotas || []) : [];
        cacheRef.current.cuotas[key] = { data: arr, ts: Date.now() };
        if (setAsVisible) applyVisibleData(arr, { resetScroll });
        return arr;
      } catch (e) {
        console.error('Error al obtener cuotas:', e);
        cacheRef.current.cuotas[key] = { data: [], ts: Date.now() };
        if (setAsVisible) applyVisibleData([], { resetScroll });
        return [];
      }
    },
    [getCuotasKey, applyVisibleData]
  );

  const fetchCuotasAll = useCallback(
    async (periodoId, { force = false } = {}) => {
      if (!periodoId) return;
      await Promise.all([
        fetchCuotas('deudor', periodoId, { force }),
        fetchCuotas('pagado', periodoId, { force }),
        fetchCuotas('condonado', periodoId, { force }),
      ]);
      bumpCacheVersion();
    },
    [fetchCuotas, bumpCacheVersion]
  );

  // Invalidación tras mutaciones
  const invalidateCuotas = useCallback(
    (estadoPago, periodoId) => {
      const key = getCuotasKey(estadoPago, periodoId);
      delete cacheRef.current.cuotas[key];
      bumpCacheVersion();
    },
    [getCuotasKey, bumpCacheVersion]
  );

  // ========== Efectos ==========
  useEffect(() => {
    fetchListas();
  }, [fetchListas]);

  const setVisibleFromCache = useCallback((estado, periodoId, { resetScroll = true } = {}) => {
    const key = getCuotasKey(estado, periodoId);
    const entry = cacheRef.current.cuotas[key];
    const data = entry && isFresh(entry.ts) ? entry.data : [];
    applyVisibleData(data, { resetScroll });
  }, [getCuotasKey, applyVisibleData]);

  const periodFullyCachedFresh = useCallback((periodoId) => {
    if (!periodoId) return false;
    const ok = (estado) => {
      const key = getCuotasKey(estado, periodoId);
      const entry = cacheRef.current.cuotas[key];
      return entry && isFresh(entry.ts);
    };
    return ok('deudor') && ok('pagado') && ok('condonado');
  }, [getCuotasKey]);

  // (A) Cambio de PERÍODO
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!periodoSeleccionado) {
        applyVisibleData([], { resetScroll: true });
        return;
      }

      if (periodFullyCachedFresh(periodoSeleccionado)) {
        setVisibleFromCache(estadoPagoSeleccionado, periodoSeleccionado, { resetScroll: true });
        return;
      }

      const keySel = getCuotasKey(estadoPagoSeleccionado, periodoSeleccionado);
      const cachedSel = cacheRef.current.cuotas[keySel];
      if (cachedSel && isFresh(cachedSel.ts)) {
        setVisibleFromCache(estadoPagoSeleccionado, periodoSeleccionado, { resetScroll: true });
      } else {
        setLoading(true);
      }

      const myOpId = ++currentOpIdRef.current;
      try {
        await fetchCuotasAll(periodoSeleccionado, { force: false });
        if (cancelled) return;
        if (myOpId === currentOpIdRef.current) {
          setVisibleFromCache(estadoPagoSeleccionado, periodoSeleccionado, { resetScroll: true });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodoSeleccionado]);

  // (B) Cambio de pestaña de ESTADO DE PAGO
  useEffect(() => {
    if (!periodoSeleccionado) {
      applyVisibleData([], { resetScroll: true });
      return;
    }
    const key = getCuotasKey(estadoPagoSeleccionado, periodoSeleccionado);
    const cached = cacheRef.current.cuotas[key];
    if (cached && isFresh(cached.ts)) {
      setVisibleFromCache(estadoPagoSeleccionado, periodoSeleccionado, { resetScroll: true });
      return;
    }
    fetchCuotas(estadoPagoSeleccionado, periodoSeleccionado, {
      force: false,
      setAsVisible: true,
      resetScroll: true,
    }).then(() => bumpCacheVersion()).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estadoPagoSeleccionado]);

  // =========================
  // Filtrado y ordenamiento
  // =========================
  const cuotasFiltradas = useMemo(() => {
    if (!periodoSeleccionado) return [];
    const lista = cuotas
      .filter(
        (c) =>
          String(c.id_periodo) === String(periodoSeleccionado) ||
          c.id_periodo === null
      )
      .filter((c) => {
        const coincideBusqueda =
          debouncedBusqueda === '' ||
          c.nombre?.toLowerCase().includes(debouncedBusqueda.toLowerCase()) ||
          c.domicilio?.toLowerCase().includes(debouncedBusqueda.toLowerCase()) ||
          c.documento?.toLowerCase().includes(debouncedBusqueda.toLowerCase());
        const coincideId = equalId(c, debouncedBusquedaId);
        const coincideEstadoSocio =
          estadoSocioSeleccionado === '' || c.estado === estadoSocioSeleccionado;
        const coincideMedio =
          medioPagoSeleccionado === '' || c.medio_pago === medioPagoSeleccionado;
        const coincideEstadoPago =
          estadoPagoSeleccionado === '' || c.estado_pago === estadoPagoSeleccionado;

        return (
          coincideBusqueda &&
          coincideId &&
          coincideEstadoSocio &&
          coincideMedio &&
          coincideEstadoPago
        );
      });

    return lista.sort((a, b) => {
      if (orden.campo === 'id') {
        const ida = getIdNumber(a);
        const idb = getIdNumber(b);
        if (ida === null && idb === null) return 0;
        if (ida === null) return 1;
        if (idb === null) return -1;
        return orden.ascendente ? ida - idb : idb - ida;
      }
      if (orden.campo === 'domicilio') {
        const A = a.domicilio || '';
        const B = b.domicilio || '';
        return orden.ascendente ? A.localeCompare(B) : B.localeCompare(A);
      }
      const A = a.nombre || '';
      const B = b.nombre || '';
      return orden.ascendente ? A.localeCompare(B) : B.localeCompare(A);
    });
  }, [
    cuotas,
    debouncedBusqueda,
    debouncedBusquedaId,
    estadoSocioSeleccionado,
    medioPagoSeleccionado,
    periodoSeleccionado,
    estadoPagoSeleccionado,
    orden
  ]);

  /* ================================
   * Contadores
   * ================================ */
  const getCachedListFor = useCallback(
    (estadoFijo) => {
      if (!periodoSeleccionado) return [];
      const key = getCuotasKey(estadoFijo, periodoSeleccionado);
      const entry = cacheRef.current.cuotas[key];
      return entry && isFresh(entry.ts) ? entry.data : [];
    },
    [getCuotasKey, periodoSeleccionado]
  );

  const countsReady = useMemo(() => {
    if (!periodoSeleccionado) return false;
    const has = (estado) => {
      const key = getCuotasKey(estado, periodoSeleccionado);
      const entry = cacheRef.current.cuotas[key];
      return !!(entry && isFresh(entry.ts));
    };
    return has('deudor') && has('pagado') && has('condonado');
  }, [periodoSeleccionado, cacheVersion, getCuotasKey]);

  const contadorTabs = useMemo(() => {
    if (!periodoSeleccionado) return { deudor: 0, pagado: 0, condonado: 0 };

    const listaDeu  = getCachedListFor('deudor');
    const listaPag  = getCachedListFor('pagado');
    const listaCond = getCachedListFor('condonado');

    const filtrar = (lista, estadoFijo) => {
      return lista
        .filter(
          (c) =>
            (String(c.id_periodo) === String(periodoSeleccionado) || c.id_periodo === null) &&
            c.estado_pago === estadoFijo
        )
        .filter((c) => {
          const q = (c.nombre || '').toLowerCase();
          const dom = (c.domicilio || '').toLowerCase();
          const doc = (c.documento || '').toLowerCase();

          const coincideBusqueda =
            deferredBusqueda === '' ||
            q.includes(deferredBusqueda.toLowerCase()) ||
            dom.includes(deferredBusqueda.toLowerCase()) ||
            doc.includes(deferredBusqueda.toLowerCase());

          const coincideId = equalId(c, deferredBusquedaId);
          const coincideEstadoSocio =
            estadoSocioSeleccionado === '' || c.estado === estadoSocioSeleccionado;
          const coincideMedio =
            medioPagoSeleccionado === '' || c.medio_pago === medioPagoSeleccionado;

          return coincideBusqueda && coincideId && coincideEstadoSocio && coincideMedio;
        }).length;
    };

    return {
      deudor: filtrar(listaDeu, 'deudor'),
      pagado: filtrar(listaPag, 'pagado'),
      condonado: filtrar(listaCond, 'condonado'),
    };
  }, [
    periodoSeleccionado,
    getCachedListFor,
    deferredBusqueda,
    deferredBusquedaId,
    estadoSocioSeleccionado,
    medioPagoSeleccionado,
    cacheVersion
  ]);

  const toggleOrden = (campo) => {
    setOrden((prev) => ({
      campo,
      ascendente: prev.campo === campo ? !prev.ascendente : true,
    }));
  };

  // ===== helpers período para impresión única =====
  const limpiarPrefijoPeriodo = (txt = '') =>
    String(txt).replace(/^\s*per[ií]odo?s?\s*:?\s*/i, '').trim();

  const construirPeriodoTexto = useCallback(
    (ids) => {
      const ordenados = [...ids].sort((a, b) => Number(a) - Number(b));
      const partes = ordenados.map((id) => {
        const p = periodos.find((pp) => String(pp.id) === String(id));
        if (!p) return String(id);
        return limpiarPrefijoPeriodo(p.nombre)
          .replace(/\s*[yY]\s*/g, '/')
          .replace(/\s+/g, '')
          .replace(/\/+/g, '/');
      });
      return partes.join(' ');
    },
    [periodos]
  );

  const primerIdSeleccionado = (ids) =>
    ids.length ? String([...ids].sort((a, b) => Number(a) - Number(b))[0]) : '0';

  const getAnualPeriodo = useCallback(
    () => periodos.find((p) => String(p?.nombre || '').toUpperCase().includes('ANUAL')) || null,
    [periodos]
  );

  const calcularImportePorSeleccion = useCallback(
    (idsSeleccion) => {
      if (!idsSeleccion || idsSeleccion.length === 0) return 0;
      const anual = getAnualPeriodo();
      const idsStr = idsSeleccion.map(String);
      const esSoloAnual = anual && idsStr.length === 1 && idsStr[0] === String(anual.id);
      if (esSoloAnual) return PRECIO_ANUAL_CON_DESCUENTO;
      return idsSeleccion.length * PRECIO_MENSUAL;
    },
    [getAnualPeriodo]
  );

  // =========================
  // Impresión
  // =========================
  const handleAbrirSelectorImpresion = () => {
    setCuotaParaImprimir(null); // impresión masiva
    setPeriodosAImprimir(periodoSeleccionado ? [periodoSeleccionado] : []);
    setImprimirContable(false);
    setMostrarModalSeleccionPeriodos(true);
  };

  const handleImprimirSeleccionados = async () => {
    const ventanaImpresion = window.open('', '_blank');
    if (!ventanaImpresion) {
      alert('Por favor deshabilita el bloqueador de ventanas emergentes para esta página');
      return;
    }

    setLoadingPrint(true);
    try {
      if (imprimirContable) {
        if (cuotaParaImprimir) {
          await imprimirRecibos([cuotaParaImprimir], null, ventanaImpresion, true);
        } else {
          const lista = cuotasFiltradas;
          if (lista.length > 0) await imprimirRecibos(lista, null, ventanaImpresion, true);
        }
      } else if (periodosAImprimir.length > 0) {
        const listaOrdenada = [...periodosAImprimir].sort((a, b) => Number(a) - Number(b));
        const importeTotal = calcularImportePorSeleccion(listaOrdenada);

        if (cuotaParaImprimir) {
          const socioConPeriodos = {
            ...cuotaParaImprimir,
            id_periodo: primerIdSeleccionado(listaOrdenada),
            periodo_texto: construirPeriodoTexto(listaOrdenada),
            importe_total: importeTotal,
          };
          await imprimirRecibosUnicos([socioConPeriodos], socioConPeriodos.id_periodo, ventanaImpresion);
        } else {
          const listaEnriquecida = cuotasFiltradas.map((c) => ({
            ...c,
            id_periodo: primerIdSeleccionado(listaOrdenada),
            periodo_texto: construirPeriodoTexto(listaOrdenada),
            importe_total: importeTotal,
          }));
          if (listaEnriquecida.length > 0) {
            await imprimirRecibosUnicos(listaEnriquecida, primerIdSeleccionado(listaOrdenada), ventanaImpresion);
          }
        }
      }
    } catch (error) {
      console.error('Error al imprimir:', error);
      ventanaImpresion.close();
    } finally {
      setLoadingPrint(false);
      setCuotaParaImprimir(null);
      setMostrarModalSeleccionPeriodos(false);
    }
  };

  // =========================
  // Acciones de filtros
  // =========================
  const limpiarFiltros = () => {
    setBusqueda('');
    setBusquedaId('');
    setEstadoSocioSeleccionado('');
    setMedioPagoSeleccionado('');
    setToastTipo('exito');
    setToastMensaje('Filtros limpiados correctamente');
    setToastVisible(true);
  };
  const toggleFiltros = () => setFiltrosExpandidos((s) => !s);

  // =========================
  // Fila virtualizada
  // =========================
  const Row = ({ index, style, data }) => {
    const cuota = data[index];

    const claseEstadoSocio =
      {
        activo: 'cuo_estado-activo',
        pasivo: 'cuo_estado-pasivo',
      }[cuota.estado?.toLowerCase()] || 'cuo_badge-warning';

    const claseMedioPago =
      {
        cobrador: 'cuo_pago-cobrador',
        oficina: 'cuo_pago-oficina',
        transferencia: 'cuo_pago-transferencia',
      }[cuota.medio_pago?.toLowerCase()] || 'cuo_badge-warning';

    return (
      <div
        style={style}
        className={`cuo_tabla-fila cuo_grid-container ${index % 2 === 0 ? 'cuo_fila-par' : 'cuo_fila-impar'}`}
      >
        <div className="cuo_col-id">{getId(cuota) || '-'}</div>

        <div className="cuo_col-nombre">
          <div className="cuo_nombre-socio">{cuota.nombre}</div>
          {cuota.documento && <div className="cuo_documento">Doc: {cuota.documento}</div>}
        </div>

        <div className="cuo_col-domicilio">{cuota.domicilio || '-'}</div>

        {/* SOLO estado del socio (Activo/Pasivo) */}
        <div className="cuo_col-estado">
          <span className={`cuo_badge ${claseEstadoSocio}`} title="Estado del socio">
            {cuota.estado}
          </span>
        </div>

        {/* Medio de pago: Cobrador/Oficina/Transferencia */}
        <div className="cuo_col-medio-pago">
          <span className={`cuo_badge ${claseMedioPago}`}>{cuota.medio_pago || 'Sin especificar'}</span>
        </div>

        <div className="cuo_col-acciones">
          <div className="cuo_acciones-cell">
            {estadoPagoSeleccionado === 'deudor' ? (
              <button
                className="cuo_boton-accion cuo_boton-accion-success"
                onClick={() => {
                  setSocioParaPagar(cuota);
                  setMostrarModalPagos(true);
                }}
                title="Registrar pago / condonar"
              >
                <FaDollarSign />
              </button>
            ) : estadoPagoSeleccionado === 'pagado' ? (
              <button
                className="cuo_boton-accion cuo_boton-accion-danger"
                onClick={() => {
                  setSocioParaPagar(cuota);
                  setMostrarModalEliminarPago(true);
                }}
                title="Eliminar pago"
              >
                <FaTimes />
              </button>
            ) : (
              <button
                className="cuo_boton-accion cuo_boton-accion-danger"
                onClick={() => {
                  setSocioParaPagar(cuota);
                  setMostrarModalEliminarCond(true);
                }}
                title="Eliminar condonación"
              >
                <FaTimes />
              </button>
            )}

            {/* Imprimir: abre el modal de selección de períodos para ESTE socio */}
            <button
              className="cuo_boton-accion cuo_boton-accion-primary"
              onClick={() => {
                setCuotaParaImprimir(cuota);
                setPeriodosAImprimir(periodoSeleccionado ? [periodoSeleccionado] : []);
                setImprimirContable(false);
                setMostrarModalSeleccionPeriodos(true);
              }}
              title="Imprimir recibo"
            >
              <FaPrint />
            </button>
          </div>
        </div>
      </div>
    );
  };

  // =========================
  // Utilidad de UI
  // =========================
  const getNombrePeriodo = (id) => {
    const periodo = periodos.find((p) => String(p.id) === String(id));
    return periodo ? periodo.nombre : id;
  };

  // =========================
  // Render
  // =========================
  // Helper: detectar si el pago mostrado es ANUAL (por período o por flags del socio)
  const anualRef = getAnualPeriodo();
  const idAnual = anualRef?.id ?? '7'; // fallback por si acaso

  return (
    <div className="cuo_app-container">
      <div className={`cuo_filtros-panel ${!filtrosExpandidos ? 'cuo_filtros-colapsado' : ''}`}>
        <div className="cuo_filtros-header">
          <h3 className="cuo_filtros-titulo">
            <FaFilter className="cuo_filtro-icono" />
            Filtros Avanzados
          </h3>
          <div className="cuo_filtros-controles">
            <button
              className="cuo_boton cuo_boton-icono cuo_boton-toggle-horizontal"
              onClick={toggleFiltros}
              title={filtrosExpandidos ? 'Ocultar filtros' : 'Mostrar filtros'}
            >
              {filtrosExpandidos ? <FiChevronLeft /> : <FiChevronRight />}
            </button>
          </div>
        </div>

        {filtrosExpandidos && (
          <>
            <div className="cuo_filtro-grupo">
              <label className="cuo_filtro-label">
                <FaCalendarAlt className="cuo_filtro-icono" />
                Período
              </label>
              <select
                value={periodoSeleccionado}
                onChange={(e) => setPeriodoSeleccionado(e.target.value)}
                className="cuo_filtro-select"
                disabled={loading}
              >
                <option value="">Seleccionar período</option>
                {periodos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="cuo_tabs-container">
              <label className="cuo_filtro-label">
                <FaFilter className="cuo_filtro-icono" />
                Estado de Pago
              </label>
              <div className="cuo_tabs-estado-pago">
                <button
                  className={`cuo_tab ${estadoPagoSeleccionado === 'deudor' ? 'cuo_tab-activo' : ''}`}
                  onClick={() => setEstadoPagoSeleccionado('deudor')}
                  disabled={loading}
                  title="Deudores"
                >
                  <FaTimesCircle style={{ marginRight: 6, color: '#dc2626' }} />
                  <span>
                    {periodoSeleccionado
                      ? (countsReady ? `(${contadorTabs.deudor})` : <FaSpinner size={12} className="cuo_spinner" />)
                      : '(0)'}
                  </span>
                </button>

                <button
                  className={`cuo_tab ${estadoPagoSeleccionado === 'pagado' ? 'cuo_tab-activo' : ''}`}
                  onClick={() => setEstadoPagoSeleccionado('pagado')}
                  disabled={loading}
                  title="Pagados"
                >
                  <FaCheckCircle style={{ marginRight: 6, color: '#16a34a' }} />
                  <span>
                    {periodoSeleccionado
                      ? (countsReady ? `(${contadorTabs.pagado})` : <FaSpinner size={12} className="cuo_spinner" />)
                      : '(0)'}
                  </span>
                </button>

                <button
                  className={`cuo_tab ${estadoPagoSeleccionado === 'condonado' ? 'cuo_tab-activo' : ''}`}
                  onClick={() => setEstadoPagoSeleccionado('condonado')}
                  disabled={loading}
                  title="Condonados"
                >
                  <FaExclamationTriangle style={{ marginRight: 6, color: '#f59e0b' }} />
                  <span>
                    {periodoSeleccionado
                      ? (countsReady ? `(${contadorTabs.condonado})` : <FaSpinner size={12} className="cuo_spinner" />)
                      : '(0)'}
                  </span>
                </button>
              </div>
            </div>

            <div className="cuo_filtro-grupo">
              <label className="cuo_filtro-label">
                <FaFilter className="cuo_filtro-icono" />
                Estado del Socio
              </label>
              <select
                value={estadoSocioSeleccionado}
                onChange={(e) => setEstadoSocioSeleccionado(e.target.value)}
                className="cuo_filtro-select"
                disabled={loading}
              >
                <option value="">Todos los estados</option>
                {estados.map((estado, i) => (
                  <option key={i} value={estado}>
                    {estado}
                  </option>
                ))}
              </select>
            </div>

            <div className="cuo_filtro-grupo">
              <label className="cuo_filtro-label">
                <FaFilter className="cuo_filtro-icono" />
                Medio de Pago
              </label>
              <select
                value={medioPagoSeleccionado}
                onChange={(e) => setMedioPagoSeleccionado(e.target.value)}
                className="cuo_filtro-select"
                disabled={loading}
              >
                <option value="">Todos los medios</option>
                {mediosPago.map((m, i) => (
                  <option key={i} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div className="cuo_filtro-acciones">
              <button className="cuo_boton cuo_boton-light cuo_boton-limpiar" onClick={limpiarFiltros} disabled={loading}>
                Limpiar Filtros
              </button>
              <button className="cuo_boton cuo_boton-secondary" onClick={() => navigate('/panel')} disabled={loading}>
                <FaUndo style={{ marginRight: '5px' }} /> Volver
              </button>
            </div>
          </>
        )}
      </div>

      {!filtrosExpandidos && (
        <button className="cuo_boton-flotante-abrir cuo_flotante-fuera" onClick={toggleFiltros} title="Mostrar filtros">
          <FiChevronRight size={20} />
        </button>
      )}

      <div className="cuo_main-content">
        <div className="cuo_content-header">
          <div className="cuo_header-top">
            <h2 className="cuo_content-title">
              Gestión de Cuotas
              {periodoSeleccionado && (
                <>
                  <span className="cuo_periodo-seleccionado"> - {getNombrePeriodo(periodoSeleccionado)}</span>
                  {({
                    deudor: 'Deudores',
                    pagado: 'Pagados',
                    condonado: 'Condonados',
                  }[estadoPagoSeleccionado] || '') && <span className="cuo_periodo-seleccionado"> — {({
                    deudor: 'Deudores',
                    pagado: 'Pagados',
                    condonado: 'Condonados',
                  }[estadoPagoSeleccionado] || '')}</span>}
                </>
              )}
            </h2>

            <div className="cuo_contador-socios">
              <div className="cuo_contador-icono">
                <FaUsers />
              </div>
              <div className="cuo_contador-texto">
                {cuotasFiltradas.length} {cuotasFiltradas.length === 1 ? 'socio' : 'socios'}
              </div>
            </div>
          </div>

          <div className="cuo_header-bottom">
            <div className="conteiner-buscador">
              <div className="cuo_buscador-container">
                {busqueda ? (
                  <button
                    className="cuo_buscador-clear"
                    onClick={() => {
                      setBusqueda('');
                    }}
                    title="Limpiar búsqueda"
                  >
                    <FaTimes />
                  </button>
                ) : (
                  <FaSearch className="cuo_buscador-icono" />
                )}
                <input
                  type="text"
                  placeholder="Buscar socio por nombre, documento o dirección..."
                  value={busqueda}
                  onChange={(e) => {
                    const val = e.target.value;
                    setBusqueda(val);
                    if (val !== '') setBusquedaId('');
                  }}
                  className="cuo_buscador-input"
                  disabled={loading}
                />
              </div>

              <div className="cuo_buscador-id-wrapper">
                {busquedaId ? (
                  <button
                    className="cuo_buscador-clear"
                    onClick={() => {
                      setBusquedaId('');
                    }}
                    title="Limpiar ID"
                  >
                    <FaTimes />
                  </button>
                ) : (
                  <FaSearch className="cuo_buscador-id-icono" />
                )}
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="ID"
                  value={busquedaId}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    setBusquedaId(val);
                    if (val !== '') setBusqueda('');
                  }}
                  className="cuo_buscador-id"
                  disabled={loading}
                  title="Buscar por ID"
                />
              </div>
            </div>

            <div className="cuo_content-actions">
              <button className="cuo_boton cuo_boton-success" onClick={() => setMostrarModalCodigoBarras(true)} disabled={loading}>
                <FaBarcode /> Código de Barras
              </button>

              <button
                className={`cuo_boton cuo_boton-primary ${loadingPrint ? 'cuo_boton-loading' : ''}`}
                onClick={handleAbrirSelectorImpresion}
                disabled={loadingPrint || periodos.length === 0 || loading}
              >
                {loadingPrint ? (
                  <>
                    <FaSpinner className="cuo_boton-spinner" /> Generando cupones...
                  </>
                ) : (
                  <>
                    <FaPrint /> Imprimir todos
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="cuo_tabla-container">
          <div className="cuo_tabla-wrapper">
            <div className="cuo_tabla-header cuo_grid-container">
              <div className="cuo_col-id cuo_col-clickable" onClick={() => toggleOrden('id')} title="Ordenar por ID">
                ID
                <FaSort className={`cuo_icono-orden ${orden.campo === 'id' ? 'cuo_icono-orden-activo' : ''}`} />
                {orden.campo === 'id' && (orden.ascendente ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />)}
              </div>

              <div className="cuo_col-nombre cuo_col-clickable" onClick={() => toggleOrden('nombre')} title="Ordenar por nombre">
                Socio
                <FaSort className={`cuo_icono-orden ${orden.campo === 'nombre' ? 'cuo_icono-orden-activo' : ''}`} />
                {orden.campo === 'nombre' && (orden.ascendente ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />)}
              </div>

              <div className="cuo_col-domicilio cuo_col-clickable" onClick={() => toggleOrden('domicilio')} title="Ordenar por dirección">
                Dirección
                <FaSort className={`cuo_icono-orden ${orden.campo === 'domicilio' ? 'cuo_icono-orden-activo' : ''}`} />
                {orden.campo === 'domicilio' && (orden.ascendente ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />)}
              </div>

              <div className="cuo_col-estado">Estado</div>
              <div className="cuo_col-medio-pago">Medio de Pago</div>
              <div className="cuo_col-acciones">Acciones</div>
            </div>

            <div className="cuo_list-container">
              {loading && periodoSeleccionado ? (
                <div className="cuo_estado-container">
                  <FaSpinner className="cuo_spinner" size={24} />
                  <p className="cuo_estado-mensaje">Cargando cuotas...</p>
                </div>
              ) : !loading && cuotasFiltradas.length === 0 ? (
                <div className="cuo_estado-container">
                  <p className="cuo_estado-mensaje">
                    {periodoSeleccionado
                      ? 'No se encontraron resultados con los filtros actuales'
                      : 'Seleccione un período para mostrar las cuotas'}
                  </p>
                </div>
              ) : (
                <AutoSizer>
                  {({ height, width }) => {
                    const OuterElement = React.forwardRef((props, ref) => (
                      <div ref={ref} {...props} style={{ ...props.style, overflowX: 'hidden' }} />
                    ));
                    return (
                      <List
                        ref={listRef}
                        height={height}
                        itemCount={cuotasFiltradas.length}
                        itemSize={60}
                        width={width}
                        itemData={cuotasFiltradas}
                        outerElementType={OuterElement}
                      >
                        {Row}
                      </List>
                    );
                  }}
                </AutoSizer>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ===== Modales ===== */}
      {mostrarModalPagos && (
        <ModalPagos
          socio={socioParaPagar}
          onClose={async (refetch) => {
            setMostrarModalPagos(false);
            if (refetch) {
              cacheRef.current.mutationTs = Date.now();
              invalidateCuotas('deudor', periodoSeleccionado);
              invalidateCuotas('pagado', periodoSeleccionado);
              invalidateCuotas('condonado', periodoSeleccionado);
              await fetchCuotasAll(periodoSeleccionado, { force: true });
              await fetchCuotas(estadoPagoSeleccionado, periodoSeleccionado, {
                force: true,
                setAsVisible: true,
                resetScroll: false,
              });
            }
          }}
        />
      )}

      {mostrarModalCodigoBarras && (
        <ModalCodigoBarras
          onClose={() => setMostrarModalCodigoBarras(false)}
          periodo={getNombrePeriodo(periodoSeleccionado)}
          periodoId={periodoSeleccionado}
          onPagoRealizado={async () => {
            cacheRef.current.mutationTs = Date.now();
            invalidateCuotas('deudor', periodoSeleccionado);
            invalidateCuotas('pagado', periodoSeleccionado);
            invalidateCuotas('condonado', periodoSeleccionado);
            await fetchCuotasAll(periodoSeleccionado, { force: true });
            await fetchCuotas(estadoPagoSeleccionado, periodoSeleccionado, {
              force: true,
              setAsVisible: true,
              resetScroll: false,
            });
          }}
        />
      )}

      {mostrarModalEliminarPago && (
        <ModalEliminarPago
          socio={socioParaPagar}
          periodo={periodoSeleccionado}
          periodoTexto={getNombrePeriodo(periodoSeleccionado)}
          // >>> PASAMOS esPagoAnual para que muestre el aviso si corresponde:
          esPagoAnual={
            // 1) Si estamos parados en el período ANUAL
            String(periodoSeleccionado) === String(idAnual)
            // 2) O si la cuota mostrada proviene/está marcada como pago anual (del backend u otros flags)
            || Boolean(
              socioParaPagar?.origen_anual ||            // <- campo que devuelve el endpoint /cuotas
              socioParaPagar?.es_pago_anual ||
              socioParaPagar?.pago_anual ||
              (socioParaPagar?.origen_pago && String(socioParaPagar.origen_pago).toLowerCase().includes('anual')) ||
              (socioParaPagar?.periodo_origen && String(socioParaPagar.periodo_origen).toLowerCase().includes('anual'))
            )
          }
          onClose={() => setMostrarModalEliminarPago(false)}
          onEliminado={async () => {
            cacheRef.current.mutationTs = Date.now();
            invalidateCuotas('pagado', periodoSeleccionado);
            invalidateCuotas('deudor', periodoSeleccionado);
            invalidateCuotas('condonado', periodoSeleccionado);
            await fetchCuotasAll(periodoSeleccionado, { force: true });
            await fetchCuotas(estadoPagoSeleccionado, periodoSeleccionado, {
              force: true,
              setAsVisible: true,
              resetScroll: false,
            });
          }}
        />
      )}

      {mostrarModalEliminarCond && (
        <ModalEliminarCondonacion
          socio={socioParaPagar}
          periodo={periodoSeleccionado}
          periodoTexto={getNombrePeriodo(periodoSeleccionado)}
          onClose={() => setMostrarModalEliminarCond(false)}
          onEliminado={async () => {
            cacheRef.current.mutationTs = Date.now();
            invalidateCuotas('condonado', periodoSeleccionado);
            invalidateCuotas('deudor', periodoSeleccionado);
            invalidateCuotas('pagado', periodoSeleccionado);
            await fetchCuotasAll(periodoSeleccionado, { force: true });
            await fetchCuotas(estadoPagoSeleccionado, periodoSeleccionado, {
              force: true,
              setAsVisible: true,
              resetScroll: false,
            });
          }}
        />
      )}

      {/* Modal de selección de períodos para imprimir */}
      {mostrarModalSeleccionPeriodos && (
        <ModalMesCuotas
          periodos={periodos}
          seleccionados={periodosAImprimir}
          onSeleccionadosChange={(nuevosSeleccionados) => {
            setPeriodosAImprimir(nuevosSeleccionados);
            if (nuevosSeleccionados.length > 0) setImprimirContable(false);
          }}
          onCancelar={() => {
            setCuotaParaImprimir(null);
            setMostrarModalSeleccionPeriodos(false);
          }}
          onImprimir={handleImprimirSeleccionados}
        />
      )}

      {toastVisible && (
        <Toast tipo={toastTipo} mensaje={toastMensaje} duracion={3000} onClose={() => setToastVisible(false)} />
      )}
    </div>
  );
};

export default Cuotas;
