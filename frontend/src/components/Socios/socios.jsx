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
  FaSync,
  FaUsers,
  FaEllipsisH
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
  setFiltros, 
  filtrosRef, 
  mostrarFiltros, 
  setMostrarFiltros,
  filtroActivo,
  setAnimacionActiva,
  ultimoFiltroActivo
}) => {
  const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  const handleLetraClick = useCallback((letra) => {
    setFiltros(prev => ({ 
      ...prev, 
      letraSeleccionada: letra,
      busqueda: '',
      busquedaId: '',
      filtroActivo: 'letra'
    }));
    setMostrarFiltros(false);
    setAnimacionActiva(true);
    setTimeout(() => setAnimacionActiva(false), 1000);
  }, [setFiltros, setMostrarFiltros, setAnimacionActiva]);

  const handleMostrarTodos = useCallback(() => {
    setFiltros(prev => ({ 
      ...prev, 
      letraSeleccionada: 'TODOS',
      busqueda: '',
      busquedaId: '',
      filtroActivo: 'todos'
    }));
    setMostrarFiltros(false);
    setAnimacionActiva(true);
    setTimeout(() => setAnimacionActiva(false), 1000);
  }, [setFiltros, setMostrarFiltros, setAnimacionActiva]);

  return (
    <div className="soc-barra-superior">
      <div className="soc-titulo-container">
        <h2 className="soc-titulo">Gestión de Socios</h2>
      </div>

      <div className="soc-buscadores-container">
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
                filtroActivo: e.target.value ? 'busqueda' : null
              }));
              setAnimacionActiva(true);
              setTimeout(() => setAnimacionActiva(false), 1000);
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
                  setTimeout(() => setAnimacionActiva(false), 1000);
                }}
              />
            ) : (
              <FaSearch className="soc-buscador-icono" />
            )}
          </div>
        </div>

        <div className="soc-buscador-container soc-buscador-id-container">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="ID"
            value={busquedaId}
            onChange={(e) => {
              const onlyNums = e.target.value.replace(/\D/g, '');
              const limited = onlyNums.slice(0, 10); // Límite de 10 dígitos
              setFiltros(prev => ({
                ...prev,
                busquedaId: limited,
                busqueda: '',
                letraSeleccionada: 'TODOS',
                // Activar filtro por ID sólo si hay 3+ dígitos
                filtroActivo: limited.length >= 3 ? 'id' : null
              }));
              
              if ((limited && filtroActivo !== 'id') || (!limited && filtroActivo !== null)) {
                setAnimacionActiva(true);
                setTimeout(() => setAnimacionActiva(false), 300);
              }
            }}
            className="soc-buscador soc-buscador-id"
            disabled={cargando}
            title="Buscar por ID (match exacto)"
            maxLength={10} // Límite de longitud en el input
          />
          {busquedaId ? (
            <FaTimes
              className="soc-buscador-icono" 
              onClick={() => {
                setFiltros(prev => ({ ...prev, busquedaId: '', filtroActivo: null }));
                setAnimacionActiva(true);
                setTimeout(() => setAnimacionActiva(false), 600);
              }}
            />
          ) : (
            <FaSearch className="soc-buscador-icono" />
          )}
        </div>
      </div>

      <div className="soc-filtros-container" ref={filtrosRef}>
        <button 
          className="soc-boton-filtros"
          onClick={(e) => {
            e.stopPropagation();
            setMostrarFiltros(!mostrarFiltros);
          }}
          disabled={cargando}
        >
          Filtros {mostrarFiltros ? '▲' : '▼'}
        </button>
        
        <div className="soc-filtros-activos-container">
          {(filtroActivo === 'busqueda' || ultimoFiltroActivo === 'busqueda') && busqueda && (
            <div className="soc-filtro-activo" key="busqueda">
              <span className="soc-filtro-activo-busqueda">
                <FaSearch className="soc-filtro-activo-busqueda-icono" size={12} />
                {busqueda.length > 3 ? `${busqueda.substring(0, 3)}...` : busqueda}
              </span>
            </div>
          )}
          {(filtroActivo === 'id' || ultimoFiltroActivo === 'id') && busquedaId && (
            <div className="soc-filtro-activo" key="id">
              <span
                className="soc-filtro-activo-id"
                title={`ID: ${busquedaId}`} // Tooltip con el ID completo
              >
                ID: {busquedaId.length > 3 ? `${busquedaId.slice(0, 3)}...` : busquedaId}
              </span>
            </div>
          )}
          {(filtroActivo === 'letra' || ultimoFiltroActivo === 'letra') && letraSeleccionada !== 'TODOS' && (
            <div className="soc-filtro-activo" key="letra">
              <span className="soc-filtro-activo-letra">{letraSeleccionada}</span>
            </div>
          )}
        </div>
        
        {mostrarFiltros && (
          <div 
            className="soc-menu-filtros"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="soc-letras-filtro">
              {letras.map((letra) => (
                <button
                  key={letra}
                  className={`soc-letra-filtro ${letraSeleccionada === letra ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLetraClick(letra);
                  }}
                >
                  {letra}
                </button>
              ))}
            </div>
            <button
              className="soc-boton-todos"
              onClick={(e) => {
                e.stopPropagation();
                handleMostrarTodos();
              }}
            >
              Mostrar Todos
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

const Socios = () => {
  const [socios, setSocios] = useState([]);
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
      filtroActivo: null
    };
  });

  const { busqueda, busquedaId, letraSeleccionada, filtroActivo } = filtros;

  // Helpers para manejo de IDs
  const getId = (s) => String(s?.id_socio ?? s?.id ?? '');
  const equalId = (s, needle) => {
    if (!needle?.trim()) return true;
    const a = Number(getId(s));
    const b = Number(needle);
    if (Number.isNaN(a) || Number.isNaN(b)) return false;
    return a === b;
  };

  // Debounce (por si luego lo querés usar)
  const debounce = (func, wait) => {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  };

  const handleIdSearch = debounce((value) => {
    const onlyNums = value.replace(/\D/g, '');
    setFiltros(prev => ({
      ...prev,
      busquedaId: onlyNums,
      busqueda: '',
      letraSeleccionada: 'TODOS',
      filtroActivo: onlyNums ? 'id' : null
    }));
    setAnimacionActiva(true);
    setTimeout(() => setAnimacionActiva(false), 300);
  }, 300);

  const sociosFiltrados = useMemo(() => {
    let resultados = [...socios];

    if (busquedaId && filtroActivo === 'id') {
      resultados = resultados.filter((s) => equalId(s, busquedaId));
      return resultados;
    }

    if (filtroActivo === 'busqueda' && busqueda) {
      resultados = resultados.filter((s) =>
        s.nombre?.toLowerCase().includes(busqueda.toLowerCase())
      );
    } else if (filtroActivo === 'letra' && letraSeleccionada) {
      resultados = resultados.filter((s) =>
        s.nombre?.toLowerCase().startsWith(letraSeleccionada.toLowerCase())
      );
    } else if (filtroActivo === 'todos') {
      return resultados;
    }

    return resultados;
  }, [socios, busqueda, busquedaId, letraSeleccionada, filtroActivo]);

  useEffect(() => {
    if (sociosFiltrados.length > 0) {
      const timer = setTimeout(() => {
        setBloquearInteraccion(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [sociosFiltrados]);

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

  const mostrarToast = useCallback((mensaje, tipo = 'exito') => {
    setToast({
      mostrar: true,
      tipo,
      mensaje
    });
  }, []);

  useEffect(() => {
    const cargarDatosIniciales = async () => {
      try {
        setCargando(true);
        const response = await fetch(`${BASE_URL}/api.php?action=socios`);
        const data = await response.json();
        
        if (data.exito) {
          setSocios(data.socios);
        } else {
          mostrarToast(`Error al obtener socios: ${data.mensaje}`, 'error');
        }
      } catch (error) {
        mostrarToast('Error de red al obtener socios', 'error');
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
          filtroActivo: null
        });
        localStorage.removeItem('filtros_socios');
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [mostrarToast]);

  useEffect(() => {
    localStorage.setItem('filtros_socios', JSON.stringify(filtros));
  }, [filtros]);

  useEffect(() => {
    if (filtroActivo !== null) {
      setUltimoFiltroActivo(filtroActivo);
    }
  }, [filtroActivo]);

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
    const calle = domicilio?.trim() || '';
    const num = numero?.trim() || '';
    if (!calle && !num) return '';
    if (calle.includes(num)) return calle;
    return `${calle} ${num}`.trim();
  }, []);

  const exportarExcel = useCallback(() => {
    if (socios.length === 0) {
      mostrarToast('No hay socios registrados para exportar.', 'error');
      return;
    }
    if (filtroActivo === null) {
      mostrarToast('Por favor aplique al menos un filtro para exportar los socios.', 'error');
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
    }));

    const ws = XLSX.utils.json_to_sheet(datos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Socios");

    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
    saveAs(blob, 'Socios.xlsx');
  }, [socios, sociosFiltrados, filtroActivo, construirDomicilio, mostrarToast]);

  const handleMostrarTodos = useCallback(() => {
    setFiltros({
      busqueda: '',
      busquedaId: '',
      letraSeleccionada: 'TODOS',
      filtroActivo: 'todos'
    });
    setAnimacionActiva(true);
    setTimeout(() => {
      setAnimacionActiva(false);
    }, 500);
  }, []);

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
          {socio.comentario && (
            <>
              {socio.comentario.length > 36 ? (
                <>
                  <span className="soc-comentario-preview">
                    {socio.comentario.substring(0, 36)}
                  </span>
                  <button 
                    className="soc-boton-tres-puntos"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleTooltip(socio.id_socio, e);
                    }}
                    title="Ver comentario completo"
                  >
                    <FaEllipsisH />
                  </button>
                </>
              ) : (
                <span>{socio.comentario}</span>
              )}
              {tooltipVisible === socio.id_socio && ReactDOM.createPortal(
                <div 
                  className="soc-tooltip-overlay" 
                  onClick={() => setTooltipVisible(null)}
                  style={{
                    position: 'fixed',
                    top: '0',
                    left: '0',
                    right: '0',
                    bottom: '0',
                    zIndex: '1000'
                  }}
                >
                  <div 
                    className="soc-tooltip-comentario" 
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                    }}
                  >
                    {socio.comentario}
                    <button 
                      className="soc-tooltip-cerrar"
                      onClick={(e) => {
                        e.stopPropagation();
                        setTooltipVisible(null);
                      }}
                    >
                      ×
                    </button>
                  </div>
                </div>,
                document.body
              )}
            </>
          )}
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
          setFiltros={setFiltros}
          filtrosRef={filtrosRef}
          mostrarFiltros={mostrarFiltros}
          setMostrarFiltros={setMostrarFiltros}
          filtroActivo={filtroActivo}
          setAnimacionActiva={setAnimacionActiva}
          ultimoFiltroActivo={ultimoFiltroActivo}
        />

        <div className="soc-tabla-container">
          <div className="soc-tabla-header-container">
            <div className="soc-contador">
              <FaUsers className="soc-contador-icono" size={14} />
              {filtroActivo === 'todos' ? 'Total de socios:' : 
               filtroActivo === null ? 'Filtre para ver socios:' : 'Socios filtrados:'} 
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
          
          {cargando ? (
            <div className="soc-skeleton-rows">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="soc-skeleton-row"></div>
              ))}
            </div>
          ) : socios.length === 0 ? (
            <div className="soc-sin-resultados">
              No hay socios registrados
            </div>
          ) : filtroActivo === null ? (
            <div className="soc-boton-mostrar-container">
              <div className="soc-mensaje-inicial">
                Por favor aplique al menos un filtro para ver los socios
              </div>
              <button
                className="soc-boton-mostrar-todos"
                onClick={handleMostrarTodos}
              >
                Mostrar todos los socios
              </button>
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
              key={`list-${busqueda}-${letraSeleccionada}-${busquedaId}`}
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