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
  FaTimes
} from 'react-icons/fa';
import './Socios.css';
import ModalEliminarSocio from './modales/ModalEliminarSocio';
import ModalInfoSocio from './modales/ModalInfoSocio';
import ModalDarBajaSocio from './modales/ModalDarBajaSocio';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const BotonesInferiores = React.memo(({ cargando, navigate, sociosFiltrados, exportarExcel }) => (
  <div className="soc-barra-inferior">
    <button
      className="soc-boton soc-boton-volver"
      onClick={() => {
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
        disabled={cargando || sociosFiltrados.length === 0}
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
  letraSeleccionada, 
  socios, 
  sociosFiltrados, 
  setFiltros, 
  filtrosRef, 
  mostrarFiltros, 
  setMostrarFiltros,
  setAnimarBusqueda,
  setAnimarFiltroLetra,
  setAnimarMostrarTodos,
  filtroActivo
}) => {
  const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  return (
    <div className="soc-barra-superior">
      <div className="soc-controles-izquierda">
        <p className="soc-contador">
          {filtroActivo ? 'Socios filtrados:' : 'Total de socios:'} 
          <strong>{filtroActivo ? sociosFiltrados.length : socios.length}</strong>
        </p>
        
        {busqueda && (
          <div className="soc-filtro-activo">
            <span className="soc-filtro-activo-busqueda">
              <FaSearch className="soc-filtro-activo-busqueda-icono" size={12} />
              {busqueda}
            </span>
          </div>
        )}
        
        {(filtroActivo === 'letra' && letraSeleccionada !== 'TODOS' && !busqueda) && (
          <div className="soc-filtro-activo">
            <span className="soc-filtro-activo-letra">{letraSeleccionada}</span>
          </div>
        )}
      </div>
      
      <div className="soc-buscador-container">
        <input
          type="text"
          placeholder="Buscar por nombre..."
          value={busqueda}
          onChange={(e) => {
            setFiltros(prev => ({ 
              ...prev, 
              busqueda: e.target.value,
              letraSeleccionada: 'TODOS',
              filtroActivo: e.target.value ? 'busqueda' : null
            }));
            setAnimarBusqueda(true);
            setAnimarMostrarTodos(false);
            setTimeout(() => setAnimarBusqueda(false), 1000);
          }}
          className="soc-buscador"
          disabled={cargando}
        />
        <div className="soc-buscador-iconos">
          {busqueda ? (
            <FaTimes 
              className="soc-buscador-icono" 
              onClick={() => {
                setFiltros(prev => ({ ...prev, busqueda: '', filtroActivo: null }));
                setAnimarBusqueda(false);
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
                    setFiltros(prev => ({ 
                      ...prev, 
                      letraSeleccionada: letra,
                      busqueda: '',
                      filtroActivo: 'letra'
                    }));
                    setMostrarFiltros(false);
                    setAnimarFiltroLetra(true);
                    setAnimarMostrarTodos(false);
                    setTimeout(() => setAnimarFiltroLetra(false), 1000);
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
                setFiltros(prev => ({ 
                  ...prev, 
                  letraSeleccionada: 'TODOS',
                  busqueda: '',
                  filtroActivo: null
                }));
                setMostrarFiltros(false);
                setAnimarBusqueda(false);
                setAnimarFiltroLetra(false);
                setAnimarMostrarTodos(false);
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
  const [mensaje, setMensaje] = useState('');
  const [tipoMensaje, setTipoMensaje] = useState('');
  const [mostrarModalDarBaja, setMostrarModalDarBaja] = useState(false);
  const [socioDarBaja, setSocioDarBaja] = useState(null);
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [animarBusqueda, setAnimarBusqueda] = useState(false);
  const [animarFiltroLetra, setAnimarFiltroLetra] = useState(false);
  const [animarMostrarTodos, setAnimarMostrarTodos] = useState(false);
  const filtrosRef = useRef(null);
  const navigate = useNavigate();

  const [filtros, setFiltros] = useState(() => {
    const saved = localStorage.getItem('filtros_socios');
    return saved ? JSON.parse(saved) : {
      busqueda: '',
      letraSeleccionada: 'TODOS',
      filtroActivo: null
    };
  });

  const { busqueda, letraSeleccionada, filtroActivo } = filtros;

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filtrosRef.current && !filtrosRef.current.contains(event.target)) {
        setMostrarFiltros(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const mostrarMensaje = useCallback((texto, tipo = 'exito') => {
    setMensaje(texto);
    setTipoMensaje(tipo);
    setTimeout(() => {
      setMensaje('');
      setTipoMensaje('');
    }, 3000);
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
          mostrarMensaje(`Error al obtener socios: ${data.mensaje}`, 'error');
        }
      } catch (error) {
        mostrarMensaje('Error de red al obtener socios', 'error');
      } finally {
        setCargando(false);
      }
    };

    cargarDatosIniciales();
  }, [mostrarMensaje]);

  useEffect(() => {
    localStorage.setItem('filtros_socios', JSON.stringify(filtros));
  }, [filtros]);

  const sociosFiltrados = useMemo(() => {
    let resultados = [...socios];

    if (filtroActivo === 'busqueda' && busqueda) {
      resultados = resultados.filter((s) =>
        s.nombre?.toLowerCase().includes(busqueda.toLowerCase())
      );
    } else if (filtroActivo === 'letra' && letraSeleccionada !== 'TODOS') {
      resultados = resultados.filter((s) =>
        s.nombre?.toLowerCase().startsWith(letraSeleccionada.toLowerCase())
      );
    }

    return resultados;
  }, [socios, busqueda, letraSeleccionada, filtroActivo]);

  const manejarSeleccion = useCallback((socio) => {
    setSocioSeleccionado(prev => 
      prev?.id_socio === socio.id_socio ? null : socio
    );
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
        mostrarMensaje('✅ Socio eliminado correctamente');
      } else {
        mostrarMensaje(`Error al eliminar: ${data.mensaje}`, 'error');
      }
    } catch (error) {
      mostrarMensaje('Error de red al intentar eliminar', 'error');
    } finally {
      setMostrarModalEliminar(false);
      setSocioAEliminar(null);
    }
  }, [mostrarMensaje]);

  const darDeBajaSocio = useCallback(async (id) => {
    try {
      const response = await fetch(`${BASE_URL}/api.php?action=dar_baja_socio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_socio: id }),
      });
      const data = await response.json();
      if (data.exito) {
        setSocios(prev => prev.filter((s) => s.id_socio !== id));
        mostrarMensaje('✅ Socio dado de baja correctamente');
      } else {
        mostrarMensaje(`Error: ${data.mensaje}`, 'error');
      }
    } catch (error) {
      mostrarMensaje('Error de red al intentar dar de baja', 'error');
    } finally {
      setMostrarModalDarBaja(false);
      setSocioDarBaja(null);
    }
  }, [mostrarMensaje]);

  const construirDomicilio = useCallback((domicilio, numero) => {
    const calle = domicilio?.trim() || '';
    const num = numero?.trim() || '';
    if (!calle && !num) return '';
    if (calle.includes(num)) return calle;
    return `${calle} ${num}`.trim();
  }, []);

  const exportarExcel = useCallback(() => {
    if (sociosFiltrados.length === 0) {
      mostrarMensaje('⚠️ No hay socios para exportar. Seleccioná un filtro o realizá una búsqueda primero.', 'error');
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
      Periodo_Adeudado: s.id_periodo_adeudado,
      Deuda_2024: s.deuda_2024
    }));

    const ws = XLSX.utils.json_to_sheet(datos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Socios");

    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
    saveAs(blob, 'Socios.xlsx');
  }, [sociosFiltrados, construirDomicilio, mostrarMensaje]);

  const handleMostrarTodos = useCallback(() => {
    setFiltros({
      busqueda: '',
      letraSeleccionada: 'TODOS',
      filtroActivo: null
    });
    setAnimarMostrarTodos(true);
    setTimeout(() => setAnimarMostrarTodos(false), 1000);
  }, []);

  const Row = React.memo(({ index, style, data }) => {
    const socio = data[index];
    const delay = (animarBusqueda || animarFiltroLetra || animarMostrarTodos) && index < 10 ? index * 30 : 0;
    
    return (
      <div
        style={{
          ...style,
          opacity: delay ? 0 : 1,
          transform: delay ? 'translateY(20px)' : 'translateY(0)',
          animation: delay ? `soc-fadeInUp 0.4s ease-out ${delay}ms forwards` : 'none'
        }}
        onClick={() => manejarSeleccion(socio)}
        className={`soc-tabla-fila ${socioSeleccionado?.id_socio === socio.id_socio ? 'soc-fila-seleccionada' : ''}`}
      >
        <div className="soc-col-id" title={socio.id_socio}>{socio.id_socio}</div>
        <div className="soc-col-nombre" title={socio.nombre}>{socio.nombre}</div>
        <div className="soc-col-domicilio" title={construirDomicilio(socio.domicilio, socio.numero)}>
          {construirDomicilio(socio.domicilio, socio.numero)}
        </div>
        <div className="soc-col-comentario" title={socio.comentario}>
          {socio.comentario}
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
    <div className="soc-container">
      <h2 className="soc-titulo">Gestión de Socios</h2>

      {mensaje && (
        <div className={`soc-mensaje ${tipoMensaje === 'error' ? 'soc-mensaje-error' : 'soc-mensaje-exito'}`}>
          {mensaje}
        </div>
      )}

      <BarraSuperior
        cargando={cargando}
        busqueda={busqueda}
        letraSeleccionada={letraSeleccionada}
        socios={socios}
        sociosFiltrados={sociosFiltrados}
        setFiltros={setFiltros}
        filtrosRef={filtrosRef}
        mostrarFiltros={mostrarFiltros}
        setMostrarFiltros={setMostrarFiltros}
        setAnimarBusqueda={setAnimarBusqueda}
        setAnimarFiltroLetra={setAnimarFiltroLetra}
        setAnimarMostrarTodos={setAnimarMostrarTodos}
        filtroActivo={filtroActivo}
      />

      <div className="soc-tabla-container">
        <div className="soc-tabla-header">
          <div className="soc-col-id">ID</div>
          <div className="soc-col-nombre">Nombre</div>
          <div className="soc-col-domicilio">Domicilio</div>
          <div className="soc-col-comentario">Comentario</div>
          <div className="soc-col-acciones">Acciones</div>
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
        ) : sociosFiltrados.length === 0 ? (
          <div className="soc-boton-mostrar-container">
            <div className="soc-mensaje-filtros">
              No hay resultados con los filtros actuales
            </div>
            <button
              className="soc-boton-mostrar-todos"
              onClick={handleMostrarTodos}
              disabled={cargando}
            >
              Restablecer Filtros
            </button>
          </div>
        ) : (
          <List
            height={400}
            itemCount={sociosFiltrados.length}
            itemSize={60}
            width="100%"
            itemData={sociosFiltrados}
            overscanCount={10}
            key={`list-${busqueda}-${letraSeleccionada}-${animarBusqueda}-${animarFiltroLetra}-${animarMostrarTodos}`}
          >
            {Row}
          </List>
        )}
      </div>

      <BotonesInferiores 
        cargando={cargando} 
        navigate={navigate} 
        sociosFiltrados={sociosFiltrados} 
        exportarExcel={exportarExcel} 
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
  );
};

export default Socios;