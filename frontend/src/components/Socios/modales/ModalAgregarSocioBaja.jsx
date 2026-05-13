import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import BASE_URL from '../../../config/config';
import Toast from '../../Global/Toast';
import './ModalAgregarSocioBaja.css';

const TZ = 'America/Argentina/Cordoba';
const hoyISO = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

const normalizarListas = (listas = {}) => ({
  categorias: Array.isArray(listas.categorias) ? listas.categorias : [],
  cobradores: Array.isArray(listas.cobradores) ? listas.cobradores : [],
  estados: Array.isArray(listas.estados) ? listas.estados : [],
  categorias_monto: Array.isArray(listas.categorias_monto) ? listas.categorias_monto : [],
  loaded: true,
});

/* ===== Modal Confirmar “Cerrar sin guardar” ===== */
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
      className="modal-baja-confirm-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-baja-confirm-title"
      onClick={onCancel}
    >
      <div
        className="modal-baja-confirm-container modal-baja-confirm--danger"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-baja-confirm__icon" aria-hidden="true">
          <FontAwesomeIcon icon={faTriangleExclamation} />
        </div>

        <h3 id="modal-baja-confirm-title" className="modal-baja-confirm-title modal-baja-confirm-title--danger">
          Cerrar sin guardar
        </h3>

        <p className="modal-baja-confirm-text">
          ¿Estás seguro de cerrar? <br />
          Si no guardás, vas a <strong>perder todos los cambios</strong>.
        </p>

        <div className="modal-baja-confirm-buttons">
          <button className="modal-baja-confirm-btn modal-baja-confirm-btn--ghost" onClick={onCancel} autoFocus disabled={loading}>
            Cancelar
          </button>
          <button
            className="modal-baja-confirm-btn modal-baja-confirm-btn--solid-danger"
            onClick={onConfirm}
            disabled={loading}
            aria-busy={loading ? 'true' : 'false'}
          >
            {loading ? 'Cerrando…' : 'Cerrar sin guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

const ModalAgregarSocioBaja = ({ onClose, onGuardado }) => {
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
    dni: '',

    // Campos internos para que el backend lo cargue dado de baja sin pedirlos en pantalla
    activo: 0,
    fecha_baja: hoyISO(),
    motivo: '',
  }), []);

  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState(initialForm);

  const [listas, setListas] = useState({
    categorias: [],
    cobradores: [],
    estados: [],
    categorias_monto: [],
    loaded: false,
  });

  // Próximo ID (último + 1)
  const [nextId, setNextId] = useState(null);

  const [errores, setErrores] = useState({});
  const [mostrarErrores, setMostrarErrores] = useState(false);

  // 👉 Toast SIEMPRE 3s
  const [toast, setToast] = useState({ show: false, message: '', type: 'exito', duration: 3000 });
  const showToast = (message, type = 'exito', duration = 3000) =>
    setToast({ show: true, message, type, duration: 3000 });

  const [loading, setLoading] = useState(false);
  const [activeField, setActiveField] = useState(null);
  const nacimientoRef = useRef(null);

  // ===== Baseline para detectar cambios reales (ignora autocompletados iniciales) =====
  const baselineRef = useRef(initialForm);
  const baselineSetRef = useRef(false);
  const userInteractedRef = useRef(false);

  // ===== Modal de confirmación de salida =====
  const [showConfirmLeave, setShowConfirmLeave] = useState(false);

  const camposVisibles = useMemo(() => ([
    'apellido',
    'nombres',
    'id_cobrador',
    'id_categoria',
    'id_cat_monto',
    'domicilio',
    'numero',
    'telefono_movil',
    'telefono_fijo',
    'comentario',
    'nacimiento',
    'id_estado',
    'domicilio_cobro',
    'dni',
  ]), []);

  // Determina si hay cambios sin guardar comparando solo campos visibles vs baseline
  const isDirty = useMemo(() => {
    const base = baselineRef.current || {};
    for (const k of camposVisibles) {
      const a = String(formData[k] ?? '').trim();
      const b = String(base[k] ?? '').trim();
      if (a !== b) return true;
    }
    return false;
  }, [formData, camposVisibles]);

  /* Helpers */
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

  /* Cargar listas */
  useEffect(() => {
    const fetchListas = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${BASE_URL}/api.php?action=listas&ts=${Date.now()}`);
        const json = await res.json();
        if (json.exito) {
          const listasCargadas = normalizarListas(json.listas);

          // Autoselect de categoría/monto si viene solo una (esto es default, NO cuenta como interacción)
          if (Array.isArray(listasCargadas.categorias_monto) && listasCargadas.categorias_monto.length === 1) {
            const unico = listasCargadas.categorias_monto[0];
            setFormData(prev => ({ ...prev, id_cat_monto: String(unico.id_cat_monto) }));
          }

          setListas(listasCargadas);
        } else {
          showToast('Error al cargar listas', 'error');
        }
      } catch (err) {
        showToast('Error de conexión: ' + err.message, 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchListas();

    baselineRef.current = { ...initialForm };
    baselineSetRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Una vez que las listas quedan loaded, fijamos el baseline al formulario ACTUAL
  // pero solo si el usuario todavía NO interactuó.
  useEffect(() => {
    if (listas.loaded && !baselineSetRef.current && !userInteractedRef.current) {
      baselineRef.current = { ...formData };
      baselineSetRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listas.loaded, formData]);

  /* Próximo ID */
  const fetchNextId = async () => {
    try {
      const res = await fetch(`${BASE_URL}/api.php?action=next_id_socio&ts=${Date.now()}`);
      const json = await res.json();
      if (json && json.exito) setNextId(json.next_id ?? null);
      else {
        setNextId(null);
        if (json && json.mensaje) showToast('No se pudo obtener el próximo ID', 'error');
      }
    } catch (err) {
      setNextId(null);
      showToast('Error obteniendo el próximo ID: ' + err.message, 'error');
    }
  };
  useEffect(() => { fetchNextId(); }, []);

  /* Validaciones base — iguales a AgregarSocio */
  const regexNombre = /^[\p{L}\s]+$/u;
  const regexTextoLibre = /^[\p{L}\p{N}\s.,-]+$/u;
  const regexSoloNumeros = /^[0-9]+$/;
  const regexTel = /^[0-9\-]+$/;

  const validarCampo = (name, value) => {
    if (value === undefined || value === null) value = '';
    const val = String(value).trim();

    switch (name) {
      case 'apellido':
        if (!val) return 'obligatorio';
        if (!regexNombre.test(val)) return 'Solo letras y espacios';
        if (val.length > 100) return 'Máximo 100 caracteres';
        break;
      case 'nombres':
        if (!val) return 'obligatorio';
        if (!regexNombre.test(val)) return 'Solo letras y espacios';
        if (val.length > 100) return 'Máximo 100 caracteres';
        break;
      case 'domicilio':
        if (!val) return null;
        if (!regexTextoLibre.test(val)) return 'Domicilio inválido';
        if (val.length > 100) return 'Máximo 100 caracteres';
        break;
      case 'domicilio_cobro':
        if (!val) return null;
        if (val.length > 150) return 'Máximo 150 caracteres';
        break;
      case 'comentario':
        if (!val) return null;
        if (!regexTextoLibre.test(val)) return 'Comentario inválido';
        if (val.length > 1000) return 'Máximo 1000 caracteres';
        break;
      case 'numero':
        if (!val) return null;
        if (!regexSoloNumeros.test(val)) return 'Solo números';
        if (val.length > 20) return 'Máximo 20 caracteres';
        break;
      case 'telefono_movil':
      case 'telefono_fijo':
        if (!val) return null;
        if (!regexTel.test(val)) return 'Solo números y guiones';
        if (val.length > 20) return 'Máximo 20 caracteres';
        break;
      case 'dni':
        if (!val) return null;
        if (!regexSoloNumeros.test(val)) return 'Solo números';
        if (val.length > 20) return 'Máximo 20 caracteres';
        break;
      case 'id_categoria':
      case 'id_estado':
      case 'id_cobrador':
      case 'id_cat_monto':
        if (!val) return null;
        if (!/^\d+$/.test(val)) return 'Valor inválido';
        break;
      case 'nacimiento':
        if (!val) return null;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) return 'Fecha inválida';
        break;
      default:
        return null;
    }
    return null;
  };

  /* Reglas de obligatoriedad por paso — iguales a AgregarSocio */
  const LABELS = {
    apellido: 'Apellido',
    nombres: 'Nombre',
    dni: 'DNI',
    nacimiento: 'Fecha de nacimiento',
    id_categoria: 'Tipo de sangre',
    id_cat_monto: 'Categoría (Cuota)',
    id_estado: 'Estado',
    domicilio: 'Domicilio',
    numero: 'Número',
    id_cobrador: 'Método de pago',
  };

  const requeridosPaso1 = ['apellido', 'nombres', 'dni', 'nacimiento', 'id_categoria', 'id_cat_monto', 'id_estado'];
  const requeridosPaso2 = ['domicilio', 'numero'];
  const requeridoPaso3  = ['id_cobrador'];

  const buildRequiredErrors = (fields, data) => {
    const errs = {};
    for (const f of fields) {
      const v = (data[f] ?? '').toString().trim();
      if (!v) errs[f] = 'obligatorio';
      else {
        const e = validarCampo(f, v);
        if (e) errs[f] = e;
      }
    }
    return errs;
  };

  // ==== Formateo de mensajes de error (simple, sin viñetas/puntos) ====
  const formatRequiredMessage = (errs) => {
    const keys = Object.keys(errs).filter(k => errs[k] === 'obligatorio');
    if (keys.length === 2 && keys.includes('domicilio') && keys.includes('numero')) {
      return 'Domicilio y Número son obligatorios';
    }
    if (keys.length === 1 && keys[0] === 'id_cobrador') {
      return 'Método de pago es obligatorio';
    }
    if (keys.length === 1) {
      return `${LABELS[keys[0]]} es obligatorio`;
    }
    if (keys.length > 1) {
      return 'Completá los campos obligatorios';
    }
    const otherErr = Object.entries(errs).find(([, msg]) => msg && msg !== 'obligatorio');
    if (otherErr) {
      const [k] = otherErr;
      if (k === 'dni') return 'DNI inválido';
      if (k === 'nacimiento') return 'Fecha inválida';
      return `${LABELS[k]} inválido`;
    }
    return 'Revisá los campos';
  };

  const mergeAndShowErrors = (extraErrs = {}) => {
    const merged = { ...errores, ...extraErrs };
    setErrores(merged);
    setMostrarErrores(true);
    const msg = formatRequiredMessage(merged);
    showToast(msg, 'error', 3000);
  };

  const validarTodo = (data) => ({
    ...buildRequiredErrors(requeridosPaso1, data),
    ...buildRequiredErrors(requeridosPaso2, data),
    ...buildRequiredErrors(requeridoPaso3, data),
  });

  /* Handlers de cambios */
  const handleNumberChange = (e) => {
    userInteractedRef.current = true;
    const { name, value } = e.target;
    const numericValue = value.replace(/[^0-9-]/g, '');
    setFormData(prev => ({ ...prev, [name]: numericValue }));
    setErrores(prev => ({ ...prev, [name]: validarCampo(name, numericValue) || undefined }));
  };

  const handleChange = (e) => {
    userInteractedRef.current = true;
    const { name, value } = e.target;
    let nuevoValor = value;
    if (name === 'apellido' || name === 'nombres') nuevoValor = value.replace(/\s+/g, ' ');
    const valor = typeof nuevoValor === 'string' ? nuevoValor.toUpperCase() : nuevoValor;
    setFormData(prev => ({ ...prev, [name]: valor }));
    setErrores(prev => ({ ...prev, [name]: validarCampo(name, valor) || undefined }));
  };

  const handleFocus = (f) => setActiveField(f);
  const handleBlur = () => setActiveField(null);

  /* Navegación entre pasos con validación requerida */
  const handleNextStep = () => {
    let errs = {};
    if (currentStep === 1) {
      errs = buildRequiredErrors(requeridosPaso1, formData);
      if (Object.keys(errs).length > 0) {
        setErrores(prev => ({ ...prev, ...errs }));
        setMostrarErrores(true);
        showToast('Completá los campos obligatorios', 'error', 3000);
        return;
      }
    } else if (currentStep === 2) {
      errs = buildRequiredErrors(requeridosPaso2, formData);
      if (Object.keys(errs).length > 0) {
        mergeAndShowErrors(errs);
        return;
      }
    }

    setCurrentStep((p) => Math.min(p + 1, 3));
    setMostrarErrores(false);
  };

  const handlePrevStep = () => {
    setCurrentStep((p) => Math.max(p - 1, 1));
    setMostrarErrores(false);
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();

    const errs = validarTodo(formData);
    if (Object.keys(errs).length > 0) {
      const tieneErrPaso1 = requeridosPaso1.some(k => errs[k]);
      if (tieneErrPaso1) {
        setErrores(prev => ({ ...prev, ...errs }));
        setMostrarErrores(true);
        showToast('Completá los campos obligatorios', 'error', 3000);
        return;
      }
      mergeAndShowErrors(errs);
      return;
    }

    try {
      setLoading(true);
      const payload = {
        ...formData,
        activo: 0,
        fecha_baja: formData.fecha_baja || hoyISO(),
        motivo: formData.motivo || '',
      };

      const res = await fetch(`${BASE_URL}/api.php?action=agregar_socio_baja&ts=${Date.now()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.exito) {
        showToast('Socio agregado como dado de baja correctamente', 'exito', 3000);
        await fetchNextId();
        setTimeout(() => onGuardado?.(data), 900);
      } else {
        let errsResp = {};
        if (data.errores && typeof data.errores === 'object') {
          errsResp = { ...data.errores };
          if (Object.prototype.hasOwnProperty.call(errsResp, 'nombre')) {
            delete errsResp.nombre;
            if (!errsResp.apellido) errsResp.apellido = 'obligatorio';
            if (!errsResp.nombres)  errsResp.nombres  = 'obligatorio';
          }
        }

        if (Object.keys(errsResp).length) {
          Object.keys(errsResp).forEach(k => {
            if (typeof errsResp[k] === 'string' && errsResp[k].toLowerCase().includes('obligatorio')) {
              errsResp[k] = 'obligatorio';
            }
          });
          const tieneErrPaso1Resp = requeridosPaso1.some(k => errsResp[k]);
          if (tieneErrPaso1Resp) {
            setErrores(prev => ({ ...prev, ...errsResp }));
            setMostrarErrores(true);
            showToast('Completá los campos obligatorios', 'error', 3000);
          } else {
            mergeAndShowErrors(errsResp);
          }
        } else {
          showToast(data.mensaje || 'Error al guardar', 'error', 3000);
        }
      }
    } catch {
      showToast('Error de conexión con el servidor', 'error', 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleFormKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (currentStep < 3) handleNextStep();
    }
  };

  const requestClose = () => {
    if (!isDirty) {
      onClose?.();
      return;
    }
    setShowConfirmLeave(true);
  };

  const confirmLeave = () => {
    setShowConfirmLeave(false);
    onClose?.();
  };

  const cancelLeave = () => setShowConfirmLeave(false);

  useEffect(() => {
    const onKey = (e) => {
      if (showConfirmLeave) return;
      if (e.key === 'Escape' || e.key === 'Esc' || e.keyCode === 27) {
        e.preventDefault();
        requestClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showConfirmLeave, isDirty]);

  /* UI */
  const ProgressSteps = () => (
    <div className="modal-baja-progress-steps">
      {[1, 2, 3].map((step) => (
        <div
          key={step}
          className={`modal-baja-progress-step ${currentStep === step ? 'active' : ''} ${currentStep > step ? 'completed' : ''}`}
          onClick={() => currentStep > step && setCurrentStep(step)}
        >
          <div className="modal-baja-step-number">{step}</div>
          <div className="modal-baja-step-label">
            {step === 1 && 'Información'}
            {step === 2 && 'Contacto'}
            {step === 3 && 'Cobro'}
          </div>
        </div>
      ))}
      <div className="modal-baja-progress-bar">
        <div className="modal-baja-progress-bar-fill" style={{ width: `${((currentStep - 1) / 2) * 100}%` }} />
      </div>
    </div>
  );

  return (
    <div className="modal-baja-overlay" role="dialog" aria-modal="true" onMouseDown={requestClose}>
      <div className="modal-baja-shell" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-baja-panel">
        {toast.show && (
          <Toast
            tipo={toast.type}
            mensaje={toast.message}
            onClose={() => setToast(prev => ({ ...prev, show: false }))}
            duracion={toast.duration ?? 3000}
          />
        )}

        {/* Header */}
        <div className="modal-baja-header">
          <div className="modal-baja-icon-title">
            <FontAwesomeIcon icon={faUserPlus} className="modal-baja-add-icon" />
            <div>
              <h1>Agregar Socio Dado de Baja</h1>
              <p>Complete los datos del socio</p>
            </div>

            {/* ID */}
            <div className="modal-baja-id-inline" title="ID que se asignará al guardar" role="status" aria-label="Próximo ID">
              <span className="modal-baja-id-label">ID</span>
              <span className="modal-baja-id-value">{nextId ?? '—'}</span>
            </div>
          </div>

          <button className="modal-baja-back-btn" onClick={requestClose} disabled={loading} type="button">
            <FontAwesomeIcon icon={faXmark} /> Cerrar
          </button>
        </div>

        <ProgressSteps />

        {/* FORM */}
        <form onSubmit={(e) => e.preventDefault()} onKeyDown={handleFormKeyDown} className="modal-baja-form">
          {/* Paso 1 */}
          {currentStep === 1 && (
            <div className="modal-baja-section">
              <h3 className="modal-baja-section-title">Información Básica</h3>
              <div className="modal-baja-section-content">
                <div className="modal-baja-group-row">
                  {/* Apellido */}
                  <div className={`modal-baja-input-wrapper ${formData.apellido || activeField === 'apellido' ? 'has-value' : ''} ${mostrarErrores && errores.apellido ? 'has-error' : ''}`}>
                    <label className="modal-baja-label"><FontAwesomeIcon icon={faUser} className="modal-baja-input-icon" />Apellido</label>
                    <input name="apellido" value={formData.apellido || ''} onChange={handleChange} onFocus={() => handleFocus('apellido')} onBlur={handleBlur} className="modal-baja-input" />
                    <span className="modal-baja-input-highlight"></span>
                  </div>

                  {/* Nombre */}
                  <div className={`modal-baja-input-wrapper ${formData.nombres || activeField === 'nombres' ? 'has-value' : ''} ${mostrarErrores && errores.nombres ? 'has-error' : ''}`}>
                    <label className="modal-baja-label"><FontAwesomeIcon icon={faUser} className="modal-baja-input-icon" />Nombre</label>
                    <input name="nombres" value={formData.nombres || ''} onChange={handleChange} onFocus={() => handleFocus('nombres')} onBlur={handleBlur} className="modal-baja-input" />
                    <span className="modal-baja-input-highlight"></span>
                  </div>
                </div>

                <div className="modal-baja-group-row">
                  {/* DNI */}
                  <div className={`modal-baja-input-wrapper ${formData.dni || activeField === 'dni' ? 'has-value' : ''} ${mostrarErrores && errores.dni ? 'has-error' : ''}`}>
                    <label className="modal-baja-label"><FontAwesomeIcon icon={faIdCard} className="modal-baja-input-icon" />DNI</label>
                    <input name="dni" value={formData.dni || ''} onChange={handleNumberChange} onFocus={() => handleFocus('dni')} onBlur={handleBlur} className="modal-baja-input" inputMode="numeric" />
                    <span className="modal-baja-input-highlight"></span>
                  </div>

                  {/* Fecha nacimiento */}
                  <div className={`modal-baja-input-wrapper always-active ${mostrarErrores && errores.nacimiento ? 'has-error' : ''}`} onMouseDown={openDateWithGesture(nacimientoRef)} onTouchStart={openDateWithGesture(nacimientoRef)}>
                    <label htmlFor="modal-baja-nacimiento" className="modal-baja-label"><FontAwesomeIcon icon={faCalendarDays} className="modal-baja-input-icon" />Fecha Nacimiento</label>
                    <input id="modal-baja-nacimiento" ref={nacimientoRef} type="date" name="nacimiento" value={formData.nacimiento || ''} onChange={handleChange} onFocus={() => handleFocus('nacimiento')} onBlur={handleBlur} className="modal-baja-input" />
                    <span className="modal-baja-input-highlight"></span>
                  </div>
                </div>

                <div className="modal-baja-group-row">
                  {/* Tipo de sangre */}
                  <div className={`modal-baja-input-wrapper always-active ${formData.id_categoria || activeField === 'id_categoria' ? 'has-value' : ''} ${mostrarErrores && errores.id_categoria ? 'has-error' : ''}`}>
                    <label className="modal-baja-label">
                      <FontAwesomeIcon icon={faDroplet} className="modal-baja-input-icon" />
                      Tipo de sangre
                    </label>
                    <select
                      name="id_categoria"
                      value={formData.id_categoria || ''}
                      onChange={handleChange}
                      onFocus={() => handleFocus('id_categoria')}
                      onBlur={handleBlur}
                      className="modal-baja-input"
                      disabled={loading || !listas.loaded}
                    >
                      <option value="" disabled hidden>Seleccione tipo de sangre</option>
                      {listas.categorias.map(c => (
                        <option key={c.id} value={c.id}>{c.descripcion}</option>
                      ))}
                    </select>
                    <span className="modal-baja-input-highlight"></span>
                  </div>

                  {/* Categoría Monto */}
                  <div className={`modal-baja-input-wrapper always-active ${formData.id_cat_monto || activeField === 'id_cat_monto' ? 'has-value' : ''} ${mostrarErrores && errores.id_cat_monto ? 'has-error' : ''}`}>
                    <label className="modal-baja-label"><FontAwesomeIcon icon={faTags} className="modal-baja-input-icon" />Categoría (Cuota)</label>
                    <select
                      name="id_cat_monto"
                      value={formData.id_cat_monto || ''}
                      onChange={handleChange}
                      onFocus={() => handleFocus('id_cat_monto')}
                      onBlur={handleBlur}
                      className="modal-baja-input"
                      disabled={loading || !listas.loaded}
                    >
                      {(!listas.categorias_monto || listas.categorias_monto.length !== 1) && (
                        <option value="" disabled hidden>Seleccione categoría/monto</option>
                      )}
                      {listas.categorias_monto.map(cm => (
                        <option key={cm.id_cat_monto} value={String(cm.id_cat_monto)}>
                          {cm.nombre_categoria} ({`$${cm.monto_mensual}`})
                        </option>
                      ))}
                    </select>
                    <span className="modal-baja-input-highlight"></span>
                  </div>
                </div>

                {/* Estado */}
                <div className="modal-baja-group-row">
                  <div className={`modal-baja-input-wrapper always-active ${formData.id_estado || activeField === 'id_estado' ? 'has-value' : ''} ${mostrarErrores && errores.id_estado ? 'has-error' : ''}`}>
                    <label className="modal-baja-label"><FontAwesomeIcon icon={faCircleInfo} className="modal-baja-input-icon" />Estado</label>
                    <select name="id_estado" value={formData.id_estado || ''} onChange={handleChange} onFocus={() => handleFocus('id_estado')} onBlur={handleBlur} className="modal-baja-input" disabled={loading || !listas.loaded}>
                      <option value="" disabled hidden>Seleccione estado</option>
                      {listas.estados.map(e => (<option key={e.id} value={e.id}>{e.descripcion}</option>))}
                    </select>
                    <span className="modal-baja-input-highlight"></span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Paso 2 */}
          {currentStep === 2 && (
            <div className="modal-baja-section">
              <h3 className="modal-baja-section-title">Contacto y Cobro</h3>
              <div className="modal-baja-section-content">
                <div className="modal-baja-domicilio-group">
                  <div className={`modal-baja-input-wrapper ${formData.domicilio || activeField === 'domicilio' ? 'has-value' : ''} ${mostrarErrores && errores.domicilio ? 'has-error' : ''}`}>
                    <label className="modal-baja-label"><FontAwesomeIcon icon={faHome} className="modal-baja-input-icon" />Domicilio</label>
                    <input name="domicilio" value={formData.domicilio || ''} onChange={handleChange} onFocus={() => handleFocus('domicilio')} onBlur={handleBlur} className="modal-baja-input" />
                    <span className="modal-baja-input-highlight"></span>
                  </div>
                  <div className={`modal-baja-input-wrapper ${formData.numero || activeField === 'numero' ? 'has-value' : ''} ${mostrarErrores && errores.numero ? 'has-error' : ''}`}>
                    <label className="modal-baja-label"><FontAwesomeIcon icon={faHashtag} className="modal-baja-input-icon" />Número</label>
                    <input name="numero" value={formData.numero || ''} onChange={handleNumberChange} onFocus={() => handleFocus('numero')} onBlur={handleBlur} className="modal-baja-input" inputMode="numeric" />
                    <span className="modal-baja-input-highlight"></span>
                  </div>
                </div>

                <div className={`modal-baja-input-wrapper ${formData.domicilio_cobro || activeField === 'domicilio_cobro' ? 'has-value' : ''}`}>
                  <label className="modal-baja-label"><FontAwesomeIcon icon={faMapMarkerAlt} className="modal-baja-input-icon" />Domicilio de Cobro</label>
                  <input name="domicilio_cobro" value={formData.domicilio_cobro || ''} onChange={handleChange} onFocus={() => handleFocus('domicilio_cobro')} onBlur={handleBlur} className="modal-baja-input" />
                  <span className="modal-baja-input-highlight"></span>
                </div>

                <div className="modal-baja-group-row">
                  <div className={`modal-baja-input-wrapper ${formData.telefono_movil || activeField === 'telefono_movil' ? 'has-value' : ''}`}>
                    <label className="modal-baja-label"><FontAwesomeIcon icon={faMobileScreen} className="modal-baja-input-icon" />Teléfono Móvil</label>
                    <input name="telefono_movil" value={formData.telefono_movil || ''} onChange={handleNumberChange} onFocus={() => handleFocus('telefono_movil')} onBlur={handleBlur} className="modal-baja-input" inputMode="tel" />
                    <span className="modal-baja-input-highlight"></span>
                  </div>

                  <div className={`modal-baja-input-wrapper ${formData.telefono_fijo || activeField === 'telefono_fijo' ? 'has-value' : ''}`}>
                    <label className="modal-baja-label"><FontAwesomeIcon icon={faPhone} className="modal-baja-input-icon" />Teléfono Fijo</label>
                    <input name="telefono_fijo" value={formData.telefono_fijo || ''} onChange={handleNumberChange} onFocus={() => handleFocus('telefono_fijo')} onBlur={handleBlur} className="modal-baja-input" inputMode="tel" />
                    <span className="modal-baja-input-highlight"></span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Paso 3 */}
          {currentStep === 3 && (
            <div className="modal-baja-section">
              <h3 className="modal-baja-section-title">Cobro y Comentarios</h3>
              <div className="modal-baja-section-content">
                <div className={`modal-baja-input-wrapper always-active ${formData.id_cobrador || activeField === 'id_cobrador' ? 'has-value' : ''} ${mostrarErrores && errores.id_cobrador ? 'has-error' : ''}`}>
                  <label className="modal-baja-label"><FontAwesomeIcon icon={faMoneyBillWave} className="modal-baja-input-icon" />Métodos de Pago</label>
                  <select name="id_cobrador" value={formData.id_cobrador || ''} onChange={handleChange} onFocus={() => handleFocus('id_cobrador')} onBlur={handleBlur} className="modal-baja-input" disabled={loading || !listas.loaded}>
                    <option value="" disabled hidden>Seleccione método</option>
                    {listas.cobradores.map(c => (<option key={c.id} value={c.id}>{c.nombre}</option>))}
                  </select>
                  <span className="modal-baja-input-highlight"></span>
                </div>

                <div className={`modal-baja-input-wrapper ${formData.comentario || activeField === 'comentario' ? 'has-value' : ''}`}>
                  <label className="modal-baja-label"><FontAwesomeIcon icon={faComment} className="modal-baja-input-icon" />Comentarios</label>
                  <textarea name="comentario" value={formData.comentario || ''} onChange={handleChange} onFocus={() => handleFocus('comentario')} onBlur={handleBlur} className="modal-baja-textarea" rows="4" />
                  <span className="modal-baja-input-highlight"></span>
                </div>
              </div>
            </div>
          )}
        </form>

        {/* Botonera */}
        <div className="modal-baja-buttons-container">
          {currentStep > 1 && (
            <button type="button" className="modal-baja-button prev-step" onClick={handlePrevStep} disabled={loading}>
              <FontAwesomeIcon icon={faStepBack} className="modal-baja-icon-button" />
              <span className="modal-baja-button-text">Anterior</span>
            </button>
          )}

          {currentStep < 3 ? (
            <button type="button" className="modal-baja-button next-step" onClick={handleNextStep} disabled={loading}>
              <span className="modal-baja-button-text">Siguiente</span>
              <FontAwesomeIcon icon={faArrowRight} className="modal-baja-icon-button" />
            </button>
          ) : (
            <button type="button" className="modal-baja-button" onClick={handleSubmit} disabled={loading}>
              <FontAwesomeIcon icon={faSave} className="modal-baja-icon-button" />
              <span className="modal-baja-button-text">{loading ? 'Guardando...' : 'Guardar Socio'}</span>
            </button>
          )}
        </div>

        <ConfirmLeaveModal
          open={showConfirmLeave}
          onConfirm={confirmLeave}
          onCancel={cancelLeave}
          loading={false}
        />
        </div>
      </div>
    </div>
  );
};

export default ModalAgregarSocioBaja;
