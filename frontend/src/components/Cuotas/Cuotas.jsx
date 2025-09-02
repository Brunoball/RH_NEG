// src/components/Cuotas/Cuotas.jsx
import React, {
  useEffect,
  useState,
  useMemo,
  useRef,
  useCallback,
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
  FaFileExcel,                // ⬅️ NUEVO (icono Excel)
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
import * as XLSX from 'xlsx'; // ⬅️ NUEVO (exportar Excel)

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
const ID_CONTADO_ANUAL_FALLBACK = 7;

/* =========================
 * Helpers de año/periodo
 * ========================= */
const currentYear = new Date().getFullYear();
const nextYear = currentYear + 1;

// Intenta extraer un año (YYYY) del nombre del periodo (p.ej. "Enero 2025")
const extractYearFromPeriodoName = (nombre = '') => {
  const m = String(nombre).match(/(20\d{2})/);
  return m ? parseInt(m[1], 10) : null;
};

// Normalizador para detectar “ANUAL” por nombre
const normalize = (s = '') =>
  String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
const isAnualName = (nombre = '') => normalize(nombre).includes('ANUAL');

/* =========================
 * Row memoizado (estable)
 * ========================= */
const Row = React.memo(function Row({ index, style, data }) {
  const { items, estadoPagoSeleccionado, getId } = data;
  const cuota = items[index];

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
              onClick={data.onPagar(cuota)}
              title="Registrar pago / condonar"
            >
              <FaDollarSign />
            </button>
          ) : estadoPagoSeleccionado === 'pagado' ? (
            <button
              className="cuo_boton-accion cuo_boton-accion-danger"
              onClick={data.onEliminarPago(cuota)}
              title="Eliminar pago"
            >
              <FaTimes />
            </button>
          ) : (
            <button
              className="cuo_boton-accion cuo_boton-accion-danger"
              onClick={data.onEliminarCondonacion(cuota)}
              title="Eliminar condonación"
            >
              <FaTimes />
            </button>
          )}

          {/* Imprimir: abre el modal de selección de períodos para ESTE socio */}
          <button
            className="cuo_boton-accion cuo_boton-accion-primary"
            onClick={data.onImprimir(cuota)}
            title="Imprimir recibo"
          >
            <FaPrint />
          </button>
        </div>
      </div>
    </div>
  );
});

/* =========================
 * Lista virtualizada memo
 * ========================= */
