import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BASE_URL from '../../config/config';
import { FaInfoCircle, FaEdit, FaTrash, FaUser } from 'react-icons/fa';
import './Socios.css';
import ModalEliminarSocio from './modales/ModalEliminarSocio';
import ModalInfoSocio from './modales/ModalInfoSocio';

const Socios = () => {
  const [socios, setSocios] = useState([]);
  const [sociosFiltrados, setSociosFiltrados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [letraSeleccionada, setLetraSeleccionada] = useState('');
  const [socioSeleccionado, setSocioSeleccionado] = useState(null);
  const [mostrarModalEliminar, setMostrarModalEliminar] = useState(false);
  const [socioAEliminar, setSocioAEliminar] = useState(null);
  const [mostrarModalInfo, setMostrarModalInfo] = useState(false);
  const [socioInfo, setSocioInfo] = useState(null);
  const [mensaje, setMensaje] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const obtenerSocios = async () => {
      try {
        const response = await fetch(`${BASE_URL}/api.php?action=socios`);
        const data = await response.json();
        if (data.exito) {
          setSocios(data.socios);
          setSociosFiltrados([]);
        } else {
          console.error('Error al obtener socios:', data.mensaje);
        }
      } catch (error) {
        console.error('Error de red:', error);
      } finally {
        setLoading(false);
      }
    };

    obtenerSocios();
  }, []);

  useEffect(() => {
    let resultados = socios;

    if (busqueda) {
      resultados = resultados.filter((s) =>
        s.nombre?.toLowerCase().includes(busqueda.toLowerCase())
      );
    }

    if (letraSeleccionada && letraSeleccionada !== 'TODOS') {
      resultados = resultados.filter((s) =>
        s.nombre?.toLowerCase().startsWith(letraSeleccionada.toLowerCase())
      );
    }

    if (!busqueda && !letraSeleccionada) {
      setSociosFiltrados([]);
    } else {
      setSociosFiltrados(resultados);
    }
  }, [busqueda, letraSeleccionada, socios]);

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

        let resultados = nuevosSocios;
        if (busqueda) {
          resultados = resultados.filter((s) =>
            s.nombre?.toLowerCase().includes(busqueda.toLowerCase())
          );
        }
        if (letraSeleccionada && letraSeleccionada !== 'TODOS') {
          resultados = resultados.filter((s) =>
            s.nombre?.toLowerCase().startsWith(letraSeleccionada.toLowerCase())
          );
        }
        setSociosFiltrados(resultados);

        setMostrarModalEliminar(false);
        setSocioAEliminar(null);
        setMensaje('✅ Socio eliminado correctamente');
        setTimeout(() => setMensaje(''), 3000);
      } else {
        alert('Error al eliminar: ' + data.mensaje);
      }
    } catch (error) {
      alert('Error de red: ' + error);
    }
  };

  const construirDomicilio = (domicilio, numero) => {
    const calle = domicilio?.trim() || '';
    const num = numero?.trim() || '';
    if (!calle && !num) return '';
    if (calle.includes(num)) return calle;
    return `${calle} ${num}`.trim();
  };

  return (
    <div className="soc_container">
      <h2 className="soc_titulo">Gestión de Socios</h2>

      {mensaje && <div className="soc_mensaje-exito">{mensaje}</div>}

      <div className="soc_barra-superior">
        <input
          type="text"
          placeholder="Buscar por nombre..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="soc_buscador"
        />

        <select 
          value={letraSeleccionada} 
          onChange={(e) => setLetraSeleccionada(e.target.value)}
          className="soc_selector-letras"
        >
          <option value="">Seleccioná una letra...</option>
          <option value="TODOS">Todos</option>
          {letras.map((letra) => (
            <option key={letra} value={letra}>
              {letra}
            </option>
          ))}
        </select>

        <button className="soc_boton" onClick={() => navigate('/panel')}>Volver</button>
        <button className="soc_boton" onClick={() => navigate('/socios/agregar')}>Agregar Socio</button>
      </div>

      <p className="soc_contador">Total de socios: <strong>{sociosFiltrados.length}</strong></p>

      {loading ? (
        <p className="soc_cargando">Cargando socios...</p>
      ) : (
        <div className="soc_tabla-scroll">
          <table className="soc_tabla">
            <thead>
              <tr>
                <th className="soc_col-id">ID</th>
                <th className="soc_col-nombre">Nombre</th>
                <th className="soc_col-domicilio">Domicilio</th>
                <th className="soc_col-comentario">Comentario</th>
                <th className="soc_col-acciones">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sociosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan="5" className="soc_sin-resultados">
                    {busqueda || letraSeleccionada ? 'No se encontraron resultados.' : 'Usá el buscador o filtro para comenzar.'}
                  </td>
                </tr>
              ) : (
                sociosFiltrados.map((socio) => (
                  <tr
                    key={socio.id_socio}
                    onClick={() => manejarSeleccion(socio)}
                    className={`soc_fila ${socioSeleccionado?.id_socio === socio.id_socio ? 'soc_fila-seleccionada' : ''}`}
                  >
                    <td className="soc_col-id">{socio.id_socio}</td>
                    <td className="soc_col-nombre">{socio.nombre}</td>
                    <td className="soc_col-domicilio">{construirDomicilio(socio.domicilio, socio.numero)}</td>
                    <td className="soc_col-comentario">{socio.comentario}</td>
                    <td className="soc_col-acciones">
                      {socioSeleccionado?.id_socio === socio.id_socio && (
                        <div className="soc_iconos-acciones">
                          <FaInfoCircle
                            title="Ver información"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSocioInfo(socio);
                              setMostrarModalInfo(true);
                            }}
                            className="soc_icono"
                          />
                          <FaEdit
                            title="Editar"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/socios/editar/${socio.id_socio}`);
                            }}
                            className="soc_icono"
                          />
                          <FaTrash
                            title="Eliminar"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSocioAEliminar(socio);
                              setMostrarModalEliminar(true);
                            }}
                            className="soc_icono"
                          />
                          <FaUser 
                            title="Ver perfil" 
                            className="soc_icono"
                          />
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <ModalEliminarSocio
        socio={socioAEliminar}
        onClose={() => {
          setMostrarModalEliminar(false);
          setSocioAEliminar(null);
        }}
        onEliminar={eliminarSocio}
      />

      <ModalInfoSocio
        socio={socioInfo}
        onClose={() => {
          setMostrarModalInfo(false);
          setSocioInfo(null);
        }}
      />
    </div>
  );
};

export default Socios;