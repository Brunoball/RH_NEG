// src/components/Socios/Socios.jsx
import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
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

// === TUNING PARA PRODUCCIÓN ===
const MIN_SPINNER_MS = 0;
const MAX_CASCADE = 15;
const CASCADE_DISABLE_ABOVE = Infinity;
const NAME_DEBOUNCE_MS = 20;
const ITEM_SIZE = 45;

// Claves de session/local storage
const SS_KEYS = {
  SEL_ID: 'socios_last_sel_id',
  SCROLL: 'socios_last_scroll',
  TS: 'socios_last_ts',
  FILTERS: 'socios_last_filters'
};
const LS_FILTERS = 'filtros_socios';

const BotonesInferiores = React.memo(({ 
  cargando, 
  navigate, 
  sociosFiltrados, 
  socios,
  exportarExcel,
  filtroActivo,
}) => (
  <div className="soc-barra-inferior">
    <button
      className="soc-boton soc-boton-volver"
      onClick={() => navigate('/panel')}
    >
      <FaArrowLeft className="soc-boton-icono" /> Volver
    </button>
    
    <div className="soc-botones-derecha">
      <button
        className="soc-boton soc-boton-agregar"
        onClick={() => navigate('/socios/agregar')}
      >
        <FaUserPlus className="soc-boton-icono" /> Agregar Socio
      </button>
      <button 
        className="soc-boton soc-boton-exportar" 
        onClick={exportarExcel} 
        disabled={cargando || sociosFiltrados.length === 0 || socios.length === 0 || filtroActivo === null}
      >
        <FaFileExcel className="soc-boton-icono" /> Exportar a Excel
      </button>
      <button 
        className="soc-boton soc-boton-baja" 
        onClick={() => navigate('/socios/baja')} 
      >
        <FaUserSlash className="soc-boton-icono" /> Dados de Baja
      </button>
    </div>
  </div>
));

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
  filtroActivo,
  ultimoFiltroActivo,
  categorias
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
    setFiltros(prev => ({ 
      ...prev, 
      letraSeleccionada: letra,
      categoriaSeleccionada: 'OPCIONES',
      busqueda: '',
      busquedaId: '',
      filtroActivo: 'letra'
    }));
    setBusquedaInput('');
    setMostrarSubmenuAlfabetico(false);
    setMostrarFiltros(false);
  }, [setFiltros, setMostrarFiltros, setBusquedaInput]);

  const handleCategoriaClick = useCallback((value) => {
    setFiltros(prev => ({
      ...prev,
      categoriaSeleccionada: value,
      letraSeleccionada: 'TODOS',
      busqueda: '',
      busquedaId: '',
      filtroActivo: value === 'OPCIONES' ? null : 'categoria'
    }));
    setBusquedaInput('');
    setMostrarSubmenuCategoria(false);
    setMostrarFiltros(false);
  }, [setFiltros, setMostrarFiltros, setBusquedaInput]);

  const handleMostrarTodos = useCallback(() => {
    setFiltros(prev => ({ 
      ...prev, 
      letraSeleccionada: 'TODOS',
      categoriaSeleccionada: 'OPCIONES',
      busqueda: '',
      busquedaId: '',
      filtroActivo: 'todos'
    }));
    setBusquedaInput('');
    setMostrarSubmenuAlfabetico(false);
    setMostrarSubmenuCategoria(false);
    setMostrarFiltros(false);
  }, [setFiltros, setMostrarFiltros, setBusquedaInput]);

  const limpiarFiltro = useCallback((tipo) => {
    setFiltros(prev => {
      if (tipo === 'busqueda') {
        return { ...prev, busqueda: '', filtroActivo: null };
      } else if (tipo === 'id') {
        return { ...prev, busquedaId: '', filtroActivo: null };
      } else if (tipo === 'letra') {
        return { ...prev, letraSeleccionada: 'TODOS', filtroActivo: null };
      } else if (tipo === 'categoria') {
        return { ...prev, categoriaSeleccionada: 'OPCIONES', filtroActivo: null };
      }
      return prev;
    });
    if (tipo === 'busqueda') setBusquedaInput('');
  }, [setFiltros, setBusquedaInput]);

  const truncar2 = useCallback((txt) => {
    if (!txt) return '';
    const t = String(txt);
    return t.length > 3 ? `${t.slice(0,3)}..` : t;
  }, []);

  const truncarId2 = useCallback((txt) => {
    const t = String(txt ?? '');
    return t.length > 3 ? `${t.slice(0,3)}..` : t;
  }, []);

  return (
    <div className="soc-barra-superior">
      <div className="soc-titulo-container">
        <h2 className="soc-titulo">Gestión de Socios</h2>
      </div>

      <div className="soc-buscadores-container">
        {/* Buscador por nombre (controlado) */}
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
                  setFiltros(prev => ({ ...prev, busqueda: '', busquedaId: '', filtroActivo: null }));
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
              setFiltros(prev => ({
                ...prev,
                busquedaId: onlyNums,
                busqueda: '',
                letraSeleccionada: 'TODOS',
                categoriaSeleccionada: 'OPCIONES',
                filtroActivo: onlyNums.length >= 1 ? 'id' : null
              }));
              if (onlyNums.length >= 1) setBusquedaInput('');
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
                setFiltros(prev => ({ ...prev, busquedaId: '', filtroActivo: null }));
              }}
            />
          ) : (
            <FaSearch className="soc-buscador-icono" />
          )}
        </div>
      </div>

      {/* Filtros (chips + botón) */}
      <div className="soc-filtros-container" ref={filtrosRef}>
        {/* Chips */}
        <div className="soc-filtros-activos-container">
          {(filtroActivo === 'busqueda' || ultimoFiltroActivo === 'busqueda') && !!busquedaInput && (
            <div className="soc-filtro-activo" key="busqueda" title={busquedaInput}>
              <span className="soc-filtro-activo-busqueda">
                <FaSearch className="soc-filtro-activo-busqueda-icono" size={12} />
                {truncar2(busquedaInput)}
              </span>
              <button 
                className="soc-filtro-activo-cerrar"
                onClick={(e) => { e.stopPropagation(); limpiarFiltro('busqueda'); }}
                title="Quitar filtro"
              >
                <FaTimes size={10} />
              </button>
            </div>
          )}
          {(filtroActivo === 'id' || ultimoFiltroActivo === 'id') && busquedaId && (
            <div className="soc-filtro-activo" key="id" title={`ID: ${busquedaId}`}>
              <span className="soc-filtro-activo-id">
                ID: {truncarId2(busquedaId)}
              </span>
              <button 
                className="soc-filtro-activo-cerrar"
                onClick={(e) => { e.stopPropagation(); limpiarFiltro('id'); }}
                title="Quitar filtro"
              >
                <FaTimes size={10} />
              </button>
            </div>
          )}
          {(filtroActivo === 'letra' || ultimoFiltroActivo === 'letra') && letraSeleccionada !== 'TODOS' && (
            <div className="soc-filtro-activo" key="letra">
              <span className="soc-filtro-activo-letra">{letraSeleccionada}</span>
              <button 
                className="soc-filtro-activo-cerrar"
                onClick={(e) => { e.stopPropagation(); limpiarFiltro('letra'); }}
                title="Quitar filtro"
              >
                <FaTimes size={10} />
              </button>
            </div>
          )}
          {(filtroActivo === 'categoria' || ultimoFiltroActivo === 'categoria') && categoriaSeleccionada !== 'OPCIONES' && (
            <div
              className="soc-filtro-activo"
              key="categoria"
              title={(() => {
                const found = categorias.find(c => String(c.id) === String(categoriaSeleccionada));
                return found ? found.descripcion : categoriaSeleccionada;
              })()}
            >
              <span className="soc-filtro-activo-categoria">
                {(() => {
                  const found = categorias.find(c => String(c.id) === String(categoriaSeleccionada));
                  const label = found ? found.descripcion : String(categoriaSeleccionada);
                  return label ? (label.length > 2 ? `${label.slice(0,2)}..` : label) : '';
                })()}
              </span>
              <button 
                className="soc-filtro-activo-cerrar"
                onClick={(e) => { e.stopPropagation(); limpiarFiltro('categoria'); }}
                title="Quitar filtro"
              >
                <FaTimes size={10} />
              </button>
            </div>
          )}
        </div>

        {/* Botón filtros */}
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

        {/* Panel menú */}
        {mostrarFiltros && (
          <div 
            className="soc-menu-filtros soc-menu-filtros--emp"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="soc-filtros-menu-item"
              onClick={() => toggleSubmenu('alfabetico')}
            >
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

            <div
              className="soc-filtros-menu-item"
              onClick={() => toggleSubmenu('categoria')}
            >
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
              <span>Mostrar Todas</span>
            </div>
          </div>
        )}
      </div>
      {/* FIN FILTROS */}
    </div>
  );
});

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

  // Animación de cascada controlada
  const [animacionActiva, setAnimacionActiva] = useState(false);
  const [tablaVersion, setTablaVersion] = useState(0);
  const [ultimoFiltroActivo, setUltimoFiltroActivo] = useState(null);
  const [needsRefresh, setNeedsRefresh] = useState(false);

  const filtrosRef = useRef(null);
  const listRef = useRef(null);
  const lastScrollOffsetRef = useRef(0);
  const navigate = useNavigate();
  const location = useLocation();

  const [toast, setToast] = useState({ mostrar: false, tipo: '', mensaje: '' });

  // 1) Estado de filtros inicial desde localStorage
  const [filtros, setFiltros] = useState(() => {
    try {
      const saved = localStorage.getItem(LS_FILTERS);
      return saved ? JSON.parse(saved) : {
        busqueda: '',
        busquedaId: '',
        letraSeleccionada: 'TODOS',
        categoriaSeleccionada: 'OPCIONES',
        filtroActivo: null
      };
    } catch {
      return {
        busqueda: '',
        busquedaId: '',
        letraSeleccionada: 'TODOS',
        categoriaSeleccionada: 'OPCIONES',
        filtroActivo: null
      };
    }
  });

  const { busqueda, busquedaId, letraSeleccionada, categoriaSeleccionada, filtroActivo } = filtros;

  // 2) Input controlado para buscador + debounce => actualiza filtros.busqueda
  const [busquedaInput, setBusquedaInput] = useState(busqueda);
  useEffect(() => {
    setBusquedaInput(filtros.busqueda || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  useEffect(() => {
    const t = setTimeout(() => {
      setFiltros(prev => ({
        ...prev,
        busqueda: busquedaInput || '',
        busquedaId: '',
        letraSeleccionada: 'TODOS',
        categoriaSeleccionada: 'OPCIONES',
        filtroActivo: busquedaInput ? 'busqueda' : (prev.filtroActivo === 'busqueda' ? null : prev.filtroActivo)
      }));
    }, NAME_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [busquedaInput]);

  // 3) Persistencia de filtros
  useEffect(() => {
    try {
      sessionStorage.setItem(SS_KEYS.FILTERS, JSON.stringify(filtros));
      localStorage.setItem(LS_FILTERS, JSON.stringify(filtros));
    } catch {}
  }, [filtros]);

  // 4) Restaurar filtros de sessionStorage al montar (si existen)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SS_KEYS.FILTERS);
      if (raw) {
        const parsed = JSON.parse(raw);
        setFiltros(prev => ({ ...prev, ...parsed }));
        setBusquedaInput(parsed.busqueda || '');
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (filtroActivo !== null) setUltimoFiltroActivo(filtroActivo);
  }, [filtroActivo]);

  const mostrarToast = useCallback((mensaje, tipo = 'exito') => {
    setToast({ mostrar: true, tipo, mensaje });
  }, []);

  // Normalizadores
  const getId = (s) => String(s?.id_socio ?? s?.id ?? '').trim();
  const normalizeId = (v) => String(v ?? '').replace(/\D/g, '');
  const equalId = (s, needle) => {
    const a = normalizeId(getId(s));
    const b = normalizeId(needle);
    if (!b) return true;
    return a === b;
  };

  // Filtrado client-side
  const sociosFiltrados = useMemo(() => {
    let resultados = (socios || []).filter(s => Number(s?.activo) === 1);

    const exigirEstadoActivo = filtroActivo === 'categoria';

    if (filtroActivo === 'id' && busquedaId !== '') {
      resultados = resultados.filter((s) => equalId(s, busquedaId));
      return resultados;
    }

    if (filtroActivo === 'busqueda' && busqueda) {
      const q = busqueda.toLowerCase();
      resultados = resultados.filter((s) => (s.nombre ?? '').toLowerCase().includes(q));
    } else if (filtroActivo === 'letra' && letraSeleccionada && letraSeleccionada !== 'TODOS') {
      const ql = letraSeleccionada.toLowerCase();
      resultados = resultados.filter((s) => (s.nombre ?? '').toLowerCase().startsWith(ql));
    } else if (filtroActivo === 'categoria' && categoriaSeleccionada && categoriaSeleccionada !== 'OPCIONES') {
      resultados = resultados.filter((s) => String(s?.id_categoria) === String(categoriaSeleccionada));
    } else if (filtroActivo === 'todos') {
      // todos los activos
    }

    if (exigirEstadoActivo) {
      resultados = resultados.filter((s) => Number(s?.id_estado) === 2);
    }

    return resultados;
  }, [socios, busqueda, busquedaId, letraSeleccionada, categoriaSeleccionada, filtroActivo]);

  // === Animación de cascada ===
  const allowCascade = sociosFiltrados.length <= CASCADE_DISABLE_ABOVE;
  const triggerCascade = useCallback((duration = 400) => {
    if (!allowCascade) return;
    setAnimacionActiva(true);
    setTablaVersion(v => v + 1);
    const t = setTimeout(() => setAnimacionActiva(false), duration);
    return () => clearTimeout(t);
  }, [allowCascade]);

  // Dispara cascada al cambiar filtros
  const lastSignatureRef = useRef(null);
  useEffect(() => {
    if (cargando) return;
    if (filtroActivo === null) return;
    if (sociosFiltrados.length === 0) return;

    const signature = JSON.stringify({
      filtroActivo,
      busqueda,
      busquedaId,
      letraSeleccionada,
      categoriaSeleccionada,
      count: sociosFiltrados.length
    });

    if (lastSignatureRef.current !== signature) {
      lastSignatureRef.current = signature;
      requestAnimationFrame(() => triggerCascade(360));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroActivo, busqueda, busquedaId, letraSeleccionada, categoriaSeleccionada, sociosFiltrados.length, cargando]);

  // Cerrar menús / deselect fuera
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

  // === RESTAURACIÓN de selección/scroll al volver ===
  const restorePendingRef = useRef(false);
  const restoredOnceRef = useRef(false);

  // PREFETCH + navegación a Editar (rápido)
  const goEditar = useCallback((socio) => {
    try {
      const currentOffset = lastScrollOffsetRef.current || 0;
      sessionStorage.setItem(SS_KEYS.SEL_ID, String(socio.id_socio));
      sessionStorage.setItem(SS_KEYS.SCROLL, String(currentOffset));
      sessionStorage.setItem(SS_KEYS.TS, String(Date.now()));
      sessionStorage.setItem(SS_KEYS.FILTERS, JSON.stringify(filtros));
      // Guardamos el socio para que EditarSocio pinte instantáneo
      sessionStorage.setItem(`socio_prefetch_${socio.id_socio}`, JSON.stringify(socio));
    } catch {}
    navigate(`/socios/editar/${socio.id_socio}`, { state: { refresh: true, socio } });
  }, [navigate, filtros]);

  useEffect(() => {
    const state = location.state;
    if (state && state.refresh) {
      setNeedsRefresh(true);
      restorePendingRef.current = true;
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

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
        setSocios(data.socios || []);
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
        triggerCascade(480);
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

  // Carga inicial
  useEffect(() => {
    cargarDatos();
    return () => {
      fetchAbortRef.current.socios?.abort?.();
      fetchAbortRef.current.listas?.abort?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recarga cuando needsRefresh sea true
  useEffect(() => {
    if (needsRefresh) {
      cargarDatos();
      setNeedsRefresh(false);
    }
  }, [needsRefresh, cargarDatos]);

  // Restauración (una vez) cuando hay datos y lista lista
  useEffect(() => {
    if (!restorePendingRef.current) return;
    if (restoredOnceRef.current) return;
    if (cargando) return;
    if (!listRef.current) return;
    if (!sociosFiltrados || sociosFiltrados.length === 0) return;

    try {
      const rawFilters = sessionStorage.getItem(SS_KEYS.FILTERS);
      if (rawFilters) {
        const parsed = JSON.parse(rawFilters);
        setFiltros(prev => ({ ...prev, ...parsed }));
        setBusquedaInput(parsed.busqueda || '');
      }

      const selId = sessionStorage.getItem(SS_KEYS.SEL_ID);
      const savedOffset = Number(sessionStorage.getItem(SS_KEYS.SCROLL) || '0');

      if (selId) {
        const idx = sociosFiltrados.findIndex(s => String(s.id_socio) === String(selId));

        if (idx >= 0) {
          setSocioSeleccionado(sociosFiltrados[idx]);
          listRef.current.scrollToItem(idx, 'smart');
        } else {
          listRef.current.scrollTo(savedOffset);
        }
      }

      restoredOnceRef.current = true;
      restorePendingRef.current = false;
      sessionStorage.removeItem(SS_KEYS.SEL_ID);
      sessionStorage.removeItem(SS_KEYS.SCROLL);
      sessionStorage.removeItem(SS_KEYS.TS);
      // Mantenemos FILTERS durante la sesión
    } catch {
      // no-op
    }
  }, [cargando, sociosFiltrados]);

  const manejarSeleccion = useCallback((socio) => {
    setSocioSeleccionado(prev => prev?.id_socio !== socio.id_socio ? socio : null);
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
        triggerCascade(320);
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
        triggerCascade(320);
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

  const construirDomicilio = useCallback((domicilio, numero) => {
    const calle = (domicilio ?? '').trim();
    const num = (numero ?? '').trim();
    if (!calle && !num) return '';
    if (calle && num && calle.includes(num)) return calle;
    return `${calle} ${num}`.trim();
  }, []);

  const exportarExcel = useCallback(() => {
    if (socios.length === 0) {
      mostrarToast('No hay socios registrados para exportar.', 'error');
      return;
    }
    if (filtroActivo === null) {
      mostrarToast('Aplicá al menos un filtro para exportar los socios.', 'error');
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
      Domicilio: construirDomicilio(s.domicilio, s.numero),
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
    XLSX.utils.book_append_sheet(wb, ws, "Socios (visibles)");

    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
    saveAs(blob, 'Socios_visibles.xlsx');
  }, [socios, sociosFiltrados, filtroActivo, construirDomicilio, mostrarToast]);

  // === Row virtualizada ===
  const RowBase = ({ index, style, data }) => {
    const socio = data[index];
    const esFilaPar = index % 2 === 0;

    // animamos SOLO los primeros MAX_CASCADE
    const shouldAnimate = animacionActiva && index < MAX_CASCADE;
    const animationDelay = shouldAnimate ? `${index * 0.035}s` : '0s';

    return (
      <div
        style={{
          ...style,
          background: esFilaPar ? 'rgba(255, 255, 255, 0.9)' : 'rgba(179, 180, 181, 0.47)',
          animationDelay,
          animationName: shouldAnimate ? 'fadeIn' : 'none',
          animationFillMode: 'forwards',
          animationDuration: shouldAnimate ? '.3s' : '0s',
          opacity: shouldAnimate ? 0 : 1,
        }}
        className={`soc-tabla-fila ${socioSeleccionado?.id_socio === socio.id_socio ? 'soc-fila-seleccionada' : ''}`}
        onClick={() => manejarSeleccion(socio)}
      >
        <div className="soc-col-id" title={socio.id_socio}>{socio.id_socio}</div>
        <div className="soc-col-nombre" title={socio.nombre}>{socio.nombre}</div>
        <div className="soc-col-domicilio" title={construirDomicilio(socio.domicilio, socio.numero)}>
          {construirDomicilio(socio.domicilio, socio.numero)}
        </div>
        <div className="soc-col-comentario">
          {socio.comentario ? (
            <span title={socio.comentario}>
              {socio.comentario.length > 36 ? `${socio.comentario.substring(0, 36)}…` : socio.comentario}
            </span>
          ) : null}
        </div>
        <div className="soc-col-acciones">
          {socioSeleccionado?.id_socio === socio.id_socio && (
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

  // --- FIX: outerElementType estable para evitar remount del List ---
  const Outer = useMemo(() => {
    return React.forwardRef((props, ref) => (
      <div ref={ref} {...props} style={{ ...props.style, overflowX: 'hidden' }} />
    ));
  }, []); // identidad estable

  return (
    <div className="soc-main-container">
      <div className="soc-container">
        {toast.mostrar && (
          <Toast 
            tipo={toast.tipo} 
            mensaje={toast.mensaje} 
            onClose={() => setToast({mostrar: false, tipo: '', mensaje: ''})}
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
          filtroActivo={filtroActivo}
          ultimoFiltroActivo={ultimoFiltroActivo}
          categorias={categorias}
        />

        <div className="soc-tabla-container">
          <div className="soc-tabla-header-container">
            <div className="soc-contador">
              <FaUsers className="soc-contador-icono" size={14} />
              {filtroActivo === 'todos' ? 'Total visibles:' : 
               filtroActivo === null ? 'Filtrá para ver socios:' : 'Socios filtrados:'} 
              <strong>
                {filtroActivo === null ? 0 : sociosFiltrados.length}
              </strong>
            </div>

            <div className="soc-tabla-header">
              <div className="soc-col-id">ID</div>
              <div className="soc-col-nombre">Apellido y Nombre</div>
              <div className="soc-col-domicilio">Domicilio</div>
              <div className="soc-col-comentario">Comentario</div>
              <div className="soc-col-acciones">Acciones</div>
            </div>
          </div>

          {/* Zona de lista */}
          <div
            className={`soc-list-container ${animacionActiva ? 'soc-cascade-animation' : ''}`}
            style={{ flex: 1, overflow: 'hidden', position: 'relative' }}
          >
            {filtroActivo === null ? (
              <div className="soc-boton-mostrar-container">
                <div className="soc-mensaje-inicial">
                  Aplicá al menos un filtro para ver socios
                </div>
                <button
                  className="soc-boton-mostrar-todos"
                  onClick={() => {
                    setFiltros({
                      busqueda: '',
                      busquedaId: '',
                      letraSeleccionada: 'TODOS',
                      categoriaSeleccionada: 'OPCIONES',
                      filtroActivo: 'todos'
                    });
                    setBusquedaInput('');
                    requestAnimationFrame(() => triggerCascade(360));
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
                    key={tablaVersion}
                    ref={listRef}
                    height={height}
                    width={width}
                    itemCount={sociosFiltrados.length}
                    itemSize={ITEM_SIZE}
                    itemData={sociosFiltrados}
                    overscanCount={5}
                    outerElementType={Outer}
                    itemKey={(index, data) => data[index].id_socio}
                    onScroll={({ scrollOffset }) => (lastScrollOffsetRef.current = scrollOffset)}
                  >
                    {Row}
                  </List>
                )}
              </AutoSizer>
            )}
          </div>
        </div>

        <BotonesInferiores 
          cargando={cargando} 
          navigate={navigate} 
          sociosFiltrados={sociosFiltrados} 
          socios={socios}
          exportarExcel={exportarExcel}
          filtroActivo={filtroActivo}
        />

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
