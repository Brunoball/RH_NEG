import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faSave, 
  faArrowLeft, 
  faUserPlus, 
  faArrowRight, 
  faArrowLeft as faStepBack,
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
import './AgregarSocio.css';

const AgregarSocio = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [listas, setListas] = useState({ 
    categorias: [], 
    cobradores: [], 
    estados: [],
    loaded: false
  });
  
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
    dni: ''
  });

  const [errores, setErrores] = useState({});
  const [mostrarErrores, setMostrarErrores] = useState(false);
  const [toast, setToast] = useState({
    show: false,
    message: '',
    type: 'exito'
  });
  const [loading, setLoading] = useState(false);
  const [activeField, setActiveField] = useState(null);
  const nacimientoRef = useRef(null);

  const openDateWithGesture = (ref) => (e) => {
    const el = ref.current;
    if (!el) return;
    e.preventDefault();
    el.focus({ preventScroll: true });
    if (typeof el.showPicker === 'function') {
      try { el.showPicker(); } catch {}
    } else {
      el.click();
    }
  };

  const showToast = (message, type = 'exito') => {
    setToast({ show: true, message, type });
  };

  useEffect(() => {
    const fetchListas = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${BASE_URL}/api.php?action=listas`);
        const json = await res.json();
        if (json.exito) {
          setListas({
            ...json.listas,
            loaded: true
          });
        } else {
          showToast('Error al cargar listas: ' + json.mensaje, 'error');
        }
      } catch (err) {
        showToast('Error de conexión: ' + err.message, 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchListas();
  }, []);

  const handleNumberChange = (e) => {
    const { name, value } = e.target;
    const numericValue = value.replace(/[^0-9]/g, '');
    setFormData(prev => ({
      ...prev,
      [name]: numericValue,
    }));
  };

  const soloNumeros = /^[0-9]+$/;
  const textoValido = /^[\p{L}\p{N}\s.,-]*$/u;

  const validarCampo = (name, value) => {
    switch (name) {
      case 'dni':
      case 'numero':
      case 'telefono_movil':
      case 'telefono_fijo':
        if (value && !soloNumeros.test(value)) return 'Solo se permiten números';
        if (value && value.length > 20) return 'Máximo 20 caracteres';
        break;

      case 'nombre':
      case 'domicilio':
        if (!value && name === 'nombre') return 'El nombre es obligatorio';
        if (value && !textoValido.test(value)) {
          return 'Solo letras/números, espacios y . , -';
        }
        if (value && value.length > 100) return 'Máximo 100 caracteres';
        break;

      case 'comentario':
        if (value && !textoValido.test(value)) {
          return 'Solo letras/números, espacios y . , -';
        }
        if (value && value.length > 1000) return 'Máximo 1000 caracteres';
        break;

      case 'domicilio_cobro':
        if (value && value.length > 150) return 'Máximo 150 caracteres';
        break;

      default:
        return null;
    }
    return null;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const valor = typeof value === 'string' ? value.toUpperCase() : value;
    setFormData(prev => ({ ...prev, [name]: valor }));
  };

  const handleFocus = (fieldName) => setActiveField(fieldName);
  const handleBlur = () => setActiveField(null);

  const validarPasoActual = () => {
    const nuevosErrores = {};

    // Solo validamos "nombre" en cualquier paso
    if (!formData.nombre.trim()) {
      nuevosErrores.nombre = 'El nombre es obligatorio';
    }

    setErrores(nuevosErrores);
    setMostrarErrores(true);
    return Object.keys(nuevosErrores).length === 0;
  };

  const handleNextStep = () => {
    if (!formData.nombre.trim()) {
      setErrores({ nombre: 'El nombre es obligatorio' });
      setMostrarErrores(true);
      return;
    }

    setCurrentStep(prev => Math.min(prev + 1, 3));
    setMostrarErrores(false);
  };

  const handlePrevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
    setMostrarErrores(false);
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!formData.nombre.trim()) {
      setErrores({ nombre: 'El nombre es obligatorio' });
      setMostrarErrores(true);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${BASE_URL}/api.php?action=agregar_socio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (data.exito) {
        showToast('Socio agregado correctamente', 'exito');
        setTimeout(() => navigate('/socios'), 1500);
      } else {
        showToast('Error: ' + (data.mensaje || 'Desconocido'), 'error');
      }
    } catch (error) {
      showToast('Error de conexión con el servidor', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFormKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (currentStep < 3) {
        handleNextStep();
      }
    }
  };

  const ProgressSteps = () => (
    <div className="progress-steps">
      {[1, 2, 3].map((step) => (
        <div 
          key={step}
          className={`progress-step ${currentStep === step ? 'active' : ''} ${currentStep > step ? 'completed' : ''}`}
          onClick={() => currentStep > step && setCurrentStep(step)}
        >
          <div className="step-number">{step}</div>
          <div className="step-label">
            {step === 1 && 'Información'}
            {step === 2 && 'Contacto'}
            {step === 3 && 'Cobro'}
          </div>
        </div>
      ))}
      <div className="progress-bar">
        <div 
          className="progress-bar-fill" 
          style={{ width: `${((currentStep - 1) / 2) * 100}%` }}
        />
      </div>
    </div>
  );

  return (
    <div className="add-socio-container">
      <div className="add-socio-box">
        {toast.show && (
          <Toast 
            tipo={toast.type} 
            mensaje={toast.message} 
            onClose={() => setToast(prev => ({ ...prev, show: false }))} 
            duracion={3000}
          />
        )}

        <div className="add-header">
          <div className="add-icon-title">
            <FontAwesomeIcon icon={faUserPlus} className="add-icon" />
            <div>
              <h1>Agregar Nuevo Socio</h1>
              <p>Complete los datos del nuevo socio</p>
            </div>
          </div>
          <button 
            className="add-back-btn"
            onClick={() => navigate('/socios')}
            disabled={loading}
          >
            <FontAwesomeIcon icon={faArrowLeft} />
            Volver
          </button>
        </div>
        
        <ProgressSteps />
        
        <form 
          onSubmit={(e) => e.preventDefault()}
          onKeyDown={handleFormKeyDown} 
          className="add-socio-form"
        >
          {/* Paso 1: Información Básica */}
          {currentStep === 1 && (
            <div className="add-socio-section">
              <h3 className="add-socio-section-title">Información Básica</h3>
              <div className="add-socio-section-content">
                <div className={`add-socio-input-wrapper ${formData.nombre || activeField === 'nombre' ? 'has-value' : ''}`}>
                  <label className="add-socio-label">
                    <FontAwesomeIcon icon={faUser} className="input-icon" />
                    Apellido y Nombre
                  </label>
                  <input
                    name="nombre"
                    value={formData.nombre || ''}
                    onChange={handleChange}
                    onFocus={() => handleFocus('nombre')}
                    onBlur={handleBlur}
                    className="add-socio-input"
                  />
                  <span className="add-socio-input-highlight"></span>
                  {mostrarErrores && errores.nombre && (
                    <span className="add-socio-error">{errores.nombre}</span>
                  )}
                </div>

                <div className="add-socio-group-row">
                  <div className={`add-socio-input-wrapper ${formData.dni || activeField === 'dni' ? 'has-value' : ''}`}>
                    <label className="add-socio-label">
                      <FontAwesomeIcon icon={faIdCard} className="input-icon" />
                      DNI
                    </label>
                    <input
                      name="dni"
                      value={formData.dni || ''}
                      onChange={handleNumberChange}
                      onFocus={() => handleFocus('dni')}
                      onBlur={handleBlur}
                      className="add-socio-input"
                      inputMode="numeric"
                    />
                    <span className="add-socio-input-highlight"></span>
                    {mostrarErrores && errores.dni && (
                      <span className="add-socio-error">{errores.dni}</span>
                    )}
                  </div>

                  <div
                    className="add-socio-input-wrapper always-active"
                    onMouseDown={openDateWithGesture(nacimientoRef)}
                    onTouchStart={openDateWithGesture(nacimientoRef)}
                  >
                    <label
                      htmlFor="nacimiento"
                      className="add-socio-label"
                      onMouseDown={openDateWithGesture(nacimientoRef)}
                      onTouchStart={openDateWithGesture(nacimientoRef)}
                    >
                      <FontAwesomeIcon icon={faCalendarDays} className="input-icon" />
                      Fecha Nacimiento
                    </label>

                    <input
                      id="nacimiento"
                      ref={nacimientoRef}
                      type="date"
                      name="nacimiento"
                      value={formData.nacimiento || ''}
                      onChange={handleChange}
                      onFocus={() => handleFocus('nacimiento')}
                      onBlur={handleBlur}
                      onClick={openDateWithGesture(nacimientoRef)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          openDateWithGesture(nacimientoRef)(e);
                        }
                      }}
                      className="add-socio-input"
                    />
                    <span className="add-socio-input-highlight"></span>
                  </div>
                </div>

                <div className="add-socio-group-row">
                  <div className={`add-socio-input-wrapper always-active ${formData.id_categoria || activeField === 'id_categoria' ? 'has-value' : ''}`}>
                    <label className="add-socio-label">
                      <FontAwesomeIcon icon={faUserTag} className="input-icon" />
                      Categoría
                    </label>
                    <select 
                      name="id_categoria" 
                      value={formData.id_categoria || ''} 
                      onChange={handleChange}
                      onFocus={() => handleFocus('id_categoria')}
                      onBlur={handleBlur}
                      className="add-socio-input"
                      disabled={loading || !listas.loaded}
                    >
                      <option value="" disabled hidden>Seleccione categoría</option>
                      {listas.categorias.map(c => (
                        <option key={c.id} value={c.id}>{c.descripcion}</option>
                      ))}
                    </select>
                    <span className="add-socio-input-highlight"></span>
                  </div>

                  <div className={`add-socio-input-wrapper always-active ${formData.id_estado || activeField === 'id_estado' ? 'has-value' : ''}`}>
                    <label className="add-socio-label">
                      <FontAwesomeIcon icon={faCircleInfo} className="input-icon" />
                      Estado
                    </label>
                    <select 
                      name="id_estado" 
                      value={formData.id_estado || ''} 
                      onChange={handleChange}
                      onFocus={() => handleFocus('id_estado')}
                      onBlur={handleBlur}
                      className="add-socio-input"
                      disabled={loading || !listas.loaded}
                    >
                      <option value="" disabled hidden>Seleccione estado</option>
                      {listas.estados.map(e => (
                        <option key={e.id} value={e.id}>{e.descripcion}</option>
                      ))}
                    </select>
                    <span className="add-socio-input-highlight"></span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Paso 2: Contacto y Cobro */}
          {currentStep === 2 && (
            <div className="add-socio-section">
              <h3 className="add-socio-section-title">Contacto y Cobro</h3>
              <div className="add-socio-section-content">
                <div className="add-socio-domicilio-group">
                  <div className={`add-socio-input-wrapper ${formData.domicilio || activeField === 'domicilio' ? 'has-value' : ''}`}>
                    <label className="add-socio-label">
                      <FontAwesomeIcon icon={faHome} className="input-icon" />
                      Domicilio
                    </label>
                    <input
                      name="domicilio"
                      value={formData.domicilio || ''}
                      onChange={handleChange}
                      onFocus={() => handleFocus('domicilio')}
                      onBlur={handleBlur}
                      className="add-socio-input"
                    />
                    <span className="add-socio-input-highlight"></span>
                  </div>

                  <div className={`add-socio-input-wrapper ${formData.numero || activeField === 'numero' ? 'has-value' : ''}`}>
                    <label className="add-socio-label">
                      <FontAwesomeIcon icon={faHashtag} className="input-icon" />
                      Número
                    </label>
                    <input
                      name="numero"
                      value={formData.numero || ''}
                      onChange={handleNumberChange}
                      onFocus={() => handleFocus('numero')}
                      onBlur={handleBlur}
                      className="add-socio-input"
                      inputMode="numeric"
                    />
                    <span className="add-socio-input-highlight"></span>
                  </div>
                </div>

                <div className={`add-socio-input-wrapper ${formData.domicilio_cobro || activeField === 'domicilio_cobro' ? 'has-value' : ''}`}>
                  <label className="add-socio-label">
                    <FontAwesomeIcon icon={faMapMarkerAlt} className="input-icon" />
                    Domicilio de Cobro
                  </label>
                  <input
                    name="domicilio_cobro"
                    value={formData.domicilio_cobro || ''}
                    onChange={handleChange}
                    onFocus={() => handleFocus('domicilio_cobro')}
                    onBlur={handleBlur}
                    className="add-socio-input"
                  />
                  <span className="add-socio-input-highlight"></span>
                </div>

                <div className="add-socio-group-row">
                  <div className={`add-socio-input-wrapper ${formData.telefono_movil || activeField === 'telefono_movil' ? 'has-value' : ''}`}>
                    <label className="add-socio-label">
                      <FontAwesomeIcon icon={faMobileScreen} className="input-icon" />
                      Teléfono Móvil
                    </label>
                    <input
                      name="telefono_movil"
                      value={formData.telefono_movil || ''}
                      onChange={handleNumberChange}
                      onFocus={() => handleFocus('telefono_movil')}
                      onBlur={handleBlur}
                      className="add-socio-input"
                      inputMode="tel"
                    />
                    <span className="add-socio-input-highlight"></span>
                  </div>

                  <div className={`add-socio-input-wrapper ${formData.telefono_fijo || activeField === 'telefono_fijo' ? 'has-value' : ''}`}>
                    <label className="add-socio-label">
                      <FontAwesomeIcon icon={faPhone} className="input-icon" />
                      Teléfono Fijo
                    </label>
                    <input
                      name="telefono_fijo"
                      value={formData.telefono_fijo || ''}
                      onChange={handleNumberChange}
                      onFocus={() => handleFocus('telefono_fijo')}
                      onBlur={handleBlur}
                      className="add-socio-input"
                      inputMode="tel"
                    />
                    <span className="add-socio-input-highlight"></span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Paso 3: Cobro y Comentarios */}
          {currentStep === 3 && (
            <div className="add-socio-section">
              <h3 className="add-socio-section-title">Cobro y Comentarios</h3>
              <div className="add-socio-section-content">
                <div className={`add-socio-input-wrapper always-active ${formData.id_cobrador || activeField === 'id_cobrador' ? 'has-value' : ''}`}>
                  <label className="add-socio-label">
                    <FontAwesomeIcon icon={faMoneyBillWave} className="input-icon" />
                    Métodos de Pago
                  </label>
                  <select 
                    name="id_cobrador" 
                    value={formData.id_cobrador || ''} 
                    onChange={handleChange}
                    onFocus={() => handleFocus('id_cobrador')}
                    onBlur={handleBlur}
                    className="add-socio-input"
                    disabled={loading || !listas.loaded}
                  >
                    <option value="" disabled hidden>Seleccione método</option>
                    {listas.cobradores.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                  <span className="add-socio-input-highlight"></span>
                </div>

                <div className={`add-socio-input-wrapper ${formData.comentario || activeField === 'comentario' ? 'has-value' : ''}`}>
                  <label className="add-socio-label">
                    <FontAwesomeIcon icon={faComment} className="input-icon" />
                    Comentarios
                  </label>
                  <textarea
                    name="comentario"
                    value={formData.comentario || ''}
                    onChange={handleChange}
                    onFocus={() => handleFocus('comentario')}
                    onBlur={handleBlur}
                    className="add-socio-textarea"
                    rows="4"
                  />
                  <span className="add-socio-input-highlight"></span>
                </div>
              </div>
            </div>
          )}

        </form>
                  <div className="add-socio-buttons-container">
            {currentStep > 1 && (
              <button 
                type="button"
                className="add-socio-button prev-step"
                onClick={handlePrevStep}
                disabled={loading}
              >
                <FontAwesomeIcon icon={faStepBack} className="add-socio-icon-button" />
                <span className="add-socio-button-text">Anterior</span>
              </button>
            )}
            
            {currentStep < 3 ? (
              <button 
                type="button"
                className="add-socio-button next-step"
                onClick={handleNextStep}
                disabled={loading}
              >
                <span className="add-socio-button-text">Siguiente</span>
                <FontAwesomeIcon icon={faArrowRight} className="add-socio-icon-button" />
              </button>
            ) : (
              <button 
                type="button"
                className="add-socio-button"
                onClick={handleSubmit}
                disabled={loading}
              >
                <FontAwesomeIcon icon={faSave} className="add-socio-icon-button" />
                <span className="add-socio-button-text">
                  {loading ? 'Guardando...' : 'Guardar Socio'}
                </span>
              </button>
            )}
          </div>
      </div>
    </div>
  );
};

export default AgregarSocio;