const CuotasList = React.memo(function CuotasList({
  items,
  estadoPagoSeleccionado,
  onPagar,
  onEliminarPago,
  onEliminarCondonacion,
  onImprimir,
  listRef,
  getId
}) {
  // Ocultar overflow-x
  const OuterElement = React.useMemo(
    () =>
      React.forwardRef((props, ref) => (
        <div ref={ref} {...props} style={{ ...props.style, overflowX: 'hidden' }} />
      )),
    []
  );

  const itemData = useMemo(
    () => ({
      items,
      estadoPagoSeleccionado,
      onPagar,
      onEliminarPago,
      onEliminarCondonacion,
      onImprimir,
      getId,
    }),
    [items, estadoPagoSeleccionado, onPagar, onEliminarPago, onEliminarCondonacion, onImprimir, getId]
  );

  const itemKey = useCallback((index, data) => {
    const it = data.items[index];
    return it ? (it._idnum ?? getId(it) ?? index) : index;
  }, [getId]);

  return (
    <AutoSizer>
      {({ height, width }) => (
        <List
          ref={listRef}
          height={height}
          itemCount={items.length}
          itemSize={60}
          width={width}
          itemData={itemData}
          outerElementType={OuterElement}
          itemKey={itemKey}
          overscanCount={2}
        >
          {Row}
        </List>
      )}
    </AutoSizer>
  );
});

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

  // Año y lista de años (del backend según pagos reales)
  const [anioSeleccionado, setAnioSeleccionado] = useState('');
  const [anios, setAnios] = useState([]); // arr de números

  const [mediosPago, setMediosPago] = useState([]);
  const [periodos, setPeriodos] = useState([]); // [{id, nombre, anio?}]
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
    cuotas: {},           // clave: "anio|estado|periodo" => {data, ts}
    listas: { data: null, ts: 0 },
  });
  const [cacheVersion, setCacheVersion] = useState(0);
  const bumpCacheVersion = useCallback(() => setCacheVersion((v) => v + 1), []);

  // Control de operaciones para ignorar respuestas viejas
  const currentOpIdRef = useRef(0);

  // flag para evitar solapes entre cargas
  const isFetchingAllRef = useRef(false);

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

  // ⬇️ La key de cuotas incluye el año seleccionado
  const getCuotasKey = useCallback(
    (estadoPago, periodoId) => `${anioSeleccionado || 'NOYEAR'}|${estadoPago}|${periodoId || 'NO_PERIODO'}`,
    [anioSeleccionado]
  );

  // ===== Helpers de ID (usan campos normalizados) =====
  const getId = (c) => String(c?.id_socio ?? c?.idSocio ?? c?.idsocio ?? c?.id ?? '');
  const getIdNumber = (c) => (Number.isFinite(c?._idnum) ? c._idnum : null);
  const equalId = (c, needle) => {
    if (!needle.trim()) return true;
    const b = Number(needle);
    if (!Number.isFinite(c?._idnum) || Number.isNaN(b)) return false;
    return c._idnum === b;
  };

  // =========================
  // Carga de LISTAS (no toca años)
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

  // =========================
  // NUEVO: Años con pagos reales
  // =========================
  const fetchAnios = useCallback(async () => {
    try {
      const res = await api.get('/api.php?action=cuotas&listar_anios=1');
      if (res?.exito) {
        const lista = Array.isArray(res.anios) ? res.anios.map((n) => Number(n)).filter(Boolean) : [];
        const final = lista.length > 0 ? lista : [currentYear];
        setAnios(final);
        // Ajustar selección si no pertenece a la lista
        if (!anioSeleccionado || !final.includes(parseInt(anioSeleccionado, 10))) {
          setAnioSeleccionado(String(final[0]));
        }
      }
    } catch (e) {
      console.error('No se pudieron obtener los años:', e);
      if (!anioSeleccionado) setAnioSeleccionado(String(currentYear));
      if (anios.length === 0) setAnios([currentYear]);
    }
  }, [anioSeleccionado, anios.length]);

  // ===================================
  // Carga de CUOTAS
  // ===================================
  const applyVisibleData = useCallback((arr, { resetScroll = false } = {}) => {
    startTransition(() => setCuotas(arr));
    if (resetScroll) scrollToTopSafe();
  }, [scrollToTopSafe, startTransition]);

  const normalizeItems = (arr) =>
    (arr || []).map((c) => {
      const idstr = String(c?.id_socio ?? c?.idSocio ?? c?.idsocio ?? c?.id ?? '');
      const idnum = Number(idstr);
      return {
        ...c,
        _q_nombre: (c.nombre || '').toLowerCase(),
        _q_dom: (c.domicilio || '').toLowerCase(),
        _q_doc: (c.documento || '').toLowerCase(),
        _idnum: Number.isFinite(idnum) ? idnum : null,
      };
    });

  const fetchCuotas = useCallback(
    async (estadoPago, periodoId, { force = false, setAsVisible = false, resetScroll = false } = {}) => {
      // Hasta no tener año seleccionado, no consultamos
      if (!anioSeleccionado) {
        if (setAsVisible) applyVisibleData([], { resetScroll });
        return [];
      }
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
      if (anioSeleccionado) qs += `&anio=${encodeURIComponent(anioSeleccionado)}`;

      try {
        const dataCuotas = await api.get(`/api.php?action=cuotas${qs}`);
        const arr = dataCuotas?.exito ? (dataCuotas.cuotas || []) : [];
        const normalizados = normalizeItems(arr);
        cacheRef.current.cuotas[key] = { data: normalizados, ts: Date.now() };
        if (setAsVisible) applyVisibleData(normalizados, { resetScroll });
        return normalizados;
      } catch (e) {
        console.error('Error al obtener cuotas:', e);
        cacheRef.current.cuotas[key] = { data: [], ts: Date.now() };
        if (setAsVisible) applyVisibleData([], { resetScroll });
        return [];
      }
    },
    [getCuotasKey, applyVisibleData, anioSeleccionado]
  );

  const fetchCuotasAll = useCallback(
    async (periodoId, { force = false } = {}) => {
      if (!periodoId || !anioSeleccionado) return;
      isFetchingAllRef.current = true;
      try {
        await Promise.all([
          fetchCuotas('deudor', periodoId, { force }),
          fetchCuotas('pagado', periodoId, { force }),
          fetchCuotas('condonado', periodoId, { force }),
        ]);
        bumpCacheVersion();
      } finally {
        isFetchingAllRef.current = false;
      }
    },
    [fetchCuotas, bumpCacheVersion, anioSeleccionado]
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
    fetchAnios();           // ⬅️ traemos los años reales de pagos
  }, [fetchListas, fetchAnios]);

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

  // (A) Cambio de PERÍODO o AÑO
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!anioSeleccionado) { applyVisibleData([], { resetScroll: true }); return; }
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
  }, [periodoSeleccionado, anioSeleccionado]);

  // (B) Cambio de pestaña de ESTADO DE PAGO o AÑO
  useEffect(() => {
    if (!anioSeleccionado) { applyVisibleData([], { resetScroll: true }); return; }
    if (!periodoSeleccionado) {
      applyVisibleData([], { resetScroll: true });
      return;
    }
    if (isFetchingAllRef.current) return;

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
  }, [estadoPagoSeleccionado, anioSeleccionado]);

  // =========================
  // Filtrado y ordenamiento
  // =========================
  const q = (busqueda || '').toLowerCase();

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
          q === '' ||
          c._q_nombre.includes(q) ||
          c._q_dom.includes(q) ||
          c._q_doc.includes(q);

        const coincideId = equalId(c, busquedaId);
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
        return orden.ascendente ? a._q_dom.localeCompare(b._q_dom) : b._q_dom.localeCompare(a._q_dom);
      }
      // nombre
      return orden.ascendente ? a._q_nombre.localeCompare(b._q_nombre) : b._q_nombre.localeCompare(a._q_nombre);
    });
  }, [
    cuotas,
    periodoSeleccionado,
    q,
    busquedaId,
    estadoSocioSeleccionado,
    medioPagoSeleccionado,
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
          const coincideBusqueda =
            q === '' ||
            c._q_nombre.includes(q) ||
            c._q_dom.includes(q) ||
            c._q_doc.includes(q);

          const coincideId = equalId(c, busquedaId);
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
    q,
    busquedaId,
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

  // ===== helpers período/importe para impresión =====
  const limpiarPrefijoPeriodo = (txt = '') =>
    String(txt).replace(/^\s*per[ií]odo?s?\s*:?\s*/i, '').trim();

  // IDs de períodos NO anuales (para detectar “6 meses = anual”)
  const getNonAnualIds = useCallback(() => {
    return periodos
      .filter((p) => !isAnualName(p.nombre))
      .map((p) => String(p.id));
  }, [periodos]);

  // Obtiene el período "Anual" (si existe)
  const getAnualPeriodo = useCallback(
    () => periodos.find((p) => isAnualName(p?.nombre || '')) || null,
    [periodos]
  );

  // Construye el texto de período para el comprobante, con AÑO
  const construirPeriodoTexto = useCallback(
    (ids, year) => {
      if (!ids || ids.length === 0) return '';
      const anual = getAnualPeriodo();
      const idsStr = ids.map(String);

      // ¿Incluye el ítem Anual?
      const incluyeAnual = anual && idsStr.includes(String(anual.id));

      // ¿Todas las no-anuales seleccionadas?
      const nonAnual = getNonAnualIds();
      const esSeisMeses = nonAnual.length > 0 && idsStr.length === nonAnual.length && nonAnual.every((id) => idsStr.includes(id));

      if (incluyeAnual || esSeisMeses) return `CONTADO ANUAL ${year}`;

      const ordenados = [...idsStr].sort((a, b) => Number(a) - Number(b));
      const partes = ordenados.map((id) => {
        const p = periodos.find((pp) => String(pp.id) === String(id));
        if (!p) return String(id);
        return limpiarPrefijoPeriodo(p.nombre)
          .replace(/\s*[yY]\s*/g, '/')
          .replace(/\s+/g, ' ')
          .replace(/\/+/g, '/');
      });
      return `${partes.join(' / ')} ${year}`;
    },
    [periodos, getNonAnualIds, getAnualPeriodo]
  );

  const primerIdSeleccionado = (ids) =>
    ids.length ? String([...ids].sort((a, b) => Number(a) - Number(b))[0]) : '0';

  const calcularImportePorSeleccion = useCallback(
    (idsSeleccion) => {
      if (!idsSeleccion || idsSeleccion.length === 0) return 0;
      const anual = getAnualPeriodo();
      const idsStr = idsSeleccion.map(String);

      const esSoloAnual = anual && idsStr.length === 1 && idsStr[0] === String(anual.id);

      // Detectar “6 meses = anual”
      const nonAnual = getNonAnualIds();
      const esSeisMeses = nonAnual.length > 0 && idsStr.length === nonAnual.length && nonAnual.every((id) => idsStr.includes(id));

      if (esSoloAnual || esSeisMeses) return PRECIO_ANUAL_CON_DESCUENTO;
      return idsSeleccion.length * PRECIO_MENSUAL;
    },
    [getAnualPeriodo, getNonAnualIds]
  );

  // =========================
  // Periodos filtrados por año (UI)
  // =========================
  const periodosFiltrados = useMemo(() => {
    if (!anioSeleccionado) return periodos;
    const y = parseInt(anioSeleccionado, 10);
    return periodos.filter((p) => {
      const py = extractYearFromPeriodoName(p.nombre);
      return py === null || py === y;
    });
  }, [periodos, anioSeleccionado]);

  // Si el período seleccionado deja de existir para el año elegido, lo limpiamos
  useEffect(() => {
    if (!periodoSeleccionado) return;
    const stillExists = periodosFiltrados.some((p) => String(p.id) === String(periodoSeleccionado));
    if (!stillExists) {
      setPeriodoSeleccionado('');
    }
  }, [anioSeleccionado, periodosFiltrados, periodoSeleccionado]);

  // =========================
  // Impresión
  // =========================

  // Imprimir TODOS directo (período seleccionado y año actual seleccionado)
  const handleImprimirTodosDirecto = async () => {
    if (!periodoSeleccionado) {
      setToastTipo('error');
      setToastMensaje('Seleccioná un período antes de imprimir.');
      setToastVisible(true);
      return;
    }
    if (cuotasFiltradas.length === 0) {
      setToastTipo('error');
      setToastMensaje('No hay registros visibles para imprimir.');
      setToastVisible(true);
      return;
    }

    const ventanaImpresion = window.open('', '_blank');
    if (!ventanaImpresion) {
      alert('Por favor deshabilitá el bloqueador de ventanas emergentes para esta página');
      return;
    }

    setLoadingPrint(true);
    try {
      const ids = [periodoSeleccionado];
      const importeTotal = calcularImportePorSeleccion(ids);
      const periodoTexto = construirPeriodoTexto(ids, anioSeleccionado);
      const anual = getAnualPeriodo();
      const periodoIdImpresion = (anual && ids.map(String).includes(String(anual.id)))
        ? String(anual.id)
        : primerIdSeleccionado(ids);
      const anioNum = Number(anioSeleccionado) || new Date().getFullYear();

      const listaEnriquecida = cuotasFiltradas.map((c) => ({
        ...c,
        id_periodo: periodoIdImpresion,
        periodo_texto: periodoTexto,
        importe_total: importeTotal,
        anio: anioNum,
      }));

      await imprimirRecibosUnicos(listaEnriquecida, periodoIdImpresion, ventanaImpresion);
    } catch (error) {
      console.error('Error al imprimir:', error);
      ventanaImpresion.close();
    } finally {
      setLoadingPrint(false);
    }
  };

  // Abrir selector (para fila o masivo con selección manual)
  const handleAbrirSelectorImpresion = () => {
    if (cuotasFiltradas.length === 0) {
      setToastTipo('error');
      setToastMensaje('No hay registros visibles para imprimir.');
      setToastVisible(true);
      return;
    }
    setCuotaParaImprimir(null); // impresión masiva (pero con selector)
    setPeriodosAImprimir(periodoSeleccionado ? [periodoSeleccionado] : []);
    setImprimirContable(false);
    setMostrarModalSeleccionPeriodos(true);
  };

  // ⬇️ NUEVO: recibe { anio, seleccionados } desde ModalMesCuotas
  const handleImprimirSeleccionados = async ({ anio, seleccionados }) => {
    const ventanaImpresion = window.open('', '_blank');
    if (!ventanaImpresion) {
      alert('Por favor deshabilita el bloqueador de ventanas emergentes para esta página');
      return;
    }

    setLoadingPrint(true);
    try {
      // Modo contable (se mantiene igual)
      if (imprimirContable) {
        if (cuotaParaImprimir) {
          await imprimirRecibos([cuotaParaImprimir], null, ventanaImpresion, true);
        } else {
          const lista = cuotasFiltradas;
          if (lista.length > 0) await imprimirRecibos(lista, null, ventanaImpresion, true);
        }
      } else {
        const anual = getAnualPeriodo();
        const listaOrdenada = [...seleccionados].sort((a, b) => Number(a) - Number(b));
        const idsStr = listaOrdenada.map(String);
        const importeTotal = calcularImportePorSeleccion(listaOrdenada);
        const textoPeriodo = construirPeriodoTexto(listaOrdenada, anio);
        const periodoCodigo = (anual && idsStr.includes(String(anual.id)))
          ? String(anual.id)
          : primerIdSeleccionado(listaOrdenada);
        const anioNum = Number(anio) || Number(anioSeleccionado) || new Date().getFullYear();

        if (cuotaParaImprimir) {
          const socioConPeriodos = {
            ...cuotaParaImprimir,
            id_periodo: periodoCodigo,
            periodo_texto: textoPeriodo,
            importe_total: importeTotal,
            anio: anioNum,
          };
          await imprimirRecibosUnicos([socioConPeriodos], periodoCodigo, ventanaImpresion);
        } else {
          const listaEnriquecida = cuotasFiltradas.map((c) => ({
            ...c,
            id_periodo: periodoCodigo,
            periodo_texto: textoPeriodo,
            importe_total: importeTotal,
            anio: anioNum,
          }));
          if (listaEnriquecida.length > 0) {
            await imprimirRecibosUnicos(listaEnriquecida, periodoCodigo, ventanaImpresion);
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

  // Handlers estables para acciones de fila
  const handlePagar = useCallback((cuota) => () => {
    setSocioParaPagar(cuota);
    setMostrarModalPagos(true);
  }, []);
  const handleEliminarPago = useCallback((cuota) => () => {
    setSocioParaPagar(cuota);
    setMostrarModalEliminarPago(true);
  }, []);
  const handleEliminarCondonacion = useCallback((cuota) => () => {
    setSocioParaPagar(cuota);
    setMostrarModalEliminarCond(true);
  }, []);
  const handleImprimirFila = useCallback((cuota) => () => {
    setCuotaParaImprimir(cuota);
    setPeriodosAImprimir(periodoSeleccionado ? [periodoSeleccionado] : []);
    setImprimirContable(false);
    setMostrarModalSeleccionPeriodos(true);
  }, [periodoSeleccionado]);

  // =========================
  // Utilidad de UI
  // =========================
  const getNombrePeriodo = (id) => {
    const periodo = periodos.find((p) => String(p.id) === String(id));
    return periodo ? periodo.nombre : id;
  };

  // ======= Exportar Excel (NUEVO) =======
  const handleExportarExcel = () => {
    if (cuotasFiltradas.length === 0) {
      setToastTipo('error');
      setToastMensaje('No hay registros visibles para exportar.');
      setToastVisible(true);
      return;
    }

    const periodoTexto = periodoSeleccionado ? getNombrePeriodo(periodoSeleccionado) : 'SIN_PERIODO';
    const estadoTexto =
      ({ deudor: 'Deudores', pagado: 'Pagados', condonado: 'Condonados' }[estadoPagoSeleccionado]) || 'Todos';

    const datos = cuotasFiltradas.map((c) => ({
      ID: getId(c),
      Socio: c.nombre || '',
      Documento: c.documento || '',
      Dirección: c.domicilio || '',
      'Estado socio': c.estado || '',
      'Medio de pago': c.medio_pago || '',
      'Estado de pago': c.estado_pago || '',
      'Período (visible)': periodoTexto || '',
      Año: anioSeleccionado || '',
    }));

    const ws = XLSX.utils.json_to_sheet(datos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cuotas');

    // Nombre de archivo legible
    const limpiar = (t = '') =>
      String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9_-]+/g, '_');
    const fileName = `cuotas_${limpiar(estadoTexto)}_${limpiar(periodoTexto)}_${anioSeleccionado || currentYear}.xlsx`;

    XLSX.writeFile(wb, fileName);
  };

  // ======= estado derivado para habilitar "Imprimir todos" =======
  const imprimirTodosDeshabilitado = useMemo(
    () => loadingPrint || loading || cuotasFiltradas.length === 0,
    [loadingPrint, loading, cuotasFiltradas.length]
  );

  // =========================
  // Render
  // =========================
  const anualRef = getAnualPeriodo();
  const idAnual = anualRef?.id ?? ID_CONTADO_ANUAL_FALLBACK;

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
            {/* Filtro de Año (solo años con pagos) */}
            <div className="cuo_filtro-grupo">
              <label className="cuo_filtro-label">
                <FaCalendarAlt className="cuo_filtro-icono" />
                Año
              </label>
              <select
                value={anioSeleccionado}
                onChange={(e) => setAnioSeleccionado(e.target.value)}
                className="cuo_filtro-select"
                disabled={loading || anios.length === 0}
              >
                {anios.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

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
                {periodosFiltrados.map((p) => (
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
                onClick={handleImprimirTodosDirecto}
                disabled={imprimirTodosDeshabilitado}
                title={cuotasFiltradas.length === 0 ? 'No hay registros para imprimir' : 'Imprimir todos'}
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

              {/* ⬇️ NUEVO: Exportar Excel (de lo visible) */}
              <button
                className="cuo_boton cuo_boton-secondary"
                onClick={handleExportarExcel}
                disabled={loading || cuotasFiltradas.length === 0}
                title={cuotasFiltradas.length === 0 ? 'No hay registros visibles' : 'Exportar a Excel lo visible'}
              >
                <FaFileExcel /> Exportar Excel
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
                <CuotasList
                  items={cuotasFiltradas}
                  estadoPagoSeleccionado={estadoPagoSeleccionado}
                  onPagar={handlePagar}
                  onEliminarPago={handleEliminarPago}
                  onEliminarCondonacion={handleEliminarCondonacion}
                  onImprimir={handleImprimirFila}
                  listRef={listRef}
                  getId={getId}
                />
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
              // invalidar todo el período (del año actual seleccionado)
              invalidateCuotas('deudor', periodoSeleccionado);
              invalidateCuotas('pagado', periodoSeleccionado);
              invalidateCuotas('condonado', periodoSeleccionado);
              // una sola carga
              await fetchCuotasAll(periodoSeleccionado, { force: true });
              setVisibleFromCache(estadoPagoSeleccionado, periodoSeleccionado, { resetScroll: false });
              // refrescamos años por si se creó pago en un año nuevo
              fetchAnios();
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
            setVisibleFromCache(estadoPagoSeleccionado, periodoSeleccionado, { resetScroll: false });
            // si apareció un año nuevo por este pago, lo agregamos
            fetchAnios();
          }}
        />
      )}

      {mostrarModalEliminarPago && (
        <ModalEliminarPago
          socio={socioParaPagar}
          periodo={periodoSeleccionado}
          periodoTexto={getNombrePeriodo(periodoSeleccionado)}
          esPagoAnual={
            String(periodoSeleccionado) === String(idAnual)
            || Boolean(
              socioParaPagar?.origen_anual ||
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
            setVisibleFromCache(estadoPagoSeleccionado, periodoSeleccionado, { resetScroll: false });
            // refrescar años por si al eliminar queda un año vacío
            fetchAnios();
          }}
        />
      )}
      
      {mostrarModalEliminarCond && (
        <ModalEliminarCondonacion
          socio={socioParaPagar}
          periodo={periodoSeleccionado}
          periodoTexto={getNombrePeriodo(periodoSeleccionado)}
          esCondonacionAnual={
            String(periodoSeleccionado) === String(idAnual)
            || Boolean(
              socioParaPagar?.origen_anual ||
              socioParaPagar?.es_pago_anual ||
              socioParaPagar?.pago_anual ||
              (socioParaPagar?.origen_pago && String(socioParaPagar.origen_pago).toLowerCase().includes('anual')) ||
              (socioParaPagar?.periodo_origen && String(socioParaPagar.periodo_origen).toLowerCase().includes('anual'))
            )
          }
          onClose={() => setMostrarModalEliminarCond(false)}
          onEliminado={async () => {
            cacheRef.current.mutationTs = Date.now();
            invalidateCuotas('condonado', periodoSeleccionado);
            invalidateCuotas('deudor', periodoSeleccionado);
            invalidateCuotas('pagado', periodoSeleccionado);
            await fetchCuotasAll(periodoSeleccionado, { force: true });
            setVisibleFromCache(estadoPagoSeleccionado, periodoSeleccionado, { resetScroll: false });
            fetchAnios();
          }}
        />
      )}

      {/* Modal de selección de períodos para imprimir */}
      {mostrarModalSeleccionPeriodos && (
        <ModalMesCuotas
          periodos={periodosFiltrados}
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
          anios={anios}
          anioSeleccionado={anioSeleccionado}
          onAnioChange={setAnioSeleccionado}
        />
      )}

      {toastVisible && (
        <Toast tipo={toastTipo} mensaje={toastMensaje} duracion={3000} onClose={() => setToastVisible(false)} />
      )}
    </div>
  );
};

export default Cuotas;
