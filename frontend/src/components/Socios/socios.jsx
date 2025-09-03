
// src/components/Socios/Socios.jsx
import React, {
  useEffect,
  useState,
  useMemo,
  useRef,
  useCallback,
  useTransition,
  useDeferredValue,
} from 'react';
import ReactDOM from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { FixedSizeList as List, areEqual } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import BASE_URL from '../../config/config';
import {
  FaInfoCircle,
  FaEdit,
  FaTrash,
  FaUserMinus,
  FaArrowLeft,
  FaUserPlus,
  FaFileExcel,
  FaUserSlash,
  FaSearch,
  FaTimes,
  FaUsers,
  FaFilter,
  FaChevronDown
} from 'react-icons/fa';
import './Socios.css';
import ModalEliminarSocio from './modales/ModalEliminarSocio';
import ModalInfoSocio from './modales/ModalInfoSocio';
import ModalDarBajaSocio from './modales/ModalDarBajaSocio';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import Toast from '../Global/Toast';
import '../Global/roots.css';

/* ============================
   CONSTANTES / PERFORMANCE
============================ */
const MIN_SPINNER_MS = 0;
const MAX_CASCADE = 14;
const CASCADE_DISABLE_ABOVE = 200;
const NAME_DEBOUNCE_MS = 20;
const ITEM_SIZE = 44; // desktop

// >>>>>>>>>> NUEVO: alturas responsivas para móvil
const MOBILE_ITEM_SIZE = 230;
const MOBILE_ITEM_SIZE_SELECTED = 270;
/** Hook que ajusta la altura de cada item según el viewport y si hay fila seleccionada */
function useResponsiveItemSize(hasSelected) {
  const [size, setSize] = useState(ITEM_SIZE);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const update = () => {
      if (mq.matches) {
        setSize(hasSelected ? MOBILE_ITEM_SIZE_SELECTED : MOBILE_ITEM_SIZE);
      } else {
        setSize(ITEM_SIZE);
      }
    };
    update();
    mq.addEventListener?.('change', update);
    mq.addListener?.(update); // fallback
    return () => {
      mq.removeEventListener?.('change', update);
      mq.removeListener?.(update);
    };
  }, [hasSelected]);
  return size;
}

/* ============================
   STORAGE KEYS
============================ */
const SS_KEYS = {
  SEL_ID: 'socios_last_sel_id',
  SCROLL: 'socios_last_scroll',
  TS: 'socios_last_ts',
  FILTERS: 'socios_last_filters'
};
const LS_FILTERS = 'filtros_socios_v2'; // nueva versión (con showAll)

/* ============================
   HELPERS
============================ */
const buildAddress = (domicilio, numero) => {
  const calle = String(domicilio ?? '').trim();
  const num = String(numero ?? '').trim();
  if (!calle && !num) return '';
  if (calle && num && calle.includes(num)) return calle;
  return `${calle} ${num}`.trim();
};
const getFirstLetter = (name) => {
  const s = String(name ?? '').trim();
  return s ? s[0].toUpperCase() : '';
};

