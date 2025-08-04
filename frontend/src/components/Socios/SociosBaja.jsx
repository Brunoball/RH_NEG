import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BASE_URL from '../../config/config';
import { FaUserCheck } from 'react-icons/fa';
import './SociosBaja.css';

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
    <div className="soc-container-baja">
      <div className="soc-glass-effect-baja"></div>
      <div className="soc-barra-superior-baja">
        <div className="soc-titulo-container-baja">
          <h2 className="soc-titulo-baja">Socios Dados de Baja</h2>
        </div>
        <button className="soc-boton-volver-baja" onClick={() => navigate('/socios')}>← Volver</button>
      </div>

      <div className="soc-buscador-container-baja">
        <input
          type="text"
          className="soc-buscador-baja"
          placeholder="Buscar por nombre..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <div className="soc-buscador-iconos-baja">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </div>
      </div>

      {mensaje.texto && (
        <div className={`soc-mensaje-baja ${mensaje.tipo}`}>
          {mensaje.texto}
          <button 
            className="soc-cerrar-mensaje-baja" 
            onClick={() => setMensaje({ texto: '', tipo: '' })}
          >
            ×
          </button>
        </div>
      )}

      {loading ? (
        <p className="soc-cargando-baja">Cargando socios dados de baja...</p>
      ) : (
        
        <div className="soc-tabla-container-baja">
                      <div className="soc-contador-baja">
              Mostrando <strong>{sociosFiltrados.length}</strong> socios
            </div>
          <div className="soc-tabla-header-container-baja">
            <div className="soc-tabla-header-baja">
              <div className="soc-col-id-baja">ID</div>
              <div className="soc-col-nombre-baja">Nombre</div>
              <div className="soc-col-domicilio-baja">Domicilio</div>
              <div className="soc-col-comentario-baja">Comentario</div>
              <div className="soc-col-acciones-baja">Acciones</div>
            </div>
            

          </div>
          
          <div className="soc-tabla-body-baja">
            {sociosFiltrados.length === 0 ? (
              <div className="soc-sin-resultados-baja">No hay resultados.</div>
            ) : (
              sociosFiltrados.map((s) => (
                <div className="soc-tabla-fila-baja" key={s.id_socio}>
                  <div className="soc-col-id-baja">{s.id_socio}</div>
                  <div className="soc-col-nombre-baja">{s.nombre}</div>
                  <div className="soc-col-domicilio-baja">{`${s.domicilio ?? ''} ${s.numero ?? ''}`}</div>
                  <div className="soc-col-comentario-baja">{s.comentario}</div>
                  <div className="soc-col-acciones-baja">
                    <div className="soc-iconos-acciones-baja">
                      <FaUserCheck
                        title="Dar de alta"
                        className="soc-icono-baja"
                        onClick={() => {
                          setSocioSeleccionado(s);
                          setMostrarConfirmacion(true);
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {mostrarConfirmacion && socioSeleccionado && (
        <div className="soc-modal-overlay-baja">
          <div className="soc-modal-contenido-baja">
            <h3>¿Deseás dar de alta nuevamente al socio <strong>{socioSeleccionado.nombre}</strong>?</h3>
            <div className="soc-modal-botones-baja">
              <button
                className="soc-boton-confirmar-baja"
                onClick={() => darAltaSocio(socioSeleccionado.id_socio)}
              >
                ✅ Sí, dar de alta
              </button>
              <button
                className="soc-boton-cancelar-baja"
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