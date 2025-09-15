// src/components/Socios/AgregarSocio.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  faCircleInfo,
  faCalendarDays,
  faHome,
  faHashtag,
  faMapMarkerAlt,
  faMobileScreen,
  faPhone,
  faMoneyBillWave,
  faComment,
  faTags,
  faDroplet,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import BASE_URL from '../../config/config';
import Toast from '../Global/Toast';
import './AgregarSocio.css';

/* ===== Modal Confirmar “Volver sin guardar” (mismo diseño catdel-*) ===== */
function ConfirmLeaveModal({ open, onConfirm, onCancel, loading }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel?.();
      if (e.key === 'Enter') onConfirm?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onConfirm, onCancel]);

  if (!open) return null;

  return (
    <div
      className="catdel-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="addleave-modal-title"
      onClick={onCancel}
    >
      <div
        className="catdel-modal-container catdel-modal--danger"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="catdel-modal__icon" aria-hidden="true">
          <FontAwesomeIcon icon={faTriangleExclamation} />
        </div>

        <h3 id="addleave-modal-title" className="catdel-modal-title catdel-modal-title--danger">
          Volver sin guardar
        </h3>

        <p className="catdel-modal-text">
          ¿Estás seguro de volver? <br />
          Si no guardás, vas a <strong>perder todos los cambios</strong>.
        </p>

        <div className="catdel-modal-buttons">
          <button className="catdel-btn catdel-btn--ghost" onClick={onCancel} autoFocus disabled={loading}>
            Cancelar
          </button>
          <button
            className="catdel-btn catdel-btn--solid-danger"
            onClick={onConfirm}
            disabled={loading}
            aria-busy={loading ? 'true' : 'false'}
          >
            {loading ? 'Volviendo…' : 'Volver sin guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

const AgregarSocio = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);

  const [listas, setListas] = useState({
    categorias: [],
    cobradores: [],
    estados: [],
    categorias_monto: [],
    loaded: false
  });

  // Próximo ID (último + 1)
  const [nextId, setNextId] = useState(null);

  const initialForm = useMemo(() => ({
    apellido: '',
    nombres: '',
    id_cobrador: '',
    id_categoria: '',   // ← “Tipo de sangre”
    id_cat_monto: '',
    domicilio: '',
    numero: '',
    telefono_movil: '',
    telefono_fijo: '',
    comentario: '',
    nacimiento: '',
    id_estado: '',
    domicilio_cobro: '',
    dni: ''
  }), []);

  const [formData, setFormData] = useState(initialForm);

  const [errores, setErrores] = useState({});
  const [mostrarErrores, setMostrarErrores] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'exito' });
  const [loading, setLoading] = useState(false);
  const [activeField, setActiveField] = useState(null);
  const nacimientoRef = useRef(null);

  // ===== Baseline para detectar cambios reales (ignora autocompletados iniciales) =====
  const baselineRef = useRef(initialForm);

  // ===== Modal de confirmación de salida =====
  const [showConfirmLeave, setShowConfirmLeave] = useState(false);

  // Determina si hay cambios sin guardar comparando vs baseline
  const isDirty = useMemo(() => {
    const base = baselineRef.current || {};
    for (const [k, v] of Object.entries(formData)) {
      const a = String(v ?? '').trim();
      const b = String(base[k] ?? '').trim();
      if (a !== b) return true;
    }
    return false;
  }, [formData]);

  /* Helpers */
  const openDateWithGesture = (ref) => (e) => {
    const el = ref.current;
    if (!el) return;
    e.preventDefault();
    el.focus({ preventScroll: true });
    if (typeof el.showPicker === 'function') { try { el.showPicker(); } catch {} } else { el.click(); }
  };
  const showToast = (message, type = 'exito') => setToast({ show: true, message, type });

  /* Cargar listas */
  useEffect(() => {
    const fetchListas = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${BASE_URL}/api.php?action=listas`);
        const json = await res.json();
        if (json.exito) {
          const listasCargadas = { ...json.listas, loaded: true };

          // Autoselect de categoría/monto si viene solo una
          let nextForm = null;
          if (Array.isArray(listasCargadas.categorias_monto) && listasCargadas.categorias_monto.length === 1) {
            const unico = listasCargadas.categorias_monto[0];
            nextForm = (prev) => ({ ...prev, id_cat_monto: String(unico.id_cat_monto) });
            setFormData(nextForm);
          }

          setListas(listasCargadas);
        } else {
          showToast('Error al cargar listas: ' + (json.mensaje || 'Desconocido'), 'error');
        }
      } catch (err) {
        showToast('Error de conexión: ' + err.message, 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchListas();
  }, []);

  // Una vez que las listas quedan "loaded", fijamos el baseline al formulario actual
  useEffect(() => {
    if (listas.loaded) {
      baselineRef.current = { ...formData };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listas.loaded]);

  /* Próximo ID */
  const fetchNextId = async () => {
    try {
      const res = await fetch(`${BASE_URL}/api.php?action=next_id_socio`);
      const json = await res.json();
      if (json && json.exito) setNextId(json.next_id ?? null);
      else {
        setNextId(null);
        if (json && json.mensaje) showToast('No se pudo obtener el próximo ID: ' + json.mensaje, 'error');
      }
    } catch (err) {
      setNextId(null);
      showToast('Error obteniendo el próximo ID: ' + err.message, 'error');
    }
  };
  useEffect(() => { fetchNextId(); }, []);

  /* Validaciones */
  const regexNombre = /^[\p{L}\s]+$/u;
  const regexTextoLibre = /^[\p{L}\p{N}\s.,-]+$/u;
  const regexSoloNumeros = /^[0-9]+$/;
  const regexTel = /^[0-9\-]+$/;

  const validarCampo = (name, value) => {
    if (value === undefined || value === null) value = '';
    const val = String(value).trim();

    switch (name) {
      case 'apellido':
        if (!val) return 'El apellido es obligatorio.';
        if (!regexNombre.test(val)) return 'Solo se permiten letras (incluye acentos) y espacios.';
        if (val.length > 100) return 'Máximo 100 caracteres.';
        break;
      case 'nombres':
        if (!val) return 'El nombre es obligatorio.';
        if (!regexNombre.test(val)) return 'Solo se permiten letras (incluye acentos) y espacios.';
        if (val.length > 100) return 'Máximo 100 caracteres.';
        break;
      case 'domicilio':
        if (!val) return null;
        if (!regexTextoLibre.test(val)) return 'Domicilio inválido. Letras/números, espacios y . , -';
        if (val.length > 100) return 'Máximo 100 caracteres.';
        break;
      case 'domicilio_cobro':
        if (!val) return null;
        if (val.length > 150) return 'Máximo 150 caracteres.';
        break;
      case 'comentario':
        if (!val) return null;
        if (!regexTextoLibre.test(val)) return 'Comentario inválido. Letras/números, espacios y . , -';
        if (val.length > 1000) return 'Máximo 1000 caracteres.';
        break;
      case 'numero':
        if (!val) return null;
        if (!regexSoloNumeros.test(val)) return 'Solo números.';
        if (val.length > 20) return 'Máximo 20 caracteres.';
        break;
      case 'telefono_movil':
      case 'telefono_fijo':
        if (!val) return null;
        if (!regexTel.test(val)) return 'Solo números y guiones.';
        if (val.length > 20) return 'Máximo 20 caracteres.';
        break;
      case 'dni':
        if (!val) return null;
        if (!regexSoloNumeros.test(val)) return 'Solo números.';
        if (val.length > 20) return 'Máximo 20 caracteres.';
        break;
      case 'id_categoria':
      case 'id_estado':
      case 'id_cobrador':
      case 'id_cat_monto':
        if (!val) return null;
        if (!/^\d+$/.test(val)) return 'Valor inválido.';
        break;
      case 'nacimiento':
        if (!val) return null;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) return 'Fecha inválida (YYYY-MM-DD).';
        break;
      default:
        return null;
    }
    return null;
  };

  const validarTodo = (data) => {
    const nuevos = {};
    for (const k of Object.keys(data)) {
      const err = validarCampo(k, data[k]);
      if (err) nuevos[k] = err;
    }
    if (!data.apellido?.trim()) nuevos.apellido = 'El apellido es obligatorio.';
    if (!data.nombres?.trim())  nuevos.nombres  = 'El nombre es obligatorio.';
    return nuevos;
  };

  /* Handlers */
  const handleNumberChange = (e) => {
    const { name, value } = e.target;
    const numericValue = value.replace(/[^0-9-]/g, '');
    setFormData(prev => ({ ...prev, [name]: numericValue }));
    setErrores(prev => ({ ...prev, [name]: validarCampo(name, numericValue) || undefined }));
  };
  const handleChange = (e) => {
    const { name, value } = e.target;
    let nuevoValor = value;
    if (name === 'apellido' || name === 'nombres') nuevoValor = value.replace(/\s+/g, ' ');
    const valor = typeof nuevoValor === 'string' ? nuevoValor.toUpperCase() : nuevoValor;
    setFormData(prev => ({ ...prev, [name]: valor }));
    setErrores(prev => ({ ...prev, [name]: validarCampo(name, valor) || undefined }));
  };
  const handleFocus = (f) => setActiveField(f);
  const handleBlur = () => setActiveField(null);

  const handleNextStep = () => {
    const errApe = validarCampo('apellido', formData.apellido);
    const errNom = validarCampo('nombres', formData.nombres);
    if (errApe || errNom) {
      setErrores(prev => ({ ...prev, apellido: errApe, nombres: errNom }));
      setMostrarErrores(true);
      showToast(errApe || errNom || 'Corregí los errores.', 'error');
      return;
    }
    setCurrentStep((p) => Math.min(p + 1, 3));
    setMostrarErrores(false);
  };

  const handlePrevStep = () => { setCurrentStep((p) => Math.max(p - 1, 1)); setMostrarErrores(false); };

  const flattenErrores = (errObj) => {
    if (!errObj || typeof errObj !== 'object') return '';
    const labelMap = {
      apellido: 'Apellido',
      nombres: 'Nombre',
      domicilio: 'Domicilio',
      numero: 'Número',
      telefono_movil: 'Teléfono móvil',
      telefono_fijo: 'Teléfono fijo',
      comentario: 'Comentarios',
      nacimiento: 'Fecha nacimiento',
      id_estado: 'Estado',
      id_categoria: 'Tipo de sangre',
      id_cat_monto: 'Categoría (Monto)',
      id_cobrador: 'Método de pago',
      domicilio_cobro: 'Domicilio de cobro',
      dni: 'DNI',
      general: 'General'
    };
    return Object.entries(errObj)
      .filter(([, msg]) => !!msg)
      .map(([campo, msg]) => `• ${labelMap[campo] || campo}: ${msg}`)
      .join('\n');
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const nuevos = validarTodo(formData);
    if (Object.keys(nuevos).length > 0) {
      setErrores(nuevos); setMostrarErrores(true);
      showToast(flattenErrores(nuevos) || 'Por favor corrige los errores.', 'error');
      return;
    }

    try {
      setLoading(true);
      const payload = { ...formData };
      const res = await fetch(`${BASE_URL}/api.php?action=agregar_socio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.exito) {
        showToast('Socio agregado correctamente', 'exito');
        await fetchNextId();
        setTimeout(() => navigate('/socios'), 1200);
      } else {
        let errs = {};
        if (data.errores && typeof data.errores === 'object') {
          errs = { ...data.errores };
          if (Object.prototype.hasOwnProperty.call(errs, 'nombre')) {
            delete errs.nombre;
            if (!errs.apellido) errs.apellido = 'El apellido es obligatorio.';
            if (!errs.nombres)  errs.nombres  = 'El nombre es obligatorio.';
          }
        }
        if (Object.keys(errs).length) {
          setErrores(errs); setMostrarErrores(true);
          showToast(flattenErrores(errs) || 'Error de validación.', 'error');
        } else {
          showToast('Error: ' + (data.mensaje || 'Desconocido'), 'error');
        }
      }
    } catch {
      showToast('Error de conexión con el servidor', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFormKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); if (currentStep < 3) handleNextStep(); }
  };

  // ===== Volver con confirmación si hay cambios =====
  const handleVolverClick = () => {
    if (isDirty) {
      setShowConfirmLeave(true);
    } else {
      navigate('/socios');
    }
  };

  const confirmLeave = () => {
    setShowConfirmLeave(false);
    navigate('/socios');
  };

  const cancelLeave = () => setShowConfirmLeave(false);

  // Cerrar modal con ESC (redundante pero ok)
  useEffect(() => {
    const onKey = (e) => {
      if (!showConfirmLeave) return;
      if (e.key === 'Escape' || e.key === 'Esc' || e.keyCode === 27) {
        e.preventDefault();
        cancelLeave();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showConfirmLeave]);

  /* UI */
  const ProgressSteps = () => (
    <div className="progress-steps">
      {[1,2,3].map((step) => (
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
      <div className="progress-bar"><div className="progress-bar-fill" style={{ width: `${((currentStep - 1) / 2) * 100}%` }} /></div>
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
            duracion={1800}
          />
        )}

        {/* Header */}
        <div className="add-header">
          <div className="add-icon-title">
            <FontAwesomeIcon icon={faUserPlus} className="add-icon" />
            <div>
              <h1>Agregar Nuevo Socio</h1>
              <p>Complete los datos del nuevo socio</p>
            </div>

            {/* ID */}
            <div className="add-id-inline" title="ID que se asignará al guardar" role="status" aria-label="Próximo ID">
              <span className="add-id-label">ID</span>
              <span className="add-id-value">{nextId ?? '—'}</span>
            </div>
          </div>

          <button className="add-back-btn" onClick={handleVolverClick} disabled={loading}>
            <FontAwesomeIcon icon={faArrowLeft} /> Volver
          </button>
        </div>

        <ProgressSteps />

        {/* FORM */}
        <form onSubmit={(e) => e.preventDefault()} onKeyDown={handleFormKeyDown} className="add-socio-form">
          {/* Paso 1 */}
          {currentStep === 1 && (
            <div className="add-socio-section">
              <h3 className="add-socio-section-title">Información Básica</h3>
              <div className="add-socio-section-content">
                <div className="add-socio-group-row">
                  {/* Apellido */}
                  <div className={`add-socio-input-wrapper ${formData.apellido || activeField === 'apellido' ? 'has-value' : ''}`}>
                    <label className="add-socio-label"><FontAwesomeIcon icon={faUser} className="input-icon" />Apellido</label>
                    <input name="apellido" value={formData.apellido || ''} onChange={handleChange} onFocus={() => handleFocus('apellido')} onBlur={handleBlur} className="add-socio-input" />
                    <span className="add-socio-input-highlight"></span>
                    {mostrarErrores && errores.apellido && <span className="add-socio-error">{errores.apellido}</span>}
                  </div>
                  {/* Nombre */}
                  <div className={`add-socio-input-wrapper ${formData.nombres || activeField === 'nombres' ? 'has-value' : ''}`}>
                    <label className="add-socio-label"><FontAwesomeIcon icon={faUser} className="input-icon" />Nombre</label>
                    <input name="nombres" value={formData.nombres || ''} onChange={handleChange} onFocus={() => handleFocus('nombres')} onBlur={handleBlur} className="add-socio-input" />
                    <span className="add-socio-input-highlight"></span>
                    {mostrarErrores && errores.nombres && <span className="add-socio-error">{errores.nombres}</span>}
                  </div>
                </div>

                <div className="add-socio-group-row">
                  {/* DNI */}
                  <div className={`add-socio-input-wrapper ${formData.dni || activeField === 'dni' ? 'has-value' : ''}`}>
                    <label className="add-socio-label"><FontAwesomeIcon icon={faIdCard} className="input-icon" />DNI</label>
                    <input name="dni" value={formData.dni || ''} onChange={handleNumberChange} onFocus={() => handleFocus('dni')} onBlur={handleBlur} className="add-socio-input" inputMode="numeric" />
                    <span className="add-socio-input-highlight"></span>
                    {mostrarErrores && errores.dni && <span className="add-socio-error">{errores.dni}</span>}
                  </div>

                  {/* Fecha nacimiento */}
                  <div className="add-socio-input-wrapper always-active" onMouseDown={openDateWithGesture(nacimientoRef)} onTouchStart={openDateWithGesture(nacimientoRef)}>
                    <label htmlFor="nacimiento" className="add-socio-label"><FontAwesomeIcon icon={faCalendarDays} className="input-icon" />Fecha Nacimiento</label>
                    <input id="nacimiento" ref={nacimientoRef} type="date" name="nacimiento" value={formData.nacimiento || ''} onChange={handleChange} onFocus={() => handleFocus('nacimiento')} onBlur={handleBlur} className="add-socio-input" />
                    <span className="add-socio-input-highlight"></span>
                  </div>
                </div>

                <div className="add-socio-group-row">
                  {/* Tipo de sangre */}
                  <div className={`add-socio-input-wrapper always-active ${formData.id_categoria || activeField === 'id_categoria' ? 'has-value' : ''}`}>
                    <label className="add-socio-label">
                      <FontAwesomeIcon icon={faDroplet} className="input-icon" />
                      Tipo de sangre
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
                      <option value="" disabled hidden>Seleccione tipo de sangre</option>
                      {listas.categorias.map(c => (
                        <option key={c.id} value={c.id}>{c.descripcion}</option>
                      ))}
                    </select>
                    <span className="add-socio-input-highlight"></span>
                    {mostrarErrores && errores.id_categoria && <span className="add-socio-error">{errores.id_categoria}</span>}
                  </div>

                  {/* Categoría Monto */}
                  <div className={`add-socio-input-wrapper always-active ${formData.id_cat_monto || activeField === 'id_cat_monto' ? 'has-value' : ''}`}>
                    <label className="add-socio-label"><FontAwesomeIcon icon={faTags} className="input-icon" />Categoría (Cuota)</label>
                    <select
                      name="id_cat_monto"
                      value={formData.id_cat_monto || ''}
                      onChange={handleChange}
                      onFocus={() => handleFocus('id_cat_monto')}
                      onBlur={handleBlur}
                      className="add-socio-input"
                      disabled={loading || !listas.loaded}
                    >
                      {(!listas.categorias_monto || listas.categorias_monto.length !== 1) && (
                        <option value="" disabled hidden>Seleccione categoría/monto</option>
                      )}
                      {listas.categorias_monto.map(cm => (
                        <option key={cm.id_cat_monto} value={String(cm.id_cat_monto)}>
                          {cm.nombre_categoria} — ${cm.monto_mensual} / anual ${cm.monto_anual}
                        </option>
                      ))}
                    </select>
                    <span className="add-socio-input-highlight"></span>
                    {mostrarErrores && errores.id_cat_monto && <span className="add-socio-error">{errores.id_cat_monto}</span>}
                  </div>
                </div>

                {/* Estado */}
                <div className="add-socio-group-row">
                  <div className={`add-socio-input-wrapper always-active ${formData.id_estado || activeField === 'id_estado' ? 'has-value' : ''}`}>
                    <label className="add-socio-label"><FontAwesomeIcon icon={faCircleInfo} className="input-icon" />Estado</label>
                    <select name="id_estado" value={formData.id_estado || ''} onChange={handleChange} onFocus={() => handleFocus('id_estado')} onBlur={handleBlur} className="add-socio-input" disabled={loading || !listas.loaded}>
                      <option value="" disabled hidden>Seleccione estado</option>
                      {listas.estados.map(e => (<option key={e.id} value={e.id}>{e.descripcion}</option>))}
                    </select>
                    <span className="add-socio-input-highlight"></span>
                    {mostrarErrores && errores.id_estado && <span className="add-socio-error">{errores.id_estado}</span>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Paso 2 */}
          {currentStep === 2 && (
            <div className="add-socio-section">
              <h3 className="add-socio-section-title">Contacto y Cobro</h3>
              <div className="add-socio-section-content">
                <div className="add-socio-domicilio-group">
                  <div className={`add-socio-input-wrapper ${formData.domicilio || activeField === 'domicilio' ? 'has-value' : ''}`}>
                    <label className="add-socio-label"><FontAwesomeIcon icon={faHome} className="input-icon" />Domicilio</label>
                    <input name="domicilio" value={formData.domicilio || ''} onChange={handleChange} onFocus={() => handleFocus('domicilio')} onBlur={handleBlur} className="add-socio-input" />
                    <span className="add-socio-input-highlight"></span>
                    {mostrarErrores && errores.domicilio && <span className="add-socio-error">{errores.domicilio}</span>}
                  </div>
                  <div className={`add-socio-input-wrapper ${formData.numero || activeField === 'numero' ? 'has-value' : ''}`}>
                    <label className="add-socio-label"><FontAwesomeIcon icon={faHashtag} className="input-icon" />Número</label>
                    <input name="numero" value={formData.numero || ''} onChange={handleNumberChange} onFocus={() => handleFocus('numero')} onBlur={handleBlur} className="add-socio-input" inputMode="numeric" />
                    <span className="add-socio-input-highlight"></span>
                    {mostrarErrores && errores.numero && <span className="add-socio-error">{errores.numero}</span>}
                  </div>
                </div>

                <div className={`add-socio-input-wrapper ${formData.domicilio_cobro || activeField === 'domicilio_cobro' ? 'has-value' : ''}`}>
                  <label className="add-socio-label"><FontAwesomeIcon icon={faMapMarkerAlt} className="input-icon" />Domicilio de Cobro</label>
                  <input name="domicilio_cobro" value={formData.domicilio_cobro || ''} onChange={handleChange} onFocus={() => handleFocus('domicilio_cobro')} onBlur={handleBlur} className="add-socio-input" />
                  <span className="add-socio-input-highlight"></span>
                  {mostrarErrores && errores.domicilio_cobro && <span className="add-socio-error">{errores.domicilio_cobro}</span>}
                </div>

                <div className="add-socio-group-row">
                  <div className={`add-socio-input-wrapper ${formData.telefono_movil || activeField === 'telefono_movil' ? 'has-value' : ''}`}>
                    <label className="add-socio-label"><FontAwesomeIcon icon={faMobileScreen} className="input-icon" />Teléfono Móvil</label>
                    <input name="telefono_movil" value={formData.telefono_movil || ''} onChange={handleNumberChange} onFocus={() => handleFocus('telefono_movil')} onBlur={handleBlur} className="add-socio-input" inputMode="tel" />
                    <span className="add-socio-input-highlight"></span>
                    {mostrarErrores && errores.telefono_movil && <span className="add-socio-error">{errores.telefono_movil}</span>}
                  </div>

                  <div className={`add-socio-input-wrapper ${formData.telefono_fijo || activeField === 'telefono_fijo' ? 'has-value' : ''}`}>
                    <label className="add-socio-label"><FontAwesomeIcon icon={faPhone} className="input-icon" />Teléfono Fijo</label>
                    <input name="telefono_fijo" value={formData.telefono_fijo || ''} onChange={handleNumberChange} onFocus={() => handleFocus('telefono_fijo')} onBlur={handleBlur} className="add-socio-input" inputMode="tel" />
                    <span className="add-socio-input-highlight"></span>
                    {mostrarErrores && errores.telefono_fijo && <span className="add-socio-error">{errores.telefono_fijo}</span>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Paso 3 */}
          {currentStep === 3 && (
            <div className="add-socio-section">
              <h3 className="add-socio-section-title">Cobro y Comentarios</h3>
              <div className="add-socio-section-content">
                <div className={`add-socio-input-wrapper always-active ${formData.id_cobrador || activeField === 'id_cobrador' ? 'has-value' : ''}`}>
                  <label className="add-socio-label"><FontAwesomeIcon icon={faMoneyBillWave} className="input-icon" />Métodos de Pago</label>
                  <select name="id_cobrador" value={formData.id_cobrador || ''} onChange={handleChange} onFocus={() => handleFocus('id_cobrador')} onBlur={handleBlur} className="add-socio-input" disabled={loading || !listas.loaded}>
                    <option value="" disabled hidden>Seleccione método</option>
                    {listas.cobradores.map(c => (<option key={c.id} value={c.id}>{c.nombre}</option>))}
                  </select>
                  <span className="add-socio-input-highlight"></span>
                  {mostrarErrores && errores.id_cobrador && <span className="add-socio-error">{errores.id_cobrador}</span>}
                </div>

                <div className={`add-socio-input-wrapper ${formData.comentario || activeField === 'comentario' ? 'has-value' : ''}`}>
                  <label className="add-socio-label"><FontAwesomeIcon icon={faComment} className="input-icon" />Comentarios</label>
                  <textarea name="comentario" value={formData.comentario || ''} onChange={handleChange} onFocus={() => handleFocus('comentario')} onBlur={handleBlur} className="add-socio-textarea" rows="4" />
                  <span className="add-socio-input-highlight"></span>
                  {mostrarErrores && errores.comentario && <span className="add-socio-error">{errores.comentario}</span>}
                </div>
              </div>
            </div>
          )}
        </form>

        {/* Botonera */}
        <div className="add-socio-buttons-container">
          {currentStep > 1 && (
            <button type="button" className="add-socio-button prev-step" onClick={handlePrevStep} disabled={loading}>
              <FontAwesomeIcon icon={faStepBack} className="add-socio-icon-button" />
              <span className="add-socio-button-text">Anterior</span>
            </button>
          )}

          {currentStep < 3 ? (
            <button type="button" className="add-socio-button next-step" onClick={handleNextStep} disabled={loading}>
              <span className="add-socio-button-text">Siguiente</span>
              <FontAwesomeIcon icon={faArrowRight} className="add-socio-icon-button" />
            </button>
          ) : (
            <button type="button" className="add-socio-button" onClick={handleSubmit} disabled={loading}>
              <FontAwesomeIcon icon={faSave} className="add-socio-icon-button" />
              <span className="add-socio-button-text">{loading ? 'Guardando...' : 'Guardar Socio'}</span>
            </button>
          )}
        </div>
      </div>

      {/* ===== Modal Confirmación de Volver sin guardar (catdel-*) ===== */}
      <ConfirmLeaveModal
        open={showConfirmLeave}
        onConfirm={confirmLeave}
        onCancel={cancelLeave}
        loading={false}
      />
    </div>
  );
};

export default AgregarSocio;