/* ============================
   BARRA SUPERIOR
============================ */
const BarraSuperior = React.memo(({
  cargando,
  busquedaInput,
  setBusquedaInput,
  busquedaId,
  letraSeleccionada,
  categoriaSeleccionada,
  setFiltros,
  filtrosRef,
  mostrarFiltros,
  setMostrarFiltros,
  categorias,
  startTransition
}) => {
  const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const [mostrarSubmenuAlfabetico, setMostrarSubmenuAlfabetico] = useState(false);
  const [mostrarSubmenuCategoria, setMostrarSubmenuCategoria] = useState(false);

  const toggleSubmenu = useCallback((cual) => {
    if (cual === 'alfabetico') {
      setMostrarSubmenuAlfabetico(v => !v);
      setMostrarSubmenuCategoria(false);
    } else if (cual === 'categoria') {
      setMostrarSubmenuCategoria(v => !v);
      setMostrarSubmenuAlfabetico(false);
    }
  }, []);

  const handleLetraClick = useCallback((letra) => {
    startTransition(() => {
      setFiltros(prev => ({
        ...prev,
        letraSeleccionada: letra,
        showAll: false,
      }));
    });
    setMostrarSubmenuAlfabetico(false);
    setMostrarFiltros(false);
  }, [setFiltros, setMostrarFiltros, startTransition]);

  const handleCategoriaClick = useCallback((value) => {
    startTransition(() => {
      setFiltros(prev => ({
        ...prev,
        categoriaSeleccionada: value,
        showAll: false,
      }));
    });
    setMostrarSubmenuCategoria(false);
    setMostrarFiltros(false);
  }, [setFiltros, setMostrarFiltros, startTransition]);

  const handleMostrarTodos = useCallback(() => {
    startTransition(() => {
      setFiltros(prev => ({
        ...prev,
        busqueda: '',
        busquedaId: '',
        letraSeleccionada: 'TODOS',
        categoriaSeleccionada: 'OPCIONES',
        showAll: true,
      }));
      setBusquedaInput('');
    });
    setMostrarSubmenuAlfabetico(false);
    setMostrarSubmenuCategoria(false);
    setMostrarFiltros(false);
  }, [setFiltros, setMostrarFiltros, setBusquedaInput, startTransition]);

  return (
    <div className="soc-barra-superior">
      <div className="soc-titulo-container">
        <h2 className="soc-titulo">Gestión de Socios</h2>
      </div>

      <div className="soc-buscadores-container">
        {/* Buscador por nombre */}
        <div className="soc-buscador-container">
          <input
            type="text"
            placeholder="Buscar por nombre..."
            value={busquedaInput}
            onChange={(e) => setBusquedaInput(e.target.value)}
            className="soc-buscador"
            disabled={cargando}
          />
          <div className="soc-buscador-iconos">
            {busquedaInput ? (
              <FaTimes
                className="soc-buscador-icono"
                onClick={() => {
                  setBusquedaInput('');
                  startTransition(() => {
                    setFiltros(prev => ({ ...prev, busqueda: '' }));
                  });
                }}
              />
            ) : (
              <FaSearch className="soc-buscador-icono" />
            )}
          </div>
        </div>

        {/* Buscador por ID */}
        <div className="soc-buscador-container soc-buscador-id-container">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="ID"
            value={busquedaId}
            onChange={(e) => {
              const onlyNums = e.target.value.replace(/\D/g, '');
              startTransition(() => {
                setFiltros(prev => ({
                  ...prev,
                  busquedaId: onlyNums,
                  showAll: false,
                }));
              });
            }}
            className="soc-buscador soc-buscador-id"
            disabled={cargando}
            title="Buscar por ID (match exacto)"
            maxLength={10}
          />
          {busquedaId ? (
            <FaTimes
              className="soc-buscador-icono"
              onClick={() => {
                startTransition(() => {
                  setFiltros(prev => ({ ...prev, busquedaId: '', showAll: false }));
                });
              }}
            />
          ) : (
            <FaSearch className="soc-buscador-icono" />
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="soc-filtros-container" ref={filtrosRef}>
        <button
          className="soc-boton-filtros soc-boton-filtros--emp"
          onClick={(e) => {
            e.stopPropagation();
            setMostrarFiltros(!mostrarFiltros);
            if (!mostrarFiltros) {
              setMostrarSubmenuAlfabetico(false);
              setMostrarSubmenuCategoria(false);
            }
          }}
          disabled={cargando}
        >
          <FaFilter className="soc-icono-boton" />
          <span>Aplicar Filtros</span>
          <FaChevronDown className={`soc-chevron-icon ${mostrarFiltros ? 'soc-rotate' : ''}`} />
        </button>

        {mostrarFiltros && (
          <div
            className="soc-menu-filtros soc-menu-filtros--emp"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="soc-filtros-menu-item" onClick={() => toggleSubmenu('alfabetico')}>
              <span>Filtrar de la A a la Z</span>
              <FaChevronDown className={`soc-chevron-icon ${mostrarSubmenuAlfabetico ? 'soc-rotate' : ''}`} />
            </div>

            {mostrarSubmenuAlfabetico && (
              <div className="soc-filtros-submenu">
                <div className="soc-alfabeto-filtros">
                  {letras.map((letra) => (
                    <button
                      key={letra}
                      className={`soc-letra-filtro ${letraSeleccionada === letra ? 'active' : ''}`}
                      onClick={(e) => { e.stopPropagation(); handleLetraClick(letra); }}
                      title={`Filtrar por ${letra}`}
                    >
                      {letra}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="soc-filtros-menu-item" onClick={() => toggleSubmenu('categoria')}>
              <span>Categorías</span>
              <FaChevronDown className={`soc-chevron-icon ${mostrarSubmenuCategoria ? 'soc-rotate' : ''}`} />
            </div>

            {mostrarSubmenuCategoria && (
              <div className="soc-filtros-submenu">
                <div className="soc-submenu-lista">
                  {categorias.map(cat => {
                    const active = String(categoriaSeleccionada) === String(cat.id);
                    return (
                      <div
                        key={cat.id}
                        className={`soc-filtros-submenu-item ${active ? 'active' : ''}`}
                        onClick={(e) => { e.stopPropagation(); handleCategoriaClick(String(cat.id)); }}
                        title={`Filtrar por ${cat.descripcion}`}
                      >
                        {cat.descripcion}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div
              className="soc-filtros-menu-item soc-filtros-menu-item__mostrar-todas"
              onClick={(e) => { e.stopPropagation(); handleMostrarTodos(); }}
            >
              <span>Mostrar Todos</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

/* ============================
           COMPONENTE
============================ */
const Socios = () => {
  const [socios, setSocios] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [socioSeleccionado, setSocioSeleccionado] = useState(null);
  const [mostrarModalEliminar, setMostrarModalEliminar] = useState(false);
  const [socioAEliminar, setSocioAEliminar] = useState(null);
  const [mostrarModalInfo, setMostrarModalInfo] = useState(false);
  const [socioInfo, setSocioInfo] = useState(null);
  const [mostrarModalDarBaja, setMostrarModalDarBaja] = useState(false);
  const [socioDarBaja, setSocioDarBaja] = useState(null);
  const [mostrarFiltros, setMostrarFiltros] = useState(false);

  const [animacionActiva, setAnimacionActiva] = useState(false);
  const [tablaVersion, setTablaVersion] = useState(0);
  const [needsRefresh, setNeedsRefresh] = useState(false);

  const filtrosRef = useRef(null);
  const listRef = useRef(null);
  const lastScrollOffsetRef = useRef(0);
  const navigate = useNavigate();
  const location = useLocation();
  const [isPending, startTransition] = useTransition();

  const [toast, setToast] = useState({ mostrar: false, tipo: '', mensaje: '' });

  // Filtros
  const [filtros, setFiltros] = useState(() => {
    try {
      const saved = localStorage.getItem(LS_FILTERS);
      return saved ? JSON.parse(saved) : {
        busqueda: '',
        busquedaId: '',
        letraSeleccionada: 'TODOS',
        categoriaSeleccionada: 'OPCIONES',
        showAll: false
      };
    } catch {
      return {
        busqueda: '',
        busquedaId: '',
        letraSeleccionada: 'TODOS',
        categoriaSeleccionada: 'OPCIONES',
        showAll: false
      };
    }
  });
  const { busqueda, busquedaId, letraSeleccionada, categoriaSeleccionada, showAll } = filtros;

  // Input controlado + debounce
  const [busquedaInput, setBusquedaInput] = useState(filtros.busqueda || '');
  const deferredBusqueda = useDeferredValue(busquedaInput);

  useEffect(() => {
    const t = setTimeout(() => {
      startTransition(() => {
        setFiltros(prev => ({
          ...prev,
          busqueda: busquedaInput || '',
          showAll: (busquedaInput && busquedaInput.trim().length > 0) ? false : prev.showAll,
        }));
      });
    }, NAME_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [busquedaInput, startTransition]);

  // Persistencia
  useEffect(() => {
    try {
      sessionStorage.setItem(SS_KEYS.FILTERS, JSON.stringify(filtros));
      localStorage.setItem(LS_FILTERS, JSON.stringify(filtros));
    } catch {}
  }, [filtros]);

  // Restaurar de sessionStorage al montar
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SS_KEYS.FILTERS);
      if (raw) {
        const parsed = JSON.parse(raw);
        setFiltros(prev => ({ ...prev, ...parsed }));
        setBusquedaInput(parsed.busqueda || '');
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mostrarToast = useCallback((mensaje, tipo = 'exito') => {
    setToast({ mostrar: true, tipo, mensaje });
  }, []);

  /* ===== PRE-INDEXACIÓN ===== */
  const idxById = useMemo(() => {
    const m = new Map();
    for (const s of socios) m.set(String(s._idStr), s);
    return m;
  }, [socios]);

  /* ===== FILTRADO =====
     Regla: si hay filtro por categoría, solo id_estado == 2
  */
  const activeFilters = useMemo(() => ({
    byId: !!busquedaId,
    bySearch: !!(deferredBusqueda && deferredBusqueda.trim()),
    byLetter: letraSeleccionada && letraSeleccionada !== 'TODOS',
    byCategory: categoriaSeleccionada && categoriaSeleccionada !== 'OPCIONES',
  }), [busquedaId, deferredBusqueda, letraSeleccionada, categoriaSeleccionada]);

  const activeFiltersCount = useMemo(() =>
    Object.values(activeFilters).filter(Boolean).length
  , [activeFilters]);

  const sociosFiltrados = useMemo(() => {
    let arr = socios.filter(s => s._isActive);

    if (showAll) return arr;

    if (activeFilters.byId) {
      const found = idxById.get(String(busquedaId));
      arr = found && found._isActive ? [found] : [];
      if (arr.length === 0) return arr;
    }

    if (activeFilters.byLetter) {
      arr = arr.filter(s => s._first === letraSeleccionada);
    }

    if (activeFilters.byCategory) {
      arr = arr.filter(s =>
        String(s.id_categoria) === String(categoriaSeleccionada) &&
        Number(s.id_estado) === 2
      );
    }

    if (activeFilters.bySearch) {
      const q = deferredBusqueda.toLowerCase();
      arr = arr.filter(s => s._name.includes(q));
    }

    if (activeFiltersCount === 0) return [];
    return arr;
  }, [
    socios, idxById,
    activeFilters, activeFiltersCount,
    busquedaId, letraSeleccionada, categoriaSeleccionada,
    deferredBusqueda, showAll
  ]);

  /* ===== ANIMACIÓN ENTRADA ===== */
  const allowCascade = sociosFiltrados.length <= CASCADE_DISABLE_ABOVE;
  const triggerCascade = useCallback((duration = 360) => {
    if (!allowCascade) return;
    setAnimacionActiva(true);
    setTablaVersion(v => v + 1);
    const t = setTimeout(() => setAnimacionActiva(false), duration);
    return () => clearTimeout(t);
  }, [allowCascade]);

  const lastCountRef = useRef(0);
  useEffect(() => {
    if (lastCountRef.current !== sociosFiltrados.length) {
      lastCountRef.current = sociosFiltrados.length;
      requestAnimationFrame(() => triggerCascade(320));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sociosFiltrados.length]);

  /* ===== EVENTOS GLOBALES ===== */
  useEffect(() => {
    const handleClickOutsideFiltros = (event) => {
      if (filtrosRef.current && !filtrosRef.current.contains(event.target)) {
        setMostrarFiltros(false);
      }
    };
    const handleClickOutsideTable = (event) => {
      if (!event.target.closest('.soc-tabla-fila')) {
        setSocioSeleccionado(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutsideFiltros);
    document.addEventListener('click', handleClickOutsideTable);
    return () => {
      document.removeEventListener('mousedown', handleClickOutsideFiltros);
      document.removeEventListener('click', handleClickOutsideTable);
    };
  }, []);

  /* ===== RESTAURAR SELECCIÓN/SCROLL ===== */
  const restorePendingRef = useRef(false);
  const restoredOnceRef = useRef(false);

  const goEditar = useCallback((socio) => {
    try {
      const currentOffset = lastScrollOffsetRef.current || 0;
      sessionStorage.setItem(SS_KEYS.SEL_ID, String(socio.id_socio));
      sessionStorage.setItem(SS_KEYS.SCROLL, String(currentOffset));
      sessionStorage.setItem(SS_KEYS.TS, String(Date.now()));
      sessionStorage.setItem(SS_KEYS.FILTERS, JSON.stringify(filtros));
      sessionStorage.setItem(`socio_prefetch_${socio.id_socio}`, JSON.stringify(socio));
    } catch {}
    navigate(`/socios/editar/${socio.id_socio}`, { state: { refresh: true, socio } });
  }, [navigate, filtros]);

  const locationRef = useRef(location);
  useEffect(() => { locationRef.current = location; }, [location]);

  useEffect(() => {
    const state = locationRef.current.state;
    if (state && state.refresh) {
      setNeedsRefresh(true);
      restorePendingRef.current = true;
      navigate(locationRef.current.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ============================
             FETCH
  ============================ */
  const fetchAbortRef = useRef({ socios: null, listas: null });

  const cargarDatos = useCallback(async () => {
    const t0 = performance.now();
    try {
      setCargando(true);

      fetchAbortRef.current.socios?.abort?.();
      fetchAbortRef.current.listas?.abort?.();

      const ctrlSoc = new AbortController();
      fetchAbortRef.current.socios = ctrlSoc;

      const rSoc = await fetch(`${BASE_URL}/api.php?action=socios`, { signal: ctrlSoc.signal, cache: 'no-store' });
      const data = await rSoc.json();
      if (data?.exito) {
        const enriched = (data.socios || []).map((s) => {
          const _idStr = String(s?.id_socio ?? s?.id ?? '').trim();
          const _name = String(s?.nombre ?? '').toLowerCase();
          const _first = getFirstLetter(s?.nombre);
          const _dom = buildAddress(s?.domicilio, s?.numero);
          const _isActive = Number(s?.activo) === 1;
          const _estadoNum = Number(s?.id_estado ?? 0);
          return { ...s, _idStr, _name, _first, _dom, _isActive, _estadoNum };
        });
        setSocios(enriched);
      } else {
        mostrarToast(`Error al obtener socios: ${data?.mensaje ?? 'desconocido'}`, 'error');
        setSocios([]);
      }

      try {
        const ctrlLis = new AbortController();
        fetchAbortRef.current.listas = ctrlLis;

        const rLis = await fetch(`${BASE_URL}/api.php?action=listas`, { signal: ctrlLis.signal, cache: 'force-cache' });
        const dataListas = await rLis.json();
        if (dataListas?.exito && dataListas?.listas?.categorias) {
          setCategorias(dataListas.listas.categorias);
        } else {
          setCategorias([]);
        }
      } catch {
        setCategorias([]);
      }

      const elapsed = performance.now() - t0;
      const waitMore = Math.max(0, MIN_SPINNER_MS - elapsed);
      setTimeout(() => {
        setCargando(false);
        triggerCascade(360);
      }, waitMore);
    } catch (error) {
      if (error?.name !== 'AbortError') {
        mostrarToast('Error de red al obtener datos', 'error');
        setSocios([]);
        setCategorias([]);
        setCargando(false);
      }
    }
  }, [mostrarToast, triggerCascade]);

  useEffect(() => {
    cargarDatos();
    return () => {
      fetchAbortRef.current.socios?.abort?.();
      fetchAbortRef.current.listas?.abort?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (needsRefresh) {
      cargarDatos();
      setNeedsRefresh(false);
    }
  }, [needsRefresh, cargarDatos]);

  useEffect(() => {
    if (!restorePendingRef.current) return;
    if (restoredOnceRef.current) return;
    if (cargando) return;
    if (!listRef.current) return;

    try {
      const rawFilters = sessionStorage.getItem(SS_KEYS.FILTERS);
      if (rawFilters) {
        const parsed = JSON.parse(rawFilters);
        setFiltros(prev => ({ ...prev, ...parsed }));
        setBusquedaInput(parsed.busqueda || '');
      }

      const selId = sessionStorage.getItem(SS_KEYS.SEL_ID);
      const savedOffset = Number(sessionStorage.getItem(SS_KEYS.SCROLL) || '0');

      const currentList = (() => {
        let arr = socios.filter(s => s._isActive);
        const parsed = rawFilters ? JSON.parse(rawFilters) : filtros;

        if (parsed.showAll) return arr;

        if (parsed.busquedaId) {
          const found = arr.find(s => String(s.id_socio) === String(parsed.busquedaId));
          arr = found ? [found] : [];
        }
        if (parsed.letraSeleccionada && parsed.letraSeleccionada !== 'TODOS') {
          arr = arr.filter(s => s._first === parsed.letraSeleccionada);
        }
        if (parsed.categoriaSeleccionada && parsed.categoriaSeleccionada !== 'OPCIONES') {
          arr = arr.filter(s =>
            String(s.id_categoria) === String(parsed.categoriaSeleccionada) &&
            Number(s.id_estado) === 2
          );
        }
        if (parsed.busqueda) {
          const q = String(parsed.busqueda).toLowerCase();
          arr = arr.filter(s => s._name.includes(q));
        }
        return arr;
      })();

      if (selId) {
        const idx = currentList.findIndex(s => String(s.id_socio) === String(selId));
        if (idx >= 0) {
          setSocioSeleccionado(currentList[idx]);
          requestAnimationFrame(() => {
            listRef.current?.scrollToItem?.(idx, 'smart');
          });
        } else {
          requestAnimationFrame(() => {
            listRef.current?.scrollTo?.(savedOffset);
          });
        }
      }

      restoredOnceRef.current = true;
      restorePendingRef.current = false;
      sessionStorage.removeItem(SS_KEYS.SEL_ID);
      sessionStorage.removeItem(SS_KEYS.SCROLL);
      sessionStorage.removeItem(SS_KEYS.TS);
    } catch {}
  }, [cargando, socios, filtros]);

  /* ===== HANDLERS / EXPORTACIÓN ===== */
  const manejarSeleccion = useCallback((socio) => {
    setSocioSeleccionado(prev => prev?._idStr !== socio._idStr ? socio : null);
  }, []);

  const eliminarSocio = useCallback(async (id) => {
    try {
      const response = await fetch(`${BASE_URL}/api.php?action=eliminar_socio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_socio: id }),
      });
      const data = await response.json();
      if (data.exito) {
        setSocios(prev => prev.filter((s) => s.id_socio !== id));
        mostrarToast('Socio eliminado correctamente');
        triggerCascade(300);
      } else {
        mostrarToast(`Error al eliminar: ${data.mensaje}`, 'error');
      }
    } catch {
      mostrarToast('Error de red al intentar eliminar', 'error');
    } finally {
      setMostrarModalEliminar(false);
      setSocioAEliminar(null);
    }
  }, [mostrarToast, triggerCascade]);

  const darDeBajaSocio = useCallback(async (id, motivo) => {
    try {
      const response = await fetch(`${BASE_URL}/api.php?action=dar_baja_socio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_socio: id, motivo }),
      });
      const data = await response.json();
      if (data.exito) {
        setSocios(prev => prev.filter((s) => s.id_socio !== id));
        mostrarToast('Socio dado de baja correctamente');
        triggerCascade(300);
      } else {
        mostrarToast(`Error: ${data.mensaje}`, 'error');
      }
    } catch {
      mostrarToast('Error de red al intentar dar de baja', 'error');
    } finally {
      setMostrarModalDarBaja(false);
      setSocioDarBaja(null);
    }
  }, [mostrarToast, triggerCascade]);

  const exportarExcel = useCallback(() => {
    if (socios.length === 0) {
      mostrarToast('No hay socios registrados para exportar.', 'error');
      return;
    }
    if (!showAll && activeFiltersCount === 0) {
      mostrarToast('Aplicá al menos un filtro o "Mostrar todos" para exportar.', 'error');
      return;
    }
    if (sociosFiltrados.length === 0) {
      mostrarToast('No hay socios que coincidan con los filtros actuales.', 'error');
      return;
    }

    const datos = sociosFiltrados.map((s) => ({
      ID: s.id_socio,
      Nombre: s.nombre,
      DNI: s.dni,
      Domicilio: s._dom,
      Teléfono_móvil: s.telefono_movil,
      Teléfono_fijo: s.telefono_fijo,
      Categoría: s.id_categoria,
      Cobrador: s.id_cobrador,
      Estado: s.id_estado,
      Comentario: s.comentario,
      Fecha_Nacimiento: s.nacimiento,
      Ingreso: s.ingreso,
      Activo: s.activo
    }));

    const ws = XLSX.utils.json_to_sheet(datos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, showAll ? "Socios (todos activos)" : "Socios (filtrados)");

    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
    saveAs(blob, 'Socios.xlsx');
  }, [socios, sociosFiltrados, showAll, activeFiltersCount, mostrarToast]);

  /* ============================
        FILA VIRTUALIZADA
  ============================ */
  const RowBase = ({ index, style, data }) => {
    const socio = data[index];
    const esFilaPar = (index & 1) === 0;

    const shouldAnimate = animacionActiva && index < MAX_CASCADE;
    const animationDelay = shouldAnimate ? `${index * 0.035}s` : '0s';

    return (
      <div
        style={{
          ...style,
          animationDelay,
          animationName: shouldAnimate ? 'fadeIn' : 'none',
          animationFillMode: 'forwards',
          animationDuration: shouldAnimate ? '.3s' : '0s',
          opacity: shouldAnimate ? 0 : 1,
        }}
        className={`soc-tabla-fila ${esFilaPar ? 'soc-row-even' : 'soc-row-odd'} ${socioSeleccionado?._idStr === socio._idStr ? 'soc-fila-seleccionada' : ''}`}
        onClick={() => manejarSeleccion(socio)}
      >
        {/* data-label para layout etiqueta/valor en móvil */}
        <div className="soc-col-id" data-label="ID" title={socio.id_socio}>
          {socio.id_socio}
        </div>

        <div className="soc-col-nombre" data-label="Socio" title={socio.nombre}>
          {socio.nombre}
        </div>

        <div className="soc-col-domicilio" data-label="Domicilio" title={socio._dom}>
          {socio._dom}
        </div>

        <div className="soc-col-comentario" data-label="Comentario">
          {socio.comentario ? (
            <span title={socio.comentario}>
              {socio.comentario.length > 36 ? `${socio.comentario.substring(0, 36)}…` : socio.comentario}
            </span>
          ) : null}
        </div>

        <div className="soc-col-acciones">
          {socioSeleccionado?._idStr === socio._idStr && (
            <div className="soc-iconos-acciones">
              <FaInfoCircle
                title="Ver información"
                onClick={(e) => {
                  e.stopPropagation();
                  setSocioInfo(socio);
                  setMostrarModalInfo(true);
                }}
                className="soc-icono"
              />
              <FaEdit
                title="Editar"
                onClick={(e) => {
                  e.stopPropagation();
                  goEditar(socio);
                }}
                className="soc-icono"
              />
              <FaTrash
                title="Eliminar"
                onClick={(e) => {
                  e.stopPropagation();
                  setSocioAEliminar(socio);
                  setMostrarModalEliminar(true);
                }}
                className="soc-icono"
              />
              <FaUserMinus
                title="Dar de baja"
                className="soc-icono"
                onClick={(e) => {
                  e.stopPropagation();
                  setSocioDarBaja(socio);
                  setMostrarModalDarBaja(true);
                }}
              />
            </div>
          )}
        </div>
      </div>
    );
  };

  const Row = React.memo(RowBase, areEqual);

  const Outer = useMemo(() => {
    return React.forwardRef((props, ref) => (
      <div ref={ref} {...props} style={{ ...props.style, overflowX: 'hidden' }} />
    ));
  }, []);

  /* ============================
          RENDER + ISLA
  ============================ */
  const limpiarChip = useCallback((tipo) => {
    setFiltros(prev => {
      if (tipo === 'busqueda') return { ...prev, busqueda: '', showAll: prev.showAll };
      if (tipo === 'id') return { ...prev, busquedaId: '', showAll: false };
      if (tipo === 'letra') return { ...prev, letraSeleccionada: 'TODOS', showAll: false };
      if (tipo === 'categoria') return { ...prev, categoriaSeleccionada: 'OPCIONES', showAll: false };
      if (tipo === 'showAll') return { ...prev, showAll: false };
      return prev;
    });
    if (tipo === 'busqueda') setBusquedaInput('');
  }, [setFiltros]);

  const chips = useMemo(() => {
    const arr = [];
    if (showAll) {
      arr.push({ key: 'showAll', label: 'Mostrar todos' });
      return arr;
    }
    if (busqueda && busqueda.trim()) {
      arr.push({ key: 'busqueda', label: `Texto: "${busqueda.trim()}"` });
    }
    if (busquedaId) {
      arr.push({ key: 'id', label: `ID: ${busquedaId}` });
    }
    if (letraSeleccionada && letraSeleccionada !== 'TODOS') {
      arr.push({ key: 'letra', label: `Letra: ${letraSeleccionada}` });
    }
    if (categoriaSeleccionada && categoriaSeleccionada !== 'OPCIONES') {
      const found = categorias.find(c => String(c.id) === String(categoriaSeleccionada));
      arr.push({ key: 'categoria', label: `Categoría: ${found ? found.descripcion : categoriaSeleccionada}` });
    }
    return arr;
  }, [showAll, busqueda, busquedaId, letraSeleccionada, categoriaSeleccionada, categorias]);

  // >>>>>>>>>> NUEVO: itemSize responsivo (evita "achatar" tarjetas en móvil)
  const dynamicItemSize = useResponsiveItemSize(!!socioSeleccionado);

  return (
    <div className="soc-main-container">
      <div className="soc-container">
        {toast.mostrar && (
          <Toast
            tipo={toast.tipo}
            mensaje={toast.mensaje}
            onClose={() => setToast({ mostrar: false, tipo: '', mensaje: '' })}
            duracion={3000}
          />
        )}

        <BarraSuperior
          cargando={cargando}
          busquedaInput={busquedaInput}
          setBusquedaInput={setBusquedaInput}
          busquedaId={busquedaId}
          letraSeleccionada={letraSeleccionada}
          categoriaSeleccionada={categoriaSeleccionada}
          setFiltros={setFiltros}
          filtrosRef={filtrosRef}
          mostrarFiltros={mostrarFiltros}
          setMostrarFiltros={setMostrarFiltros}
          categorias={categorias}
          startTransition={startTransition}
        />

        <div className="soc-tabla-container">
          <div className="soc-tabla-header-container" style={{ position: 'relative' }}>
            <div className="soc-contador" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FaUsers className="soc-contador-icono" size={14} />
              {showAll
                ? 'Total visibles:'
                : (activeFiltersCount === 0 ? 'Filtrá para ver socios:' : 'Socios filtrados:')}
              <strong>{showAll ? sociosFiltrados.length : (activeFiltersCount === 0 ? 0 : sociosFiltrados.length)}</strong>
            </div>

            {/* Isla de chips */}
            <div
              className="soc-filters-island"
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
                position: 'absolute',
                right: '12px',
                top: '4px',
                maxWidth: '55%',
                alignItems: 'center',
                justifyContent: 'flex-end'
              }}
            >
              {chips.map(ch => (
                <div
                  key={ch.key}
                  className="soc-chip"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 8px',
                    borderRadius: '999px',
                    background: '#f1f5f9',
                    border: '1px solid #e2e8f0',
                    fontSize: 12,
                    whiteSpace: 'nowrap'
                  }}
                  title={ch.label}
                >
                  <span>{ch.label}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); limpiarChip(ch.key); }}
                    className="soc-chip-close"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      lineHeight: 1,
                      padding: 0
                    }}
                    title="Quitar filtro"
                  >
                    <FaTimes size={10} />
                  </button>
                </div>
              ))}
            </div>

            <div className="soc-tabla-header">
              <div className="soc-col-id">ID</div>
              <div className="soc-col-nombre">Apellido y Nombre</div>
              <div className="soc-col-domicilio">Domicilio</div>
              <div className="soc-col-comentario">Comentario</div>
              <div className="soc-col-acciones">Acciones</div>
            </div>
          </div>

          {/* Lista */}
          <div className={`soc-list-container ${animacionActiva ? 'soc-cascade-animation' : ''}`} style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
            {(!showAll && activeFiltersCount === 0) ? (
              <div className="soc-boton-mostrar-container">
                <div className="soc-mensaje-inicial">
                  Aplicá al menos un filtro para ver socios
                </div>
                <button
                  className="soc-boton-mostrar-todos"
                  onClick={() => {
                    setBusquedaInput('');
                    startTransition(() => {
                      setFiltros({
                        busqueda: '',
                        busquedaId: '',
                        letraSeleccionada: 'TODOS',
                        categoriaSeleccionada: 'OPCIONES',
                        showAll: true
                      });
                    });
                    requestAnimationFrame(() => triggerCascade(320));
                  }}
                >
                  Mostrar todos los socios
                </button>
              </div>
            ) : cargando ? (
              <div className="soc-cargando-tabla">
                <div className="soc-spinner" />
                <p className="soc-texto-cargando">Cargando socios...</p>
              </div>
            ) : socios.length === 0 ? (
              <div className="soc-sin-resultados">
                No hay socios registrados
              </div>
            ) : sociosFiltrados.length === 0 ? (
              <div className="soc-sin-resultados">
                No hay resultados con los filtros actuales
              </div>
            ) : (
              <AutoSizer>
                {({ height, width }) => (
                  <List
                    key={`${tablaVersion}-${dynamicItemSize}`}   // fuerza relayout si cambia el alto
                    ref={listRef}
                    height={height}
                    width={width}
                    itemCount={sociosFiltrados.length}
                    itemSize={dynamicItemSize}                
                    itemData={sociosFiltrados}
                    overscanCount={4}
                    outerElementType={Outer}
                    itemKey={(index, data) => data[index]._idStr}
                    onScroll={({ scrollOffset }) => (lastScrollOffsetRef.current = scrollOffset)}
                  >
                    {Row}
                  </List>
                )}
              </AutoSizer>
            )}
          </div>
        </div>

        {/* Barra inferior */}
        <div className="soc-barra-inferior">
          <button className="soc-boton soc-boton-volver" onClick={() => navigate('/panel')}>
            <FaArrowLeft className="soc-boton-icono" /> Volver
          </button>

          <div className="soc-botones-derecha">
            <button className="soc-boton soc-boton-agregar" onClick={() => navigate('/socios/agregar')}>
              <FaUserPlus className="soc-boton-icono" /> Agregar Socio
            </button>
            <button
              className="soc-boton soc-boton-exportar"
              onClick={exportarExcel}
              disabled={cargando || sociosFiltrados.length === 0 || socios.length === 0 || (!showAll && activeFiltersCount === 0)}
            >
              <FaFileExcel className="soc-boton-icono" /> Exportar a Excel
            </button>
            <button className="soc-boton soc-boton-baja" onClick={() => navigate('/socios/baja')}>
              <FaUserSlash className="soc-boton-icono" /> Dados de Baja
            </button>
          </div>
        </div>

        {/* Modales */}
        {ReactDOM.createPortal(
          <ModalEliminarSocio
            mostrar={mostrarModalEliminar}
            socio={socioAEliminar}
            onClose={() => {
              setMostrarModalEliminar(false);
              setSocioAEliminar(null);
            }}
            onEliminar={eliminarSocio}
          />,
          document.body
        )}

        {ReactDOM.createPortal(
          <ModalInfoSocio
            mostrar={mostrarModalInfo}
            socio={socioInfo}
            onClose={() => {
              setMostrarModalInfo(false);
              setSocioInfo(null);
            }}
          />,
          document.body
        )}

        {ReactDOM.createPortal(
          <ModalDarBajaSocio
            mostrar={mostrarModalDarBaja}
            socio={socioDarBaja}
            onClose={() => {
              setMostrarModalDarBaja(false);
              setSocioDarBaja(null);
            }}
            onDarBaja={darDeBajaSocio}
          />,
          document.body
        )}
      </div>
    </div>
  );
};

export default Socios;
