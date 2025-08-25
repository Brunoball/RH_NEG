// src/components/Cuotas/Cuotas.jsx
import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
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
import Toast from '../Global/Toast';
import './Cuotas.css';
import axios from 'axios';

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

const Cuotas = () => {
  const navigate = useNavigate();

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

  // ===== Caché (memoria) + TTL =====
  const cacheRef = useRef({
    ttl: 30 * 60 * 1000, // 30 minutos
    // Cache de cuotas por clave "estadoPago|periodoId"
    cuotas: {
      // [cacheKey]: { data: [], ts: number }
    },
    // Cache para listas auxiliares
    listas: {
      data: null, // { mediosPago:[], periodos:[], estados:[] }
      ts: 0,
    },
  });

  const isFresh = (ts) => ts && (Date.now() - ts < cacheRef.current.ttl);
  const getCuotasKey = useCallback(
    (estadoPago, periodoId) => `${estadoPago}|${periodoId || 'NO_PERIODO'}`,
    []
  );

  // ===== Debounce para búsquedas (solo filtra en memoria) =====
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
  // Carga de LISTAS (cacheado)
  // =========================
  const fetchListas = useCallback(async () => {
    const listasCache = cacheRef.current.listas;
    if (listasCache.data && isFresh(listasCache.ts)) {
      // servir desde cache
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
  // Carga de CUOTAS (con cache por clave)
  // ===================================
  const fetchCuotas = useCallback(
    async (estadoPago, periodoId, { force = false } = {}) => {
      if (!periodoId) {
        setCuotas([]);
        return;
      }
      const key = getCuotasKey(estadoPago, periodoId);
      const cached = cacheRef.current.cuotas[key];
      if (!force && cached && isFresh(cached.ts)) {
        setCuotas(cached.data);
        return;
      }

      let qs = '';
      if (estadoPago === 'pagado') qs = '&pagados=1';
      else if (estadoPago === 'condonado') qs = '&condonados=1';
      if (periodoId) qs += `&id_periodo=${encodeURIComponent(periodoId)}`;

      setLoading(true);
      try {
        const dataCuotas = await api.get(`/api.php?action=cuotas${qs}`);
        if (dataCuotas?.exito) {
          const arr = dataCuotas.cuotas || [];
          cacheRef.current.cuotas[key] = { data: arr, ts: Date.now() };
          setCuotas(arr);
        } else {
          setCuotas([]);
        }
      } catch (e) {
        console.error('Error al obtener cuotas:', e);
        setCuotas([]);
      } finally {
        setLoading(false);
      }
    },
    [getCuotasKey]
  );

  // Invalidación quirúrgica tras mutaciones
  const invalidateCuotas = useCallback(
    (estadoPago, periodoId) => {
      const key = getCuotasKey(estadoPago, periodoId);
      delete cacheRef.current.cuotas[key];
    },
    [getCuotasKey]
  );

  // ========== Efectos ==========
  useEffect(() => {
    fetchListas();
  }, [fetchListas]);

  useEffect(() => {
    fetchCuotas(estadoPagoSeleccionado, periodoSeleccionado);
  }, [estadoPagoSeleccionado, periodoSeleccionado, fetchCuotas]);

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

    // Orden
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
        const theB = b.domicilio || '';
        return orden.ascendente ? A.localeCompare(theB) : theB.localeCompare(A);
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

  // Contadores (usan los mismos filtros, excepto estadoPago que se fija)
  const buildCount = useCallback(
    (estadoPagoFijo) =>
      cuotas.filter(
        (c) =>
          (String(c.id_periodo) === String(periodoSeleccionado) ||
            c.id_periodo === null) &&
          (debouncedBusqueda === '' ||
            c.nombre?.toLowerCase().includes(debouncedBusqueda.toLowerCase()) ||
            c.domicilio?.toLowerCase().includes(debouncedBusqueda.toLowerCase()) ||
            c.documento?.toLowerCase().includes(debouncedBusqueda.toLowerCase())) &&
          equalId(c, debouncedBusquedaId) &&
          (estadoSocioSeleccionado === '' || c.estado === estadoSocioSeleccionado) &&
          (medioPagoSeleccionado === '' || c.medio_pago === medioPagoSeleccionado) &&
          c.estado_pago === estadoPagoFijo
      ).length,
    [
      cuotas,
      debouncedBusqueda,
      debouncedBusquedaId,
      estadoSocioSeleccionado,
      medioPagoSeleccionado,
      periodoSeleccionado
    ]
  );

  const cantidadFiltradaDeudores = useMemo(
    () => buildCount('deudor'),
    [buildCount]
  );
  const cantidadFiltradaPagados = useMemo(
    () => buildCount('pagado'),
    [buildCount]
  );
  const cantidadFiltradaCondonados = useMemo(
    () => buildCount('condonado'),
    [buildCount]
  );

  const toggleOrden = (campo) => {
    setOrden((prev) => ({
      campo,
      ascendente: prev.campo === campo ? !prev.ascendente : true,
    }));
  };

  // =========================
  // Impresión
  // =========================
  const handleImprimirTodos = async () => {
    const ventanaImpresion = window.open('', '_blank');
    if (!ventanaImpresion) {
      alert('Por favor deshabilita el bloqueador de ventanas emergentes para esta página');
      return;
    }
    setLoadingPrint(true);
    try {
      await imprimirRecibos(cuotasFiltradas, periodoSeleccionado, ventanaImpresion);
    } catch (error) {
      console.error('Error al imprimir:', error);
      ventanaImpresion.close();
    } finally {
      setLoadingPrint(false);
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
            <button
              className="cuo_boton-accion cuo_boton-accion-primary"
              onClick={() => {
                const ventanaImpresion = window.open('', '_blank');
                if (ventanaImpresion) {
                  imprimirRecibos([cuota], periodoSeleccionado, ventanaImpresion);
                } else {
                  alert('Por favor deshabilita el bloqueador de ventanas emergentes para imprimir');
                }
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
  const etiquetaPestaña =
    {
      deudor: 'Deudores',
      pagado: 'Pagados',
      condonado: 'Condonados',
    }[estadoPagoSeleccionado] || '';

  // =========================
  // Render
  // =========================
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
                  <span>({cantidadFiltradaDeudores})</span>
                </button>

                <button
                  className={`cuo_tab ${estadoPagoSeleccionado === 'pagado' ? 'cuo_tab-activo' : ''}`}
                  onClick={() => setEstadoPagoSeleccionado('pagado')}
                  disabled={loading}
                  title="Pagados"
                >
                  <FaCheckCircle style={{ marginRight: 6, color: '#16a34a' }} />
                  <span>({cantidadFiltradaPagados})</span>
                </button>

                <button
                  className={`cuo_tab ${estadoPagoSeleccionado === 'condonado' ? 'cuo_tab-activo' : ''}`}
                  onClick={() => setEstadoPagoSeleccionado('condonado')}
                  disabled={loading}
                  title="Condonados"
                >
                  <FaExclamationTriangle style={{ marginRight: 6, color: '#f59e0b' }} />
                  <span>({cantidadFiltradaCondonados})</span>
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
                  {etiquetaPestaña && <span className="cuo_periodo-seleccionado"> — {etiquetaPestaña}</span>}
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
                onClick={handleImprimirTodos}
                disabled={loadingPrint || !periodoSeleccionado || cuotasFiltradas.length === 0 || loading}
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
              // invalidación selectiva del periodo actual para la pestaña 'deudor' y 'pagado' (ambas pueden verse afectadas)
              invalidateCuotas('deudor', periodoSeleccionado);
              invalidateCuotas('pagado', periodoSeleccionado);
              invalidateCuotas('condonado', periodoSeleccionado);
              await fetchCuotas(estadoPagoSeleccionado, periodoSeleccionado, { force: true });
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
            invalidateCuotas('deudor', periodoSeleccionado);
            invalidateCuotas('pagado', periodoSeleccionado);
            await fetchCuotas(estadoPagoSeleccionado, periodoSeleccionado, { force: true });
          }}
        />
      )}

      {mostrarModalEliminarPago && (
        <ModalEliminarPago
          socio={socioParaPagar}
          periodo={periodoSeleccionado}
          periodoTexto={getNombrePeriodo(periodoSeleccionado)}
          onClose={() => setMostrarModalEliminarPago(false)}
          onEliminado={async () => {
            invalidateCuotas('pagado', periodoSeleccionado);
            invalidateCuotas('deudor', periodoSeleccionado);
            await fetchCuotas(estadoPagoSeleccionado, periodoSeleccionado, { force: true });
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
            invalidateCuotas('condonado', periodoSeleccionado);
            invalidateCuotas('deudor', periodoSeleccionado);
            await fetchCuotas(estadoPagoSeleccionado, periodoSeleccionado, { force: true });
          }}
        />
      )}

      {toastVisible && (
        <Toast tipo={toastTipo} mensaje={toastMensaje} duracion={3000} onClose={() => setToastVisible(false)} />
      )}
    </div>
  );
};

export default Cuotas;