import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSave, faArrowLeft, faUserPlus } from '@fortawesome/free-solid-svg-icons';
import BASE_URL from '../../config/config';
import Toast from '../Global/Toast';
import './AgregarSocio.css';

const AgregarSocio = () => {
  const navigate = useNavigate();
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

  const showToast = (message, type = 'exito') => {
    setToast({
      show: true,
      message,
      type
    });
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

  const validarCampo = (name, value) => {
    const soloNumeros = /^[0-9]+$/;
    const textoValido = /^[A-ZÑa-zñáéíóúÁÉÍÓÚ0-9\s.,-]*$/;

    switch (name) {
      case 'dni':
      case 'numero':
      case 'telefono_movil':
      case 'telefono_fijo':
        if (value && !soloNumeros.test(value)) return 'Solo se permiten números';
        if (value.length > 20) return 'Máximo 20 caracteres';
        break;
      case 'nombre':
      case 'domicilio':
        if (value && !textoValido.test(value)) {
          return 'Solo se permiten letras, números, espacios, puntos, comas, guiones y Ñ';
        }
        if (value.length > 100) return 'Máximo 100 caracteres';
        break;
      case 'comentario':
      case 'domicilio_cobro':
        if (value && !textoValido.test(value)) {
          return 'Solo se permiten letras, números, espacios, puntos, comas, guiones y Ñ';
        }
        if (value.length > 100) return 'Máximo 100 caracteres';
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

  const handleFocus = (fieldName) => {
    setActiveField(fieldName);
  };

  const handleBlur = () => {
    setActiveField(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMostrarErrores(true);
    const nuevosErrores = {};

    if (!formData.nombre.trim()) nuevosErrores.nombre = 'El nombre es obligatorio';

    Object.entries(formData).forEach(([key, value]) => {
      const error = validarCampo(key, value);
      if (error) nuevosErrores[key] = error;
    });

    if (Object.keys(nuevosErrores).length > 0) {
      setErrores(nuevosErrores);
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
        setTimeout(() => navigate('/socios'), 2500);
      } else {
        if (data.errores) {
          setErrores(data.errores);
        } else {
          showToast('Error: ' + data.mensaje, 'error');
        }
      }
    } catch (error) {
      showToast('Error de conexión con el servidor', 'error');
    } finally {
      setLoading(false);
    }
  };

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
        
        <form onSubmit={handleSubmit} className="add-socio-form">
          <div className="add-socio-sections">
            <div className="add-socio-section">
              <h3 className="add-socio-section-title">Información Básica</h3>
              <div className="add-socio-section-content">
                <div className={`add-socio-input-wrapper ${formData.nombre || activeField === 'nombre' ? 'has-value' : ''}`}>
                  <label className="add-socio-label">Apellido y Nombre *</label>
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

                {/* Grupo de DNI y Fecha Nacimiento */}
                <div className="add-socio-group">
                  <div className={`add-socio-input-wrapper ${formData.dni || activeField === 'dni' ? 'has-value' : ''}`} style={{flex: 1}}>
                    <label className="add-socio-label">DNI</label>
                    <input
                      name="dni"
                      value={formData.dni || ''}
                      onChange={handleChange}
                      onFocus={() => handleFocus('dni')}
                      onBlur={handleBlur}
                      className="add-socio-input"
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]*"
                    />
                    <span className="add-socio-input-highlight"></span>
                    {mostrarErrores && errores.dni && (
                      <span className="add-socio-error">{errores.dni}</span>
                    )}
                  </div>

                  <div className="add-socio-input-wrapper has-value" style={{flex: 1}}>
                    <label className="add-socio-label">Fecha Nacimiento</label>
                    <input
                      type="date"
                      name="nacimiento"
                      value={formData.nacimiento || ''}
                      onChange={handleChange}
                      onFocus={() => handleFocus('nacimiento')}
                      onBlur={handleBlur}
                      className="add-socio-input"
                    />
                    <span className="add-socio-input-highlight"></span>
                  </div>
                </div>

                {/* Grupo de Categoría y Estado */}
                <div className="add-socio-group">
                  <div className="add-socio-input-wrapper has-value" style={{flex: 1}}>
                    <label className="add-socio-label">Categoría</label>
                    <select 
                      name="id_categoria" 
                      value={formData.id_categoria || ''} 
                      onChange={handleChange}
                      onFocus={() => handleFocus('id_categoria')}
                      onBlur={handleBlur}
                      className="add-socio-input"
                      disabled={loading || !listas.loaded}
                    >
                      <option value="">Seleccionar categoría</option>
                      {listas.categorias.map(c => (
                        <option key={c.id} value={c.id}>{c.descripcion}</option>
                      ))}
                    </select>
                    <span className="add-socio-input-highlight"></span>
                  </div>

                  <div className="add-socio-input-wrapper has-value" style={{flex: 1}}>
                    <label className="add-socio-label">Estado</label>
                    <select 
                      name="id_estado" 
                      value={formData.id_estado || ''} 
                      onChange={handleChange}
                      onFocus={() => handleFocus('id_estado')}
                      onBlur={handleBlur}
                      className="add-socio-input"
                      disabled={loading || !listas.loaded}
                    >
                      <option value="">Seleccionar estado</option>
                      {listas.estados.map(e => (
                        <option key={e.id} value={e.id}>{e.descripcion}</option>
                      ))}
                    </select>
                    <span className="add-socio-input-highlight"></span>
                  </div>
                </div>
              </div>
            </div>

            <div className="add-socio-section">
              <h3 className="add-socio-section-title">Contacto y Cobro</h3>
              <div className="add-socio-section-content">
                {/* Grupo de domicilio y número */}
                <div className="add-socio-group">
                  <div className={`add-socio-input-wrapper ${formData.domicilio || activeField === 'domicilio' ? 'has-value' : ''}`} style={{flex: 2}}>
                    <label className="add-socio-label">Domicilio</label>
                    <input
                      name="domicilio"
                      value={formData.domicilio || ''}
                      onChange={handleChange}
                      onFocus={() => handleFocus('domicilio')}
                      onBlur={handleBlur}
                      className="add-socio-input"
                    />
                    <span className="add-socio-input-highlight"></span>
                    {mostrarErrores && errores.domicilio && (
                      <span className="add-socio-error">{errores.domicilio}</span>
                    )}
                  </div>

                  <div className={`add-socio-input-wrapper ${formData.numero || activeField === 'numero' ? 'has-value' : ''}`} style={{flex: 1}}>
                    <label className="add-socio-label">Número</label>
                    <input
                      name="numero"
                      value={formData.numero || ''}
                      onChange={handleChange}
                      onFocus={() => handleFocus('numero')}
                      onBlur={handleBlur}
                      className="add-socio-input"
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]*"
                    />
                    <span className="add-socio-input-highlight"></span>
                    {mostrarErrores && errores.numero && (
                      <span className="add-socio-error">{errores.numero}</span>
                    )}
                  </div>
                </div>

                <div className={`add-socio-input-wrapper ${formData.domicilio_cobro || activeField === 'domicilio_cobro' ? 'has-value' : ''}`}>
                  <label className="add-socio-label">Domicilio de Cobro</label>
                  <input
                    name="domicilio_cobro"
                    value={formData.domicilio_cobro || ''}
                    onChange={handleChange}
                    onFocus={() => handleFocus('domicilio_cobro')}
                    onBlur={handleBlur}
                    className="add-socio-input"
                  />
                  <span className="add-socio-input-highlight"></span>
                  {mostrarErrores && errores.domicilio_cobro && (
                    <span className="add-socio-error">{errores.domicilio_cobro}</span>
                  )}
                </div>

                {/* Grupo de teléfonos móvil y fijo */}
                <div className="add-socio-group">
                  <div className={`add-socio-input-wrapper ${formData.telefono_movil || activeField === 'telefono_movil' ? 'has-value' : ''}`} style={{flex: 1}}>
                    <label className="add-socio-label">Teléfono Móvil</label>
                    <input
                      name="telefono_movil"
                      value={formData.telefono_movil || ''}
                      onChange={handleChange}
                      onFocus={() => handleFocus('telefono_movil')}
                      onBlur={handleBlur}
                      className="add-socio-input"
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]*"
                    />
                    <span className="add-socio-input-highlight"></span>
                    {mostrarErrores && errores.telefono_movil && (
                      <span className="add-socio-error">{errores.telefono_movil}</span>
                    )}
                  </div>

                  <div className={`add-socio-input-wrapper ${formData.telefono_fijo || activeField === 'telefono_fijo' ? 'has-value' : ''}`} style={{flex: 1}}>
                    <label className="add-socio-label">Teléfono Fijo</label>
                    <input
                      name="telefono_fijo"
                      value={formData.telefono_fijo || ''}
                      onChange={handleChange}
                      onFocus={() => handleFocus('telefono_fijo')}
                      onBlur={handleBlur}
                      className="add-socio-input"
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]*"
                    />
                    <span className="add-socio-input-highlight"></span>
                    {mostrarErrores && errores.telefono_fijo && (
                      <span className="add-socio-error">{errores.telefono_fijo}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="add-socio-section">
              <h3 className="add-socio-section-title">Cobro y Comentarios</h3>
              <div className="add-socio-section-content">
                <div className="add-socio-input-wrapper has-value">
                  <label className="add-socio-label">Métodos de Pago</label>
                  <select 
                    name="id_cobrador" 
                    value={formData.id_cobrador || ''} 
                    onChange={handleChange}
                    onFocus={() => handleFocus('id_cobrador')}
                    onBlur={handleBlur}
                    className="add-socio-input"
                    disabled={loading || !listas.loaded}
                  >
                    <option value="">Seleccionar método</option>
                    {listas.cobradores.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                  <span className="add-socio-input-highlight"></span>
                </div>

                <div className={`add-socio-input-wrapper ${formData.comentario || activeField === 'comentario' ? 'has-value' : ''}`}>
                  <label className="add-socio-label">Comentarios</label>
                  <textarea
                    name="comentario"
                    value={formData.comentario || ''}
                    onChange={handleChange}
                    onFocus={() => handleFocus('comentario')}
                    onBlur={handleBlur}
                    className="add-socio-input"
                    rows="3"
                  />
                  <span className="add-socio-input-highlight"></span>
                  {mostrarErrores && errores.comentario && (
                    <span className="add-socio-error">{errores.comentario}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="add-socio-buttons-container">
            <button 
              type="submit" 
              className="add-socio-button"
              disabled={loading}
            >
              <FontAwesomeIcon icon={faSave} className="add-socio-icon-button" />
              <span className="add-socio-button-text">
                {loading ? 'Guardando...' : 'Guardar Socio'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AgregarSocio;