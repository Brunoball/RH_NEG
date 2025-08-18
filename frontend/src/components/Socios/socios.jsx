import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { FixedSizeList as List } from 'react-window';
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

const BotonesInferiores = React.memo(({ 
  cargando, 
  navigate, 
  sociosFiltrados, 
  socios,
  exportarExcel,
  filtroActivo,
  setFiltros
}) => (
  <div className="soc-barra-inferior">
    <button
      className="soc-boton soc-boton-volver"
      onClick={() => {
        setFiltros({
          busqueda: '',
          busquedaId: '',
          letraSeleccionada: 'TODOS',
          categoriaSeleccionada: 'OPCIONES',
          filtroActivo: null
        });
        localStorage.removeItem('filtros_socios');
        navigate('/panel');
      }}
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
  busqueda, 
  busquedaId,
  letraSeleccionada, 
  categoriaSeleccionada,
  setFiltros, 
  filtrosRef, 
  mostrarFiltros, 
  setMostrarFiltros,
  filtroActivo,
  setAnimacionActiva,
  ultimoFiltroActivo,
  categorias
}) => {
  const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  // ↓↓↓ NUEVO: submenús tipo Empresas
  const [mostrarSubmenuAlfabetico, setMostrarSubmenuAlfabetico] = useState(false);
  const [mostrarSubmenuCategoria, setMostrarSubmenuCategoria] = useState(false);

  const toggleSubmenu = useCallback(( cual ) => {
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
    setMostrarSubmenuAlfabetico(false);
    setMostrarFiltros(false);
    setAnimacionActiva(true);
    setTimeout(() => setAnimacionActiva(false), 800);
  }, [setFiltros, setMostrarFiltros, setAnimacionActiva]);

  const handleCategoriaClick = useCallback((value) => {
    setFiltros(prev => ({
      ...prev,
      categoriaSeleccionada: value,
      letraSeleccionada: 'TODOS',
      busqueda: '',
      busquedaId: '',
      filtroActivo: value === 'OPCIONES' ? null : 'categoria'
    }));
    setMostrarSubmenuCategoria(false);
    setMostrarFiltros(false);
    setAnimacionActiva(true);
    setTimeout(() => setAnimacionActiva(false), 500);
  }, [setFiltros, setMostrarFiltros, setAnimacionActiva]);

  const handleMostrarTodos = useCallback(() => {
    setFiltros(prev => ({ 
      ...prev, 
      letraSeleccionada: 'TODOS',
      categoriaSeleccionada: 'OPCIONES',
      busqueda: '',
      busquedaId: '',
      filtroActivo: 'todos'
    }));
    setMostrarSubmenuAlfabetico(false);
    setMostrarSubmenuCategoria(false);
    setMostrarFiltros(false);
    setAnimacionActiva(true);
    setTimeout(() => setAnimacionActiva(false), 600);
  }, [setFiltros, setMostrarFiltros, setAnimacionActiva]);

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
    setAnimacionActiva(true);
    setTimeout(() => setAnimacionActiva(false), 300);
  }, [setFiltros, setAnimacionActiva]);

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
            value={busqueda}
            onChange={(e) => {
              setFiltros(prev => ({ 
                ...prev, 
                busqueda: e.target.value,
                busquedaId: '',
                letraSeleccionada: 'TODOS',
                categoriaSeleccionada: 'OPCIONES',
                filtroActivo: e.target.value ? 'busqueda' : null
              }));
              setAnimacionActiva(true);
              setTimeout(() => setAnimacionActiva(false), 800);
            }}
            className="soc-buscador"
            disabled={cargando}
          />
          <div className="soc-buscador-iconos">
            {busqueda ? (
              <FaTimes 
                className="soc-buscador-icono" 
                onClick={() => {
                  setFiltros(prev => ({ ...prev, busqueda: '', busquedaId: '', filtroActivo: null }));
                  setAnimacionActiva(true);
                  setTimeout(() => setAnimacionActiva(false), 600);
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
              setAnimacionActiva(true);
              setTimeout(() => setAnimacionActiva(false), 300);
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
                setAnimacionActiva(true);
                setTimeout(() => setAnimacionActiva(false), 500);
              }}
            />
          ) : (
            <FaSearch className="soc-buscador-icono" />
          )}
        </div>
      </div>

      {/* ==== NUEVO BLOQUE: Dropdown calcado del de Empresas ==== */}
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

        {/* Chips de filtros activos (se mantienen) */}
        <div className="soc-filtros-activos-container">
          {(filtroActivo === 'busqueda' || ultimoFiltroActivo === 'busqueda') && busqueda && (
            <div className="soc-filtro-activo" key="busqueda">
              <span className="soc-filtro-activo-busqueda">
                <FaSearch className="soc-filtro-activo-busqueda-icono" size={12} />
                {busqueda.length > 3 ? `${busqueda.substring(0, 3)}...` : busqueda}
              </span>
              <button 
                className="soc-filtro-activo-cerrar"
                onClick={(e) => {
                  e.stopPropagation();
                  limpiarFiltro('busqueda');
                }}
                title="Quitar filtro"
              >
                <FaTimes size={10} />
              </button>
            </div>
          )}
          {(filtroActivo === 'id' || ultimoFiltroActivo === 'id') && busquedaId && (
            <div className="soc-filtro-activo" key="id">
              <span className="soc-filtro-activo-id">
                ID: {busquedaId.length > 3 ? `${busquedaId.slice(0, 3)}...` : busquedaId}
              </span>
              <button 
                className="soc-filtro-activo-cerrar"
                onClick={(e) => {
                  e.stopPropagation();
                  limpiarFiltro('id');
                }}
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
                onClick={(e) => {
                  e.stopPropagation();
                  limpiarFiltro('letra');
                }}
                title="Quitar filtro"
              >
                <FaTimes size={10} />
              </button>
            </div>
          )}
          {(filtroActivo === 'categoria' || ultimoFiltroActivo === 'categoria') && categoriaSeleccionada !== 'OPCIONES' && (
            <div className="soc-filtro-activo" key="categoria">
              <span className="soc-filtro-activo-categoria">
                Cat: {(() => {
                  const found = categorias.find(c => String(c.id) === String(categoriaSeleccionada));
                  return found ? found.descripcion : categoriaSeleccionada;
                })()}
              </span>
              <button 
                className="soc-filtro-activo-cerrar"
                onClick={(e) => {
                  e.stopPropagation();
                  limpiarFiltro('categoria');
                }}
                title="Quitar filtro"
              >
                <FaTimes size={10} />
              </button>
            </div>
          )}
        </div>
        
        {/* Panel de filtros con submenús, igual al patrón de Empresas */}
        {mostrarFiltros && (
          <div 
            className="soc-menu-filtros soc-menu-filtros--emp"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Ítem 1: Alfabético */}
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
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLetraClick(letra);
                      }}
                      title={`Filtrar por ${letra}`}
                    >
                      {letra}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Ítem 2: Categorías */}
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
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCategoriaClick(String(cat.id));
                        }}
                        title={`Filtrar por ${cat.descripcion}`}
                      >
                        {cat.descripcion}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Ítem 3: Mostrar todas */}
            <div
              className="soc-filtros-menu-item soc-filtros-menu-item__mostrar-todas"
              onClick={(e) => { e.stopPropagation(); handleMostrarTodos(); }}
            >
              <span>Mostrar Todas</span>
            </div>
          </div>
        )}
      </div>
      {/* ==== FIN NUEVO BLOQUE ==== */}
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
  const [bloquearInteraccion, setBloquearInteraccion] = useState(true);
  const [animacionActiva, setAnimacionActiva] = useState(false);
  const [tooltipVisible, setTooltipVisible] = useState(null);
  const [ultimoFiltroActivo, setUltimoFiltroActivo] = useState(null);
  const filtrosRef = useRef(null);
  const navigate = useNavigate();

  const [toast, setToast] = useState({
    mostrar: false,
    tipo: '',
    mensaje: ''
  });

  const [filtros, setFiltros] = useState(() => {
    const saved = localStorage.getItem('filtros_socios');
    return saved ? JSON.parse(saved) : {
      busqueda: '',
      busquedaId: '',
      letraSeleccionada: 'TODOS',
      categoriaSeleccionada: 'OPCIONES',
      filtroActivo: null
    };
  });

  const { busqueda, busquedaId, letraSeleccionada, categoriaSeleccionada, filtroActivo } = filtros;

  // Helpers ID
  const getId = (s) => String(s?.id_socio ?? s?.id ?? '').trim();
  const normalizeId = (v) => String(v ?? '').replace(/\D/g, '');
  const equalId = (s, needle) => {
    const a = normalizeId(getId(s));
    const b = normalizeId(needle);
    if (!b) return true;
    return a === b;
  };

  /* Visibles */
  const sociosFiltrados = useMemo(() => {
    let resultados = (socios || []).filter(s => Number(s?.activo) === 1);

    const exigirEstadoActivo = filtroActivo === 'categoria';

    if (filtroActivo === 'id' && busquedaId !== '') {
      resultados = resultados.filter((s) => equalId(s, busquedaId));
      return resultados;
    }

    if (filtroActivo === 'busqueda' && busqueda) {
      resultados = resultados.filter((s) =>
        (s.nombre ?? '').toLowerCase().includes(busqueda.toLowerCase())
      );
    } else if (filtroActivo === 'letra' && letraSeleccionada && letraSeleccionada !== 'TODOS') {
      resultados = resultados.filter((s) =>
        (s.nombre ?? '').toLowerCase().startsWith(letraSeleccionada.toLowerCase())
      );
    } else if (filtroActivo === 'categoria' && categoriaSeleccionada && categoriaSeleccionada !== 'OPCIONES') {
      resultados = resultados.filter((s) => 
        String(s?.id_categoria) === String(categoriaSeleccionada)
      );
    } else if (filtroActivo === 'todos') {
      // nada extra
    }

    if (exigirEstadoActivo) {
      resultados = resultados.filter((s) => Number(s?.id_estado) === 2);
    }

    return resultados;
  }, [socios, busqueda, busquedaId, letraSeleccionada, categoriaSeleccionada, filtroActivo]);

  // UX
  useEffect(() => {
    if (sociosFiltrados.length > 0) {
      const timer = setTimeout(() => setBloquearInteraccion(false), 300);
      return () => clearTimeout(timer);
    }
  }, [sociosFiltrados]);

  useEffect(() => {
    const handleClickOutsideFiltros = (event) => {
      if (filtrosRef.current && !filtrosRef.current.contains(event.target)) {
        // Cierra todo como en Empresas
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

  const mostrarToast = useCallback((mensaje, tipo = 'exito') => {
    setToast({ mostrar: true, tipo, mensaje });
  }, []);

  // Carga inicial
  useEffect(() => {
    const cargarDatosIniciales = async () => {
      try {
        setCargando(true);
        const response = await fetch(`${BASE_URL}/api.php?action=socios`);
        const data = await response.json();
        if (data.exito) {
          setSocios(data.socios || []);
        } else {
          mostrarToast(`Error al obtener socios: ${data.mensaje}`, 'error');
        }

        try {
          const respListas = await fetch(`${BASE_URL}/api.php?action=listas`);
          const dataListas = await respListas.json();
          if (dataListas?.exito && dataListas?.listas?.categorias) {
            setCategorias(dataListas.listas.categorias);
          } else {
            setCategorias([]);
          }
        } catch {
          setCategorias([]);
        }
      } catch (error) {
        mostrarToast('Error de red al obtener datos', 'error');
      } finally {
        setCargando(false);
      }
    };

    cargarDatosIniciales();

    const handlePopState = () => {
      if (window.location.pathname === '/panel') {
        setFiltros({
          busqueda: '',
          busquedaId: '',
          letraSeleccionada: 'TODOS',
          categoriaSeleccionada: 'OPCIONES',
          filtroActivo: null
        });
        localStorage.removeItem('filtros_socios');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [mostrarToast]);

  // Persistencia filtros
  useEffect(() => {
    localStorage.setItem('filtros_socios', JSON.stringify(filtros));
  }, [filtros]);

  useEffect(() => {
    if (filtroActivo !== null) setUltimoFiltroActivo(filtroActivo);
  }, [filtroActivo]);

  // Acciones
  const manejarSeleccion = useCallback((socio) => {
    if (bloquearInteraccion || animacionActiva) return;
    setSocioSeleccionado(prev => 
      prev?.id_socio !== socio.id_socio ? socio : null
    );
  }, [bloquearInteraccion, animacionActiva]);

  const toggleTooltip = useCallback((id, e) => {
    e.stopPropagation();
    setTooltipVisible(prev => prev === id ? null : id);
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
      } else {
        mostrarToast(`Error al eliminar: ${data.mensaje}`, 'error');
      }
    } catch (error) {
      mostrarToast('Error de red al intentar eliminar', 'error');
    } finally {
      setMostrarModalEliminar(false);
      setSocioAEliminar(null);
    }
  }, [mostrarToast]);

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
      } else {
        mostrarToast(`Error: ${data.mensaje}`, 'error');
      }
    } catch (error) {
      mostrarToast('Error de red al intentar dar de baja', 'error');
    } finally {
      setMostrarModalDarBaja(false);
      setSocioDarBaja(null);
    }
  }, [mostrarToast]);

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

  // Fila virtualizada
  const Row = React.memo(({ index, style, data }) => {
    const socio = data[index];
    const esFilaPar = index % 2 === 0;
    const animationDelay = `${index * 0.05}s`;
    
    return (
      <div
        style={{
          ...style,
          background: esFilaPar ? 'rgba(255, 255, 255, 0.9)' : 'rgba(179, 180, 181, 0.47)',
          animationDelay: animacionActiva ? animationDelay : '0s',
          animationName: animacionActiva ? 'fadeIn' : 'none'
        }}
        className={`soc-tabla-fila ${socioSeleccionado?.id_socio === socio.id_socio ? 'soc-fila-seleccionada' : ''}`}
        onClick={() => !animacionActiva && manejarSeleccion(socio)}
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
                  navigate(`/socios/editar/${socio.id_socio}`);
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
  });

  return (
    <div className={`soc-main-container ${animacionActiva ? 'soc-cascade-animation' : ''}`}>
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
          busqueda={busqueda}
          busquedaId={busquedaId}
          letraSeleccionada={letraSeleccionada}
          categoriaSeleccionada={categoriaSeleccionada}
          setFiltros={setFiltros}
          filtrosRef={filtrosRef}
          mostrarFiltros={mostrarFiltros}
          setMostrarFiltros={setMostrarFiltros}
          filtroActivo={filtroActivo}
          setAnimacionActiva={setAnimacionActiva}
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
                  setAnimacionActiva(true);
                  setTimeout(() => setAnimacionActiva(false), 500);
                }}
              >
                Mostrar todos los socios
              </button>
            </div>
          ) : cargando ? (
            <div className="soc-skeleton-rows">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="soc-skeleton-row"></div>
              ))}
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
            <List
              height={2000}
              itemCount={sociosFiltrados.length}
              itemSize={45}
              width="100%"
              itemData={sociosFiltrados}
              overscanCount={10}
              itemKey={(index, data) => data[index].id_socio}
            >
              {Row}
            </List>
          )}
        </div>

        <BotonesInferiores 
          cargando={cargando} 
          navigate={navigate} 
          sociosFiltrados={sociosFiltrados} 
          socios={socios}
          exportarExcel={exportarExcel}
          filtroActivo={filtroActivo}
          setFiltros={setFiltros}
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
