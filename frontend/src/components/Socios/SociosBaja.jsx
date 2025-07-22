// src/components/Socios/SociosBaja.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BASE_URL from '../../config/config';
import { FaUserCheck } from 'react-icons/fa';
import './Socios.css';

const SociosBaja = () => {
  const [socios, setSocios] = useState([]);
  const [sociosFiltrados, setSociosFiltrados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [socioSeleccionado, setSocioSeleccionado] = useState(null);
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false);
  const [mensaje, setMensaje] = useState({ texto: '', tipo: '' });
  const [busqueda, setBusqueda] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    obtenerSociosBaja();
  }, []);

  useEffect(() => {
    const filtrados = socios.filter((s) =>
      s.nombre.toLowerCase().includes(busqueda.toLowerCase())
    );
    setSociosFiltrados(filtrados);
  }, [busqueda, socios]);

  const obtenerSociosBaja = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${BASE_URL}/api.php?action=socios&baja=1`);
      const data = await response.json();
      if (data.exito) {
        setSocios(data.socios);
        setSociosFiltrados(data.socios);
      } else {
        console.error('Error al obtener socios dados de baja:', data.mensaje);
        setMensaje({ texto: 'Error al cargar socios dados de baja', tipo: 'error' });
      }
    } catch (error) {
      console.error('Error de red:', error);
      setMensaje({ texto: 'Error de conexión al cargar socios', tipo: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const darAltaSocio = async (id) => {
    try {
      const response = await fetch(`${BASE_URL}/api.php?action=dar_alta_socio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_socio: id })
      });

      const data = await response.json();
      if (data.exito) {
        setSocios(prev => prev.filter(s => s.id_socio !== id));
        setSociosFiltrados(prev => prev.filter(s => s.id_socio !== id));
        setMostrarConfirmacion(false);
        setSocioSeleccionado(null);
        setMensaje({ texto: 'Socio dado de alta correctamente', tipo: 'exito' });
        
        setTimeout(() => {
          setMensaje({ texto: '', tipo: '' });
        }, 3000);
      } else {
        setMensaje({ texto: 'Error al dar de alta: ' + data.mensaje, tipo: 'error' });
      }
    } catch (error) {
      setMensaje({ texto: 'Error de red al dar de alta', tipo: 'error' });
    }
  };

  return (
    <div className="soc_container">
      <h2 className="soc_titulo">Socios Dados de Baja</h2>
      <button className="soc_boton" onClick={() => navigate('/socios')}>← Volver</button>

      <input
        type="text"
        className="soc_input-busqueda"
        placeholder="Buscar por nombre..."
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
      />

      {mensaje.texto && (
        <div className={`soc_mensaje ${mensaje.tipo}`}>
          {mensaje.texto}
          <button 
            className="soc_cerrar-mensaje" 
            onClick={() => setMensaje({ texto: '', tipo: '' })}
          >
            ×
          </button>
        </div>
      )}

      {loading ? (
        <p className="soc_cargando">Cargando socios dados de baja...</p>
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
                  <td colSpan="5" className="soc_sin-resultados">No hay resultados.</td>
                </tr>
              ) : (
                sociosFiltrados.map((s) => (
                  <tr key={s.id_socio}>
                    <td>{s.id_socio}</td>
                    <td>{s.nombre}</td>
                    <td>{`${s.domicilio ?? ''} ${s.numero ?? ''}`}</td>
                    <td>{s.comentario}</td>
                    <td>
                      <FaUserCheck
                        title="Dar de alta"
                        className="soc_icono"
                        onClick={() => {
                          setSocioSeleccionado(s);
                          setMostrarConfirmacion(true);
                        }}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {mostrarConfirmacion && socioSeleccionado && (
        <div className="soc_modal-overlay">
          <div className="soc_modal-contenido">
            <h3>¿Deseás dar de alta nuevamente al socio <strong>{socioSeleccionado.nombre}</strong>?</h3>
            <div className="soc_modal-botones">
              <button
                className="soc_boton-confirmar"
                onClick={() => darAltaSocio(socioSeleccionado.id_socio)}
              >
                ✅ Sí, dar de alta
              </button>
              <button
                className="soc_boton-cancelar"
                onClick={() => {
                  setMostrarConfirmacion(false);
                  setSocioSeleccionado(null);
                }}
              >
                ❌ Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SociosBaja;
