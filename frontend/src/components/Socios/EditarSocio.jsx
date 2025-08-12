import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faSave, 
  faArrowLeft, 
  faUserEdit,
  faUser,
  faIdCard,
  faUserTag,
  faCircleInfo,
  faCalendarDays,
  faHome,
  faHashtag,
  faMapMarkerAlt,
  faMobileScreen,
  faPhone,
  faMoneyBillWave,
  faComment
} from '@fortawesome/free-solid-svg-icons';
import BASE_URL from '../../config/config';
import Toast from '../Global/Toast';
import './EditarSocio.css';
import '../Global/roots.css';

const EditarSocio = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const formRef = useRef(null);
  const [activeTab, setActiveTab] = useState('datos');

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
  });

  const [listas, setListas] = useState({ 
    categorias: [], 
    cobradores: [], 
    estados: [],
    periodos: [],
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

  const formatFechaISO = (fecha) => {
    if (!fecha || fecha === '0000-00-00' || fecha === 'NULL') return '';

    if (typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return fecha;
    }

    if (typeof fecha === 'string' && fecha.includes('T')) {
      try {
        const dateObj = new Date(fecha);
        if (!isNaN(dateObj.getTime())) {
          const year = dateObj.getFullYear();
          const month = String(dateObj.getMonth() + 1).padStart(2, '0');
          const day = String(dateObj.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        }
      } catch (e) {
        console.error("Error al parsear fecha:", e);
      }
    }

    if (typeof fecha === 'string') {
      const parts = fecha.split(/[\/\-]/);
      if (parts.length === 3) {
        let [d, m, y] = parts;
        if (y.length === 2) y = `20${y}`;
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
    }

    return '';
  };

  const handleNumberChange = (e) => {
    const { name, value } = e.target;
    const numericValue = value.replace(/[^0-9]/g, '');
    setFormData(prev => ({
      ...prev,
      [name]: numericValue,
    }));
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
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

        const resSocio = await fetch(`${BASE_URL}/api.php?action=editar_socio&id=${id}`);
        const dataSocio = await resSocio.json();
        
        if (dataSocio.exito) {
          const socioFormateado = {};
          for (const key in formData) {
            if (key === 'nacimiento' || key === 'ingreso') {
              socioFormateado[key] = formatFechaISO(dataSocio.socio[key]);
            } else {
              socioFormateado[key] = dataSocio.socio[key] ?? '';
            }
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

  const normalizar = (data) => {
    const copia = { ...data };
    Object.keys(copia).forEach((key) => {
      if (copia[key] === '') copia[key] = null;
    });
    return copia;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const formNormalizado = normalizar(formData);
    const originalNormalizado = normalizar(datosOriginales);
    const sinCambios = JSON.stringify(formNormalizado) === JSON.stringify(originalNormalizado);
    
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
          {/* Pestañas de navegación */}
          <div className="edit-tabs">
            <div 
              className={`edit-tab ${activeTab === 'datos' ? 'active' : ''}`}
              onClick={() => setActiveTab('datos')}
            >
              Datos Generales
            </div>
            <div 
              className={`edit-tab ${activeTab === 'contacto' ? 'active' : ''}`}
              onClick={() => setActiveTab('contacto')}
            >
              Contacto
            </div>
            <div 
              className={`edit-tab ${activeTab === 'cobranza' ? 'active' : ''}`}
              onClick={() => setActiveTab('cobranza')}
            >
              Cobranza
            </div>
          </div>

          {/* Contenido de las pestañas */}
          <div className="edit-tab-content">
            {/* Pestaña Datos Generales */}
            {activeTab === 'datos' && (
              <div className="edit-tab-pane active">
                <div className="edit-socio-section">
                  <div className={`edit-socio-input-wrapper ${formData.nombre || activeField === 'nombre' ? 'has-value' : ''}`}>
                    <label className="edit-socio-label">
                      <FontAwesomeIcon icon={faUser} className="input-icon" />
                      Apellido y Nombre
                    </label>
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

                  <div className="edit-socio-group-row">
                    <div className={`edit-socio-input-wrapper ${formData.dni || activeField === 'dni' ? 'has-value' : ''}`}>
                      <label className="edit-socio-label">
                        <FontAwesomeIcon icon={faIdCard} className="input-icon" />
                        DNI
                      </label>
                      <input
                        name="dni"
                        value={formData.dni || ''}
                        onChange={handleNumberChange}
                        onFocus={() => handleFocus('dni')}
                        onBlur={handleBlur}
                        className="edit-socio-input"
                        inputMode="numeric"
                      />
                      <span className="edit-socio-input-highlight"></span>
                    </div>

                    <div className={`edit-socio-input-wrapper ${formData.nacimiento || activeField === 'nacimiento' ? 'has-value' : ''}`}>
                      <label className="edit-socio-label">
                        <FontAwesomeIcon icon={faCalendarDays} className="input-icon" />
                        Fecha de Nacimiento
                      </label>
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
                  </div>

                  <div className="edit-socio-group-row">
                    <div className={`edit-socio-input-wrapper has-value`}>
                      <label className="edit-socio-label">
                        <FontAwesomeIcon icon={faCalendarDays} className="input-icon" />
                        Fecha de Ingreso
                      </label>
                      <input
                        type="date"
                        name="ingreso"
                        value={formData.ingreso || ''}
                        onChange={handleChange}
                        onFocus={() => handleFocus('ingreso')}
                        onBlur={handleBlur}
                        className="edit-socio-input"
                      />
                      <span className="edit-socio-input-highlight"></span>
                    </div>

                    <div className={`edit-socio-input-wrapper ${formData.id_categoria || activeField === 'id_categoria' ? 'has-value' : ''}`}>
                      <label className="edit-socio-label">
                        <FontAwesomeIcon icon={faUserTag} className="input-icon" />
                        Categoría
                      </label>
                      <select 
                        name="id_categoria" 
                        value={formData.id_categoria || ''} 
                        onChange={handleChange}
                        onFocus={() => handleFocus('id_categoria')}
                        onBlur={handleBlur}
                        className="edit-socio-input"
                        disabled={loading || !listas.loaded}
                      >
                        <option value="" disabled hidden>Seleccione categoría</option>
                        {listas.categorias.map(c => (
                          <option key={c.id} value={c.id}>{c.descripcion}</option>
                        ))}
                      </select>
                      <span className="edit-socio-input-highlight"></span>
                    </div>

                    <div className={`edit-socio-input-wrapper ${formData.id_estado || activeField === 'id_estado' ? 'has-value' : ''}`}>
                      <label className="edit-socio-label">
                        <FontAwesomeIcon icon={faCircleInfo} className="input-icon" />
                        Estado
                      </label>
                      <select 
                        name="id_estado" 
                        value={formData.id_estado || ''} 
                        onChange={handleChange}
                        onFocus={() => handleFocus('id_estado')}
                        onBlur={handleBlur}
                        className="edit-socio-input"
                        disabled={loading || !listas.loaded}
                      >
                        <option value="" disabled hidden>Seleccione estado</option>
                        {listas.estados.map(e => (
                          <option key={e.id} value={e.id}>{e.descripcion}</option>
                        ))}
                      </select>
                      <span className="edit-socio-input-highlight"></span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Pestaña Contacto */}
            {activeTab === 'contacto' && (
              <div className="edit-tab-pane active">
                <div className="edit-socio-section">
                  <div className="edit-socio-domicilio-group">
                    <div className={`edit-socio-input-wrapper ${formData.domicilio || activeField === 'domicilio' ? 'has-value' : ''}`}>
                      <label className="edit-socio-label">
                        <FontAwesomeIcon icon={faHome} className="input-icon" />
                        Domicilio
                      </label>
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
                    
                    <div className={`edit-socio-input-wrapper ${formData.numero || activeField === 'numero' ? 'has-value' : ''}`}>
                      <label className="edit-socio-label">
                        <FontAwesomeIcon icon={faHashtag} className="input-icon" />
                        Número
                      </label>
                      <input
                        name="numero"
                        value={formData.numero || ''}
                        onChange={handleNumberChange}
                        onFocus={() => handleFocus('numero')}
                        onBlur={handleBlur}
                        className="edit-socio-input"
                        inputMode="numeric"
                      />
                      <span className="edit-socio-input-highlight"></span>
                    </div>
                  </div>
                  <div className={`edit-socio-input-wrapper ${formData.domicilio_cobro || activeField === 'domicilio_cobro' ? 'has-value' : ''}`}>
                    <label className="edit-socio-label">
                      <FontAwesomeIcon icon={faMapMarkerAlt} className="input-icon" />
                      Domicilio de Cobro
                    </label>
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
                    <label className="edit-socio-label">
                      <FontAwesomeIcon icon={faMobileScreen} className="input-icon" />
                      Teléfono Móvil
                    </label>
                    <input
                      name="telefono_movil"
                      value={formData.telefono_movil || ''}
                      onChange={handleNumberChange}
                      onFocus={() => handleFocus('telefono_movil')}
                      onBlur={handleBlur}
                      className="edit-socio-input"
                      inputMode="tel"
                    />
                    <span className="edit-socio-input-highlight"></span>
                  </div>

                  <div className={`edit-socio-input-wrapper ${formData.telefono_fijo || activeField === 'telefono_fijo' ? 'has-value' : ''}`}>
                    <label className="edit-socio-label">
                      <FontAwesomeIcon icon={faPhone} className="input-icon" />
                      Teléfono Fijo
                    </label>
                    <input
                      name="telefono_fijo"
                      value={formData.telefono_fijo || ''}
                      onChange={handleNumberChange}
                      onFocus={() => handleFocus('telefono_fijo')}
                      onBlur={handleBlur}
                      className="edit-socio-input"
                      inputMode="tel"
                    />
                    <span className="edit-socio-input-highlight"></span>
                  </div>
                </div>
              </div>
            )}

            {/* Pestaña Cobranza */}
            {activeTab === 'cobranza' && (
              <div className="edit-tab-pane active">
                <div className="edit-socio-section">
                  <div className={`edit-socio-input-wrapper ${formData.id_cobrador || activeField === 'id_cobrador' ? 'has-value' : ''}`}>
                    <label className="edit-socio-label">
                      <FontAwesomeIcon icon={faMoneyBillWave} className="input-icon" />
                      Medios de Pago
                    </label>
                    <select 
                      name="id_cobrador" 
                      value={formData.id_cobrador || ''} 
                      onChange={handleChange}
                      onFocus={() => handleFocus('id_cobrador')}
                      onBlur={handleBlur}
                      className="edit-socio-input"
                      disabled={loading || !listas.loaded}
                    >
                      <option value="" disabled hidden>Seleccione cobrador</option>
                      {listas.cobradores.map(c => (
                        <option key={c.id} value={c.id}>{c.nombre}</option>
                      ))}
                    </select>
                    <span className="edit-socio-input-highlight"></span>
                  </div>

                  <div className={`edit-socio-input-wrapper ${formData.comentario || activeField === 'comentario' ? 'has-value' : ''}`}>
                    <label className="edit-socio-label">
                      <FontAwesomeIcon icon={faComment} className="input-icon" />
                      Comentarios
                    </label>
                    <textarea
                      name="comentario"
                      value={formData.comentario || ''}
                      onChange={handleChange}
                      onFocus={() => handleFocus('comentario')}
                      onBlur={handleBlur}
                      className="edit-socio-textarea"
                      rows="4"
                    />
                    <span className="edit-socio-input-highlight"></span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="edit-socio-buttons-container">
            <button 
              type="submit" 
              className="edit-socio-button"
              disabled={loading}
            >
              <FontAwesomeIcon icon={faSave} className="edit-socio-icon-button" />
              <span className="edit-socio-button-text">
                {loading ? 'Guardando...' : 'Actualizar Socio'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditarSocio;