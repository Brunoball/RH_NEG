import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSave, faArrowLeft, faUserEdit } from '@fortawesome/free-solid-svg-icons';
import BASE_URL from '../../config/config';
import Toast from '../Global/Toast';
import './EditarSocio.css';
import '../Global/roots.css';

const EditarSocio = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const formRef = useRef(null);

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

  const [listas, setListas] = useState({ 
    categorias: [], 
    cobradores: [], 
    estados: [],
    loaded: false
  });
  
  const [datosOriginales, setDatosOriginales] = useState({});
  const [toast, setToast] = useState({
    show: false,
    message: '',
    type: 'exito'
  });
  const [activeField, setActiveField] = useState(null);
  const [loading, setLoading] = useState(true);

  const showToast = (message, type = 'exito') => {
    setToast({
      show: true,
      message,
      type
    });
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Cargar listas primero
        const resListas = await fetch(`${BASE_URL}/api.php?action=listas`);
        const jsonListas = await resListas.json();
        
        if (jsonListas.exito) {
          setListas({
            ...jsonListas.listas,
            loaded: true
          });
        } else {
          showToast('Error al cargar listas: ' + jsonListas.mensaje, 'error');
        }

        // Luego cargar datos del socio
        const resSocio = await fetch(`${BASE_URL}/api.php?action=editar_socio&id=${id}`);
        const dataSocio = await resSocio.json();
        
        if (dataSocio.exito) {
          const socioFormateado = {};
          for (const key in formData) {
            socioFormateado[key] = dataSocio.socio[key] ?? '';
          }
          setFormData(socioFormateado);
          setDatosOriginales(socioFormateado);
        } else {
          showToast('Error al cargar datos del socio: ' + dataSocio.mensaje, 'error');
        }
      } catch (err) {
        showToast('Error de conexión: ' + err.message, 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    let valor = typeof value === 'string' ? value.toUpperCase() : value;
    setFormData((prev) => ({
      ...prev,
      [name]: valor,
    }));
  };

  const handleFocus = (fieldName) => {
    setActiveField(fieldName);
  };

  const handleBlur = () => {
    setActiveField(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const sinCambios = JSON.stringify(formData) === JSON.stringify(datosOriginales);
    if (sinCambios) {
      showToast('No se encontraron cambios para realizar', 'advertencia');
      return;
    }

    try {
      setLoading(true);
      
      const res = await fetch(`${BASE_URL}/api.php?action=editar_socio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, id_socio: id }),
      });

      const data = await res.json();
      if (data.exito) {
        showToast('Socio actualizado correctamente', 'exito');
        setTimeout(() => navigate('/socios'), 2500);
      } else {
        showToast('Error al actualizar: ' + data.mensaje, 'error');
      }
    } catch (error) {
      showToast('Error de red: ' + error, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="edit-socio-container">
      <div className="edit-socio-box">
        {toast.show && (
          <Toast 
            tipo={toast.type} 
            mensaje={toast.message} 
            onClose={() => setToast(prev => ({ ...prev, show: false }))} 
            duracion={3000}
          />
        )}

        <div className="edit-header">
          <div className="edit-icon-title">
            <FontAwesomeIcon icon={faUserEdit} className="edit-icon" />
            <div>
              <h1>Editar Socio #{id}</h1>
              <p>Actualiza la información del socio</p>
            </div>
          </div>
          <button 
            className="edit-back-btn"
            onClick={() => navigate('/socios')}
          >
            <FontAwesomeIcon icon={faArrowLeft} />
            Volver
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="edit-socio-form" ref={formRef}>
          <div className="edit-socio-sections">
            {/* Sección de Información Básica */}
            <div className="edit-socio-section">
              <h3 className="edit-socio-section-title">Información Básica</h3>
              <div className="edit-socio-section-content">
                <div className={`edit-socio-input-wrapper ${formData.nombre || activeField === 'nombre' ? 'has-value' : ''}`}>
                  <label className="edit-socio-label">Nombre completo</label>
                  <input
                    name="nombre"
                    value={formData.nombre || ''}
                    onChange={handleChange}
                    onFocus={() => handleFocus('nombre')}
                    onBlur={handleBlur}
                    className="edit-socio-input"
                  />
                  <span className="edit-socio-input-highlight"></span>
                </div>

                <div className={`edit-socio-input-wrapper ${formData.dni || activeField === 'dni' ? 'has-value' : ''}`}>
                  <label className="edit-socio-label">DNI</label>
                  <input
                    name="dni"
                    value={formData.dni || ''}
                    onChange={handleChange}
                    onFocus={() => handleFocus('dni')}
                    onBlur={handleBlur}
                    className="edit-socio-input"
                  />
                  <span className="edit-socio-input-highlight"></span>
                </div>

                <div className={`edit-socio-input-wrapper ${formData.nacimiento || activeField === 'nacimiento' ? 'has-value' : ''}`}>
                  <label className="edit-socio-label">Fecha de nacimiento</label>
                  <input
                    type="date"
                    name="nacimiento"
                    value={formData.nacimiento || ''}
                    onChange={handleChange}
                    onFocus={() => handleFocus('nacimiento')}
                    onBlur={handleBlur}
                    className="edit-socio-input"
                  />
                  <span className="edit-socio-input-highlight"></span>
                </div>

                <div 
                  className={`edit-socio-input-wrapper ${formData.numero || activeField === 'numero' ? 'has-value' : ''}`}
                  data-field="numero"
                >
                  <label className="edit-socio-label">Número de Domicilio</label>
                  <input
                    name="numero"
                    value={formData.numero || ''}
                    onChange={handleChange}
                    onFocus={() => handleFocus('numero')}
                    onBlur={handleBlur}
                    className="edit-socio-input"
                  />
                  <span className="edit-socio-input-highlight"></span>
                </div>

                <div className={`edit-socio-input-wrapper ${formData.ingreso || activeField === 'ingreso' ? 'has-value' : ''}`}>
                  <label className="edit-socio-label">Fecha de Ingreso</label>
                  <input
                    name="ingreso"
                    value={formData.ingreso || ''}
                    onChange={handleChange}
                    onFocus={() => handleFocus('ingreso')}
                    onBlur={handleBlur}
                    className="edit-socio-input"
                  />
                  <span className="edit-socio-input-highlight"></span>
                </div>
              </div>
            </div>

            {/* Sección de Contacto y Cobro */}
            <div className="edit-socio-section">
              <h3 className="edit-socio-section-title">Contacto y Cobro</h3>
              <div className="edit-socio-section-content">
                <div className={`edit-socio-input-wrapper ${formData.domicilio || activeField === 'domicilio' ? 'has-value' : ''}`}>
                  <label className="edit-socio-label">Domicilio</label>
                  <input
                    name="domicilio"
                    value={formData.domicilio || ''}
                    onChange={handleChange}
                    onFocus={() => handleFocus('domicilio')}
                    onBlur={handleBlur}
                    className="edit-socio-input"
                  />
                  <span className="edit-socio-input-highlight"></span>
                </div>

                <div className={`edit-socio-input-wrapper ${formData.domicilio_cobro || activeField === 'domicilio_cobro' ? 'has-value' : ''}`}>
                  <label className="edit-socio-label">Domicilio de Cobro</label>
                  <input
                    name="domicilio_cobro"
                    value={formData.domicilio_cobro || ''}
                    onChange={handleChange}
                    onFocus={() => handleFocus('domicilio_cobro')}
                    onBlur={handleBlur}
                    className="edit-socio-input"
                  />
                  <span className="edit-socio-input-highlight"></span>
                </div>

                <div className={`edit-socio-input-wrapper ${formData.telefono_movil || activeField === 'telefono_movil' ? 'has-value' : ''}`}>
                  <label className="edit-socio-label">Teléfono Móvil</label>
                  <input
                    name="telefono_movil"
                    value={formData.telefono_movil || ''}
                    onChange={handleChange}
                    onFocus={() => handleFocus('telefono_movil')}
                    onBlur={handleBlur}
                    className="edit-socio-input"
                  />
                  <span className="edit-socio-input-highlight"></span>
                </div>

                <div className={`edit-socio-input-wrapper ${formData.telefono_fijo || activeField === 'telefono_fijo' ? 'has-value' : ''}`}>
                  <label className="edit-socio-label">Teléfono Fijo</label>
                  <input
                    name="telefono_fijo"
                    value={formData.telefono_fijo || ''}
                    onChange={handleChange}
                    onFocus={() => handleFocus('telefono_fijo')}
                    onBlur={handleBlur}
                    className="edit-socio-input"
                  />
                  <span className="edit-socio-input-highlight"></span>
                </div>

                <div className={`edit-socio-input-wrapper ${formData.id_cobrador || activeField === 'id_cobrador' ? 'has-value' : ''}`}>
                  <label className="edit-socio-label">Cobrador</label>
                  <select 
                    name="id_cobrador" 
                    value={formData.id_cobrador || ''} 
                    onChange={handleChange}
                    onFocus={() => handleFocus('id_cobrador')}
                    onBlur={handleBlur}
                    className="edit-socio-input"
                    disabled={loading || !listas.loaded}
                  >
                    <option value="" disabled hidden>Seleccione un cobrador</option>
                    {listas.cobradores.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                  <span className="edit-socio-input-highlight"></span>
                </div>
              </div>
            </div>

            {/* Sección de Estado y Comentarios */}
            <div className="edit-socio-section">
              <h3 className="edit-socio-section-title">Estado y Comentarios</h3>
              <div className="edit-socio-section-content">
                <div className={`edit-socio-input-wrapper ${formData.id_categoria || activeField === 'id_categoria' ? 'has-value' : ''}`}>
                  <label className="edit-socio-label">Categoría</label>
                  <select 
                    name="id_categoria" 
                    value={formData.id_categoria || ''} 
                    onChange={handleChange}
                    onFocus={() => handleFocus('id_categoria')}
                    onBlur={handleBlur}
                    className="edit-socio-input"
                    disabled={loading || !listas.loaded}
                  >
                    <option value="" disabled hidden>Seleccione una categoría</option>
                    {listas.categorias.map(c => (
                      <option key={c.id} value={c.id}>{c.descripcion}</option>
                    ))}
                  </select>
                  <span className="edit-socio-input-highlight"></span>
                </div>

                <div className={`edit-socio-input-wrapper ${formData.id_estado || activeField === 'id_estado' ? 'has-value' : ''}`}>
                  <label className="edit-socio-label">Estado</label>
                  <select 
                    name="id_estado" 
                    value={formData.id_estado || ''} 
                    onChange={handleChange}
                    onFocus={() => handleFocus('id_estado')}
                    onBlur={handleBlur}
                    className="edit-socio-input"
                    disabled={loading || !listas.loaded}
                  >
                    <option value="" disabled hidden>Seleccione un estado</option>
                    {listas.estados.map(e => (
                      <option key={e.id} value={e.id}>{e.descripcion}</option>
                    ))}
                  </select>
                  <span className="edit-socio-input-highlight"></span>
                </div>

                <div className={`edit-socio-input-wrapper ${formData.deuda_2024 || activeField === 'deuda_2024' ? 'has-value' : ''}`}>
                  <label className="edit-socio-label">Deuda 2024</label>
                  <input
                    name="deuda_2024"
                    value={formData.deuda_2024 || ''}
                    onChange={handleChange}
                    onFocus={() => handleFocus('deuda_2024')}
                    onBlur={handleBlur}
                    className="edit-socio-input"
                  />
                  <span className="edit-socio-input-highlight"></span>
                </div>

                <div className={`edit-socio-input-wrapper ${formData.id_periodo_adeudado || activeField === 'id_periodo_adeudado' ? 'has-value' : ''}`}>
                  <label className="edit-socio-label">Periodo Adeudado</label>
                  <input
                    name="id_periodo_adeudado"
                    value={formData.id_periodo_adeudado || ''}
                    onChange={handleChange}
                    onFocus={() => handleFocus('id_periodo_adeudado')}
                    onBlur={handleBlur}
                    className="edit-socio-input"
                  />
                  <span className="edit-socio-input-highlight"></span>
                </div>

                <div className={`edit-socio-input-wrapper ${formData.comentario || activeField === 'comentario' ? 'has-value' : ''}`}>
                  <label className="edit-socio-label">Comentarios</label>
                  <input
                    name="comentario"
                    value={formData.comentario || ''}
                    onChange={handleChange}
                    onFocus={() => handleFocus('comentario')}
                    onBlur={handleBlur}
                    className="edit-socio-input"
                    rows="3"
                  />
                  <span className="edit-socio-input-highlight"></span>
                </div>
              </div>
            </div>
          </div>

          <div className="edit-socio-buttons-container">
            <button 
              type="submit" 
              className="edit-socio-button"
              disabled={loading}
            >
              <FontAwesomeIcon icon={faSave} className="edit-socio-icon-button" />
              <span className="edit-socio-button-text">
                {loading ? 'Actualizar Socio' : 'Actualizar Socio'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditarSocio;