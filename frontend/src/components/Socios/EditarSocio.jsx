import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSave, faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import BASE_URL from '../../config/config';
import './EditarSocio.css';

const EditarSocio = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    nombre: '',
    id_cobrador: '',
    id_categoria: '',
    domicilio: '',
    numero: '',
    telefono_movil: '',
    telefono_fijo: '',
    comentario: '',
    nacimiento: '',
    id_estado: '',
    domicilio_cobro: '',
    dni: '',
    ingreso: '',
    deuda_2024: '',
    id_periodo_adeudado: ''
  });

  const [listas, setListas] = useState({ categorias: [], cobradores: [], estados: [] });
  const [datosOriginales, setDatosOriginales] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({
    show: false,
    message: '',
    type: 'success'
  });

  const showToast = (message, type) => {
    setToast({
      show: true,
      message,
      type
    });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 3000);
  };

  useEffect(() => {
    const fetchSocio = async () => {
      try {
        const res = await fetch(`${BASE_URL}/api.php?action=editar_socio&id=${id}`);
        const data = await res.json();
        if (data.exito) {
          const socioFormateado = {};
          for (const key in formData) {
            socioFormateado[key] = data.socio[key] ?? '';
          }
          setFormData(socioFormateado);
          setDatosOriginales(socioFormateado);
          setLoading(false);
        } else {
          showToast('Error al cargar el socio: ' + data.mensaje, 'error');
        }
      } catch (err) {
        showToast('Error de red: ' + err, 'error');
      }
    };

    const fetchListas = async () => {
      try {
        const res = await fetch(`${BASE_URL}/api.php?action=listas`);
        const json = await res.json();
        if (json.exito) setListas(json.listas);
        else showToast('Error al cargar listas: ' + json.mensaje, 'error');
      } catch (err) {
        showToast('Error al conectar con el servidor para obtener listas', 'error');
      }
    };

    fetchListas();
    fetchSocio();
  }, [id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    let valor = typeof value === 'string' ? value.toUpperCase() : value;
    setFormData((prev) => ({
      ...prev,
      [name]: valor,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const sinCambios = JSON.stringify(formData) === JSON.stringify(datosOriginales);
    if (sinCambios) {
      showToast('No se encontraron cambios para realizar', 'warning');
      return;
    }

    try {
      const res = await fetch(`${BASE_URL}/api.php?action=editar_socio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, id_socio: id }),
      });

      const data = await res.json();
      if (data.exito) {
        showToast('Socio actualizado correctamente', 'success');
        setTimeout(() => navigate('/socios'), 2500);
      } else {
        showToast('Error al actualizar: ' + data.mensaje, 'error');
      }
    } catch (error) {
      showToast('Error de red: ' + error, 'error');
    }
  };

  if (loading) {
    return (
      <div className="edit-socio-loader-container">
        <div className="edit-socio-loader"></div>
        <p className="edit-socio-loading-text">Cargando socio...</p>
      </div>
    );
  }

  return (
    <div className="edit-socio-container">
      <div className="edit-socio-box">
        {toast.show && (
          <div className={`edit-socio-toast edit-socio-toast-${toast.type}`}>
            {toast.message}
          </div>
        )}

        <div className="edit-socio-header">
          <h2 className="edit-socio-title">Editar Socio #{id}</h2>
          <p className="edit-socio-subtitle">Actualiza la información del socio</p>
        </div>
        
        <form onSubmit={handleSubmit} className="edit-socio-form">
          <div className="edit-socio-sections">
            {/* Sección de Información Básica */}
            <div className="edit-socio-section">
              <h3 className="edit-socio-section-title">Información Básica</h3>
              <div className="edit-socio-section-content">
                <div className="edit-socio-input-wrapper">
                  <label className="edit-socio-label">Nombre completo</label>
                  <input
                    name="nombre"
                    value={formData.nombre || ''}
                    onChange={handleChange}
                    className="edit-socio-input"
                  />
                </div>

                <div className="edit-socio-input-wrapper">
                  <label className="edit-socio-label">DNI</label>
                  <input
                    name="dni"
                    value={formData.dni || ''}
                    onChange={handleChange}
                    className="edit-socio-input"
                  />
                </div>

                <div className="edit-socio-input-wrapper">
                  <label className="edit-socio-label">Fecha de nacimiento</label>
                  <input
                    type="date"
                    name="nacimiento"
                    value={formData.nacimiento || ''}
                    onChange={handleChange}
                    className="edit-socio-input"
                  />
                </div>

                <div className="edit-socio-input-wrapper">
                  <label className="edit-socio-label">Número de socio</label>
                  <input
                    name="numero"
                    value={formData.numero || ''}
                    onChange={handleChange}
                    className="edit-socio-input"
                  />
                </div>

                <div className="edit-socio-input-wrapper">
                  <label className="edit-socio-label">Fecha de Ingreso</label>
                  <input
                    name="ingreso"
                    value={formData.ingreso || ''}
                    onChange={handleChange}
                    className="edit-socio-input"
                  />
                </div>
              </div>
            </div>

            {/* Sección de Contacto y Cobro */}
            <div className="edit-socio-section">
              <h3 className="edit-socio-section-title">Contacto y Cobro</h3>
              <div className="edit-socio-section-content">
                <div className="edit-socio-input-wrapper">
                  <label className="edit-socio-label">Domicilio</label>
                  <input
                    name="domicilio"
                    value={formData.domicilio || ''}
                    onChange={handleChange}
                    className="edit-socio-input"
                  />
                </div>

                <div className="edit-socio-input-wrapper">
                  <label className="edit-socio-label">Domicilio de Cobro</label>
                  <input
                    name="domicilio_cobro"
                    value={formData.domicilio_cobro || ''}
                    onChange={handleChange}
                    className="edit-socio-input"
                  />
                </div>

                <div className="edit-socio-input-wrapper">
                  <label className="edit-socio-label">Teléfono Móvil</label>
                  <input
                    name="telefono_movil"
                    value={formData.telefono_movil || ''}
                    onChange={handleChange}
                    className="edit-socio-input"
                  />
                </div>

                <div className="edit-socio-input-wrapper">
                  <label className="edit-socio-label">Teléfono Fijo</label>
                  <input
                    name="telefono_fijo"
                    value={formData.telefono_fijo || ''}
                    onChange={handleChange}
                    className="edit-socio-input"
                  />
                </div>

                <div className="edit-socio-input-wrapper">
                  <label className="edit-socio-label">Cobrador</label>
                  <select 
                    name="id_cobrador" 
                    value={formData.id_cobrador || ''} 
                    onChange={handleChange}
                    className="edit-socio-input"
                  >
                    <option value="">Seleccionar cobrador</option>
                    {listas.cobradores.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Sección de Estado y Comentarios */}
            <div className="edit-socio-section">
              <h3 className="edit-socio-section-title">Estado y Comentarios</h3>
              <div className="edit-socio-section-content">
                <div className="edit-socio-input-wrapper">
                  <label className="edit-socio-label">Categoría</label>
                  <select 
                    name="id_categoria" 
                    value={formData.id_categoria || ''} 
                    onChange={handleChange}
                    className="edit-socio-input"
                  >
                    <option value="">Seleccionar categoría</option>
                    {listas.categorias.map(c => (
                      <option key={c.id} value={c.id}>{c.descripcion}</option>
                    ))}
                  </select>
                </div>

                <div className="edit-socio-input-wrapper">
                  <label className="edit-socio-label">Estado</label>
                  <select 
                    name="id_estado" 
                    value={formData.id_estado || ''} 
                    onChange={handleChange}
                    className="edit-socio-input"
                  >
                    <option value="">Seleccionar estado</option>
                    {listas.estados.map(e => (
                      <option key={e.id} value={e.id}>{e.descripcion}</option>
                    ))}
                  </select>
                </div>

                <div className="edit-socio-input-wrapper">
                  <label className="edit-socio-label">Deuda 2024</label>
                  <input
                    name="deuda_2024"
                    value={formData.deuda_2024 || ''}
                    onChange={handleChange}
                    className="edit-socio-input"
                  />
                </div>

                <div className="edit-socio-input-wrapper">
                  <label className="edit-socio-label">Periodo Adeudado</label>
                  <input
                    name="id_periodo_adeudado"
                    value={formData.id_periodo_adeudado || ''}
                    onChange={handleChange}
                    className="edit-socio-input"
                  />
                </div>

                <div className="edit-socio-input-wrapper">
                  <label className="edit-socio-label">Comentarios</label>
                  <input
                    name="comentario"
                    value={formData.comentario || ''}
                    onChange={handleChange}
                    className="edit-socio-input"
                    rows="3"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="edit-socio-buttons-container">
            <button 
              type="button" 
              onClick={() => navigate('/socios')} 
              className="edit-socio-back-button"
            >
              <FontAwesomeIcon icon={faArrowLeft} className="edit-socio-icon-button" />
              Cancelar
            </button>
            <button 
              type="submit" 
              className="edit-socio-button"
            >
              <FontAwesomeIcon icon={faSave} className="edit-socio-icon-button" />
              Actualizar Socio
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditarSocio;