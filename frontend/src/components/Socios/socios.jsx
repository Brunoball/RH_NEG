import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FixedSizeList as List } from 'react-window';
import BASE_URL from '../../config/config';
import { FaInfoCircle, FaEdit, FaTrash, FaUserMinus } from 'react-icons/fa';
import './Socios.css';
import ModalEliminarSocio from './modales/ModalEliminarSocio';
import ModalInfoSocio from './modales/ModalInfoSocio';
import ModalDarBajaSocio from './modales/ModalDarBajaSocio';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const Socios = () => {
  const [socios, setSocios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [letraSeleccionada, setLetraSeleccionada] = useState('');
  const [socioSeleccionado, setSocioSeleccionado] = useState(null);
  const [mostrarModalEliminar, setMostrarModalEliminar] = useState(false);
  const [socioAEliminar, setSocioAEliminar] = useState(null);
  const [mostrarModalInfo, setMostrarModalInfo] = useState(false);
  const [socioInfo, setSocioInfo] = useState(null);
  const [mensaje, setMensaje] = useState('');
  const [tipoMensaje, setTipoMensaje] = useState('');
  const [mostrarModalDarBaja, setMostrarModalDarBaja] = useState(false);
  const [socioDarBaja, setSocioDarBaja] = useState(null);
  const navigate = useNavigate();

  const mostrarMensaje = (texto, tipo = 'exito') => {
    setMensaje(texto);
    setTipoMensaje(tipo);
    setTimeout(() => {
      setMensaje('');
      setTipoMensaje('');
    }, 3000);
  };

  const obtenerSocios = async () => {
    try {
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
      setLoading(false);
    }
  };

  useEffect(() => {
    const filtrosGuardados = JSON.parse(localStorage.getItem('filtros_socios'));

    if (filtrosGuardados) {
      setBusqueda(filtrosGuardados.busqueda || '');
      setLetraSeleccionada(filtrosGuardados.letraSeleccionada || '');
      sessionStorage.setItem('recargar_socios', '1');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const debeRecargar = sessionStorage.getItem('recargar_socios');
    if (debeRecargar) {
      sessionStorage.removeItem('recargar_socios');
      obtenerSocios();
    }
  }, [busqueda, letraSeleccionada]);

  useEffect(() => {
    const edited = sessionStorage.getItem('socio_editado');
    if (edited) {
      sessionStorage.removeItem('socio_editado');
      obtenerSocios();
    }
  }, []);

  useEffect(() => {
    if (busqueda || letraSeleccionada) {
      localStorage.setItem('filtros_socios', JSON.stringify({
        busqueda,
        letraSeleccionada
      }));
    }
  }, [busqueda, letraSeleccionada]);

  const sociosFiltrados = useMemo(() => {
    let resultados = socios;

    if (busqueda) {
      resultados = resultados.filter((s) =>
        s.nombre?.toLowerCase().includes(busqueda.toLowerCase())
      );
    }

    if (letraSeleccionada) {
      if (letraSeleccionada === 'TODOS') {
        return resultados;
      }
      resultados = resultados.filter((s) =>
        s.nombre?.toLowerCase().startsWith(letraSeleccionada.toLowerCase())
      );
    }

    return resultados;
  }, [socios, busqueda, letraSeleccionada]);

  const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  const manejarSeleccion = (socio) => {
    if (socioSeleccionado?.id_socio === socio.id_socio) {
      setSocioSeleccionado(null);
    } else {
      setSocioSeleccionado(socio);
    }
  };

  const eliminarSocio = async (id) => {
    try {
      const response = await fetch(`${BASE_URL}/api.php?action=eliminar_socio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_socio: id }),
      });

      const data = await response.json();
      if (data.exito) {
        const nuevosSocios = socios.filter((s) => s.id_socio !== id);
        setSocios(nuevosSocios);
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
  };

  const darDeBajaSocio = async (id) => {
    try {
      const response = await fetch(`${BASE_URL}/api.php?action=dar_baja_socio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_socio: id }),
      });
      const data = await response.json();
      if (data.exito) {
        const actualizados = socios.filter((s) => s.id_socio !== id);
        setSocios(actualizados);
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
  };

  const construirDomicilio = (domicilio, numero) => {
    const calle = domicilio?.trim() || '';
    const num = numero?.trim() || '';
    if (!calle && !num) return '';
    if (calle.includes(num)) return calle;
    return `${calle} ${num}`.trim();
  };

  const exportarExcel = () => {
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
  };

  const Row = ({ index, style, data }) => {
    const socio = data[index];
    return (
      <div
        style={style}
        onClick={() => manejarSeleccion(socio)}
        className={`soc-tabla-fila ${socioSeleccionado?.id_socio === socio.id_socio ? 'soc-fila-seleccionada' : ''}`}
      >
        <div className="soc-col-id">{socio.id_socio}</div>
        <div className="soc-col-nombre">{socio.nombre}</div>
        <div className="soc-col-domicilio">{construirDomicilio(socio.domicilio, socio.numero)}</div>
        <div className="soc-col-comentario">{socio.comentario}</div>
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
                  sessionStorage.setItem('socio_editado', '1');
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
  };

  return (
    <div className="soc-container">
      <h2 className="soc-titulo">Gestión de Socios</h2>

      {mensaje && (
        <div className={`soc-mensaje ${tipoMensaje === 'error' ? 'soc-mensaje-error' : 'soc-mensaje-exito'}`}>
          {mensaje}
        </div>
      )}

      {/* Controles superiores (buscador y filtros) */}
      <div className="soc-barra-superior">
        <input
          type="text"
          placeholder="Buscar por nombre..."
          value={busqueda}
          onChange={(e) => {
            setBusqueda(e.target.value);
            obtenerSocios();
          }}
          className="soc-buscador"
          disabled={loading}
        />

        <select 
          value={letraSeleccionada} 
          onChange={(e) => {
            setLetraSeleccionada(e.target.value);
            obtenerSocios();
          }}
          className="soc-selector-letras"
          disabled={loading}
        >
          <option value="">Seleccioná una letra...</option>
          <option value="TODOS">Todos</option>
          {letras.map((letra) => (
            <option key={letra} value={letra}>
              {letra}
            </option>
          ))}
        </select>
      </div>

      {busqueda || letraSeleccionada ? (
        <p className="soc-contador">Total de socios: <strong>{sociosFiltrados.length}</strong></p>
      ) : null}

      {loading ? (
        <p className="soc-cargando">Cargando socios...</p>
      ) : (
        <>
          <div className="soc-tabla-container">
            <div className="soc-tabla-header">
              <div className="soc-col-id">ID</div>
              <div className="soc-col-nombre">Nombre</div>
              <div className="soc-col-domicilio">Domicilio</div>
              <div className="soc-col-comentario">Comentario</div>
              <div className="soc-col-acciones">Acciones</div>
            </div>
            
            {!busqueda && !letraSeleccionada ? (
              <div className="soc-sin-resultados">
                Usá el buscador o seleccioná una letra para filtrar los socios
              </div>
            ) : sociosFiltrados.length === 0 ? (
              <div className="soc-sin-resultados">
                No se encontraron resultados con los filtros actuales
              </div>
            ) : (
              <List
                height={400}
                itemCount={sociosFiltrados.length}
                itemSize={60}
                width="100%"
                itemData={sociosFiltrados}
              >
                {Row}
              </List>
            )}
          </div>

          {/* Barra de botones inferiores */}
          <div className="soc-barra-inferior">
            <button
              className="soc-boton"
              onClick={() => {
                localStorage.removeItem('filtros_socios');
                navigate('/panel');
              }}
              disabled={loading}
            >
              Volver
            </button>
            <button
              className="soc-boton"
              onClick={() => {
                sessionStorage.removeItem('socio_editado');
                navigate('/socios/agregar');
              }}
              disabled={loading}
            >
              Agregar Socio
            </button>
            <button 
              className="soc-boton" 
              onClick={exportarExcel} 
              disabled={loading || (!busqueda && !letraSeleccionada)}
            >
              Exportar a Excel
            </button>
            <button className="soc-boton" onClick={() => navigate('/socios/baja')} disabled={loading}>
              Dados de Baja
            </button>
          </div>
        </>
      )}

      <ModalEliminarSocio
        mostrar={mostrarModalEliminar}
        socio={socioAEliminar}
        onClose={() => {
          setMostrarModalEliminar(false);
          setSocioAEliminar(null);
        }}
        onEliminar={eliminarSocio}
      />

      <ModalInfoSocio
        mostrar={mostrarModalInfo}
        socio={socioInfo}
        onClose={() => {
          setMostrarModalInfo(false);
          setSocioInfo(null);
        }}
      />

      <ModalDarBajaSocio
        mostrar={mostrarModalDarBaja}
        socio={socioDarBaja}
        onClose={() => {
          setMostrarModalDarBaja(false);
          setSocioDarBaja(null);
        }}
        onDarBaja={darDeBajaSocio}
      />
    </div>
  );
};

export default Socios;