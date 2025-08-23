// src/components/Socios/EditarSocio.jsx
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
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

const MiniSpinner = () => <span className="mini-spinner" aria-label="cargando" />;

const FORM_KEYS = [
  'nombre','id_cobrador','id_categoria','domicilio','numero','telefono_movil','telefono_fijo','comentario',
  'nacimiento','id_estado','domicilio_cobro','dni','ingreso'
];

// ---- Helpers de fecha muy livianos
const formatFechaISO = (fecha) => {
  if (!fecha || fecha === '0000-00-00' || fecha === 'NULL') return '';
  if (typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) return fecha;
  if (typeof fecha === 'string' && fecha.includes('T')) {
    const d = new Date(fecha);
    if (!isNaN(d)) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${dd}`;
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

const socioToForm = (socioRaw) => {
  const out = {};
  FORM_KEYS.forEach(k => {
    if (k === 'nacimiento' || k === 'ingreso') out[k] = formatFechaISO(socioRaw?.[k]);
    else out[k] = socioRaw?.[k] ?? '';
  });
  return out;
};

const normalizar = (data) => {
  const copia = { ...data };
  Object.keys(copia).forEach((key) => {
    if (copia[key] === '') copia[key] = null;
  });
  return copia;
};

const EditarSocio = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // refs
  const formRef = useRef(null);
  const nacimientoRef = useRef(null);
  const ingresoRef = useRef(null);

  // pestañas
  const [activeTab, setActiveTab] = useState('datos');

  // estado formulario
  const [formData, setFormData] = useState(() => ({
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
  }));
  const [datosOriginales, setDatosOriginales] = useState({});

  // listas (carga dividida)
  const [categorias, setCategorias] = useState([]);
  const [estados, setEstados] = useState([]);
  const [cobradores, setCobradores] = useState([]);
  const [periodos, setPeriodos] = useState([]); // por si luego lo usás

  // loading flags
  const [loadingSocio, setLoadingSocio] = useState(true);
  const [loadingCE, setLoadingCE] = useState(true); // Categorías + Estados
  const [loadingCobradores, setLoadingCobradores] = useState(false);
  const [loadingSubmit, setLoadingSubmit] = useState(false);

  // toast
  const [toast, setToast] = useState({ show: false, message: '', type: 'exito' });
  const showToast = useCallback((message, type = 'exito') => setToast({ show: true, message, type }), []);

  // ===== Prefetch instantáneo (si vino desde Socios.jsx) =====
  // Soporta: navigate('/socios/editar/:id', { state: { socio } })
  const socioPrefetch = useMemo(() => {
    const sFromState = location?.state && location.state.socio ? location.state.socio : null;
    if (sFromState) return sFromState;
    // fallback: mirar en sessionStorage si alguien guardó un prefetch (opcional)
    try {
      const raw = sessionStorage.getItem(`socio_prefetch_${id}`);
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  }, [location?.state, id]);

  // ===== CARGA INICIAL: Pintar YA si hay prefetch. Revalidar en background. =====
  useEffect(() => {
    let abortado = false;
    const ctrl = new AbortController();

    const pintarDePrefetch = () => {
      if (!socioPrefetch) return false;
      const fm = socioToForm(socioPrefetch);
      setFormData(fm);
      setDatosOriginales(fm);
      setLoadingSocio(false); // Mostramos YA
      return true;
    };

    const fetchSocio = async () => {
      try {
        // si pudimos pintar con prefetch, esto corre en segundo plano
        const res = await fetch(`${BASE_URL}/api.php?action=editar_socio&id=${id}`, { signal: ctrl.signal, cache: 'no-store' });
        const data = await res.json();
        if (abortado) return;
        if (data?.exito && data?.socio) {
          const fm = socioToForm(data.socio);
          setFormData(fm);
          setDatosOriginales(fm);
          // si no hubo prefetch, ahora sí termina el loading
          setLoadingSocio(false);
          // cache opcional para futuros “atrás y adelante”
          try { sessionStorage.setItem(`socio_prefetch_${id}`, JSON.stringify(data.socio)); } catch {}
        } else {
          if (!socioPrefetch) setLoadingSocio(false);
          showToast('Error al cargar datos del socio' + (data?.mensaje ? `: ${data.mensaje}` : ''), 'error');
        }
      } catch (err) {
        if (!abortado) {
          if (!socioPrefetch) setLoadingSocio(false);
          showToast('Error de conexión al cargar socio: ' + err.message, 'error');
        }
      }
    };

    const pinto = pintarDePrefetch();
    if (!pinto) setLoadingSocio(true); // si no hay prefetch, sí mostramos skeleton hasta que venga
    fetchSocio();

    return () => { abortado = true; ctrl.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ===== Listas base (categorías/estados) en paralelo — no bloquean primera pintura =====
  useEffect(() => {
    let abortado = false;
    const ctrl = new AbortController();
    const loadCE = async () => {
      try {
        setLoadingCE(true);
        const res = await fetch(`${BASE_URL}/api.php?action=listas`, { signal: ctrl.signal, cache: 'force-cache' });
        const json = await res.json();
        if (abortado) return;
        if (json?.exito && json?.listas) {
          setCategorias(json.listas.categorias ?? []);
          setEstados(json.listas.estados ?? []);
        } else {
          setCategorias([]);
          setEstados([]);
        }
      } catch {
        if (!abortado) { setCategorias([]); setEstados([]); }
      } finally {
        if (!abortado) setLoadingCE(false);
      }
    };
    loadCE();
    return () => { abortado = true; ctrl.abort(); };
  }, []);

  // ===== LAZY LOAD: Cobradores cuando abrís Cobranza =====
  useEffect(() => {
    let cancel = false;
    const ctrl = new AbortController();
    const loadCobradores = async () => {
      if (activeTab !== 'cobranza') return;
      if (loadingCobradores || cobradores.length > 0) return;
      try {
        setLoadingCobradores(true);
        const res = await fetch(`${BASE_URL}/api.php?action=listas`, { signal: ctrl.signal, cache: 'force-cache' });
        const json = await res.json();
        if (!cancel && json?.exito && json?.listas) {
          setCobradores(json.listas.cobradores ?? []);
          setPeriodos(json.listas.periodos ?? []);
        }
      } catch {
        if (!cancel) { setCobradores([]); setPeriodos([]); }
      } finally {
        if (!cancel) setLoadingCobradores(false);
      }
    };
    loadCobradores();
    return () => { cancel = true; ctrl.abort(); };
  }, [activeTab, loadingCobradores, cobradores.length]);

  // === Handlers ===
  const handleNumberChange = useCallback((e) => {
    const { name, value } = e.target;
    const numericValue = value.replace(/[^0-9]/g, '');
    setFormData(prev => (prev[name] === numericValue ? prev : { ...prev, [name]: numericValue }));
  }, []);

  // Micro-opt: no uppercasemos todo en cada keypress; sólo normalizamos lo básico
  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    // Mantener mayúsculas pero sin crear GC excesivo
    const v = typeof value === 'string' ? value.toUpperCase() : value;
    setFormData(prev => (prev[name] === v ? prev : { ...prev, [name]: v }));
  }, []);

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

  // === Submit ===
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
      setLoadingSubmit(true);
      const res = await fetch(`${BASE_URL}/api.php?action=editar_socio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, id_socio: id }),
      });
      const data = await res.json();
      if (data?.exito) {
        showToast('Socio actualizado correctamente', 'exito');
        // volvemos — en Socios.jsx ya restaurás filtros/scroll
        setTimeout(() => navigate('/socios', { state: { refresh: true } }), 600);
      } else {
        showToast('Error al actualizar' + (data?.mensaje ? `: ${data.mensaje}` : ''), 'error');
      }
    } catch (error) {
      showToast('Error de red: ' + error, 'error');
    } finally {
      setLoadingSubmit(false);
    }
  };

  // estados visuales
  const readyPrimerPestana = !loadingSocio; // “Datos Generales” visibles ni bien tengamos socio (o prefetch)
  const readyCategoriasEstados = !loadingCE;

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
            onClick={() => navigate('/socios', { state: { refresh: true } })}
          >
            <FontAwesomeIcon icon={faArrowLeft} />
            Volver
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="edit-socio-form" ref={formRef}>
          {/* Pestañas */}
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

          {/* Contenido */}
          <div className="edit-tab-content">
            {/* DATOS GENERALES */}
            {activeTab === 'datos' && (
              <div className="edit-tab-pane active">
                {!readyPrimerPestana ? (
                  // Skeleton ultra-liviano
                  <div className="edit-skeleton">
                    <div className="skeleton-line w60" />
                    <div className="skeleton-row">
                      <div className="skeleton-line w40" />
                      <div className="skeleton-line w40" />
                    </div>
                    <div className="skeleton-row">
                      <div className="skeleton-line w40" />
                      <div className="skeleton-line w40" />
                    </div>
                  </div>
                ) : (
                  <div className="edit-socio-section">
                    <div className="edit-socio-input-wrapper has-value">
                      <label className="edit-socio-label">
                        <FontAwesomeIcon icon={faUser} className="input-icon" />
                        Apellido y Nombre
                      </label>
                      <input
                        name="nombre"
                        value={formData.nombre || ''}
                        onChange={handleChange}
                        className="edit-socio-input"
                        autoFocus
                      />
                      <span className="edit-socio-input-highlight"></span>
                    </div>

                    <div className="edit-socio-group-row">
                      <div className="edit-socio-input-wrapper has-value">
                        <label className="edit-socio-label">
                          <FontAwesomeIcon icon={faIdCard} className="input-icon" />
                          DNI
                        </label>
                        <input
                          name="dni"
                          value={formData.dni || ''}
                          onChange={handleNumberChange}
                          className="edit-socio-input"
                          inputMode="numeric"
                        />
                        <span className="edit-socio-input-highlight"></span>
                      </div>

                      <div 
                        className={`edit-socio-input-wrapper always-active ${formData.nacimiento ? 'has-value' : ''}`}
                        onMouseDown={openDateWithGesture(nacimientoRef)}
                        onTouchStart={openDateWithGesture(nacimientoRef)}
                      >
                        <label
                          htmlFor="nacimiento"
                          className="edit-socio-label"
                          onMouseDown={openDateWithGesture(nacimientoRef)}
                          onTouchStart={openDateWithGesture(nacimientoRef)}
                        >
                          <FontAwesomeIcon icon={faCalendarDays} className="input-icon" />
                          Fecha de Nacimiento
                        </label>
                        <input
                          id="nacimiento"
                          ref={nacimientoRef}
                          type="date"
                          name="nacimiento"
                          value={formData.nacimiento || ''}
                          onChange={handleChange}
                          onClick={openDateWithGesture(nacimientoRef)}
                          className="edit-socio-input"
                        />
                        <span className="edit-socio-input-highlight"></span>
                      </div>
                    </div>

                    <div className="edit-socio-group-row">
                      <div 
                        className={`edit-socio-input-wrapper always-active ${formData.ingreso ? 'has-value' : ''}`}
                        onMouseDown={openDateWithGesture(ingresoRef)}
                        onTouchStart={openDateWithGesture(ingresoRef)}
                      >
                        <label
                          htmlFor="ingreso"
                          className="edit-socio-label"
                          onMouseDown={openDateWithGesture(ingresoRef)}
                          onTouchStart={openDateWithGesture(ingresoRef)}
                        >
                          <FontAwesomeIcon icon={faCalendarDays} className="input-icon" />
                          Fecha de Ingreso
                        </label>
                        <input
                          id="ingreso"
                          ref={ingresoRef}
                          type="date"
                          name="ingreso"
                          value={formData.ingreso || ''}
                          onChange={handleChange}
                          onClick={openDateWithGesture(ingresoRef)}
                          className="edit-socio-input"
                        />
                        <span className="edit-socio-input-highlight"></span>
                      </div>

                      {/* Categoría (carga paralela; si aún carga, spinner inline) */}
                      <div className="edit-socio-input-wrapper always-active has-value">
                        <label className="edit-socio-label">
                          <FontAwesomeIcon icon={faUserTag} className="input-icon" />
                          Categoría {loadingCE && <MiniSpinner />}
                        </label>
                        <select 
                          name="id_categoria" 
                          value={formData.id_categoria || ''} 
                          onChange={handleChange}
                          className="edit-socio-input"
                          disabled={loadingCE}
                        >
                          <option value="" disabled hidden>Seleccione categoría</option>
                          {categorias.map(c => (
                            <option key={c.id} value={c.id}>{c.descripcion}</option>
                          ))}
                        </select>
                        <span className="edit-socio-input-highlight"></span>
                      </div>

                      {/* Estado */}
                      <div className="edit-socio-input-wrapper always-active has-value">
                        <label className="edit-socio-label">
                          <FontAwesomeIcon icon={faCircleInfo} className="input-icon" />
                          Estado {loadingCE && <MiniSpinner />}
                        </label>
                        <select 
                          name="id_estado" 
                          value={formData.id_estado || ''} 
                          onChange={handleChange}
                          className="edit-socio-input"
                          disabled={loadingCE}
                        >
                          <option value="" disabled hidden>Seleccione estado</option>
                          {estados.map(e => (
                            <option key={e.id} value={e.id}>{e.descripcion}</option>
                          ))}
                        </select>
                        <span className="edit-socio-input-highlight"></span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* CONTACTO */}
            {activeTab === 'contacto' && (
              <div className="edit-tab-pane active">
                {!readyPrimerPestana ? (
                  <div className="edit-skeleton">
                    <div className="skeleton-line w70" />
                    <div className="skeleton-row">
                      <div className="skeleton-line w40" />
                      <div className="skeleton-line w30" />
                    </div>
                    <div className="skeleton-line w60" />
                    <div className="skeleton-row">
                      <div className="skeleton-line w40" />
                      <div className="skeleton-line w40" />
                    </div>
                  </div>
                ) : (
                  <div className="edit-socio-section">
                    <div className="edit-socio-domicilio-group">
                      <div className={`edit-socio-input-wrapper ${formData.domicilio ? 'has-value' : ''}`}>
                        <label className="edit-socio-label">
                          <FontAwesomeIcon icon={faHome} className="input-icon" />
                          Domicilio
                        </label>
                        <input
                          name="domicilio"
                          value={formData.domicilio || ''}
                          onChange={handleChange}
                          className="edit-socio-input"
                        />
                        <span className="edit-socio-input-highlight"></span>
                      </div>
                      
                      <div className={`edit-socio-input-wrapper ${formData.numero ? 'has-value' : ''}`}>
                        <label className="edit-socio-label">
                          <FontAwesomeIcon icon={faHashtag} className="input-icon" />
                          Número
                        </label>
                        <input
                          name="numero"
                          value={formData.numero || ''}
                          onChange={handleNumberChange}
                          className="edit-socio-input"
                          inputMode="numeric"
                        />
                        <span className="edit-socio-input-highlight"></span>
                      </div>
                    </div>

                    <div className={`edit-socio-input-wrapper ${formData.domicilio_cobro ? 'has-value' : ''}`}>
                      <label className="edit-socio-label">
                        <FontAwesomeIcon icon={faMapMarkerAlt} className="input-icon" />
                        Domicilio de Cobro
                      </label>
                      <input
                        name="domicilio_cobro"
                        value={formData.domicilio_cobro || ''}
                        onChange={handleChange}
                        className="edit-socio-input"
                      />
                      <span className="edit-socio-input-highlight"></span>
                    </div>
                    
                    <div className="edit-socio-group-row">
                      <div className={`edit-socio-input-wrapper ${formData.telefono_movil ? 'has-value' : ''}`}>
                        <label className="edit-socio-label">
                          <FontAwesomeIcon icon={faMobileScreen} className="input-icon" />
                          Teléfono Móvil
                        </label>
                        <input
                          name="telefono_movil"
                          value={formData.telefono_movil || ''}
                          onChange={handleNumberChange}
                          className="edit-socio-input"
                          inputMode="tel"
                        />
                        <span className="edit-socio-input-highlight"></span>
                      </div>

                      <div className={`edit-socio-input-wrapper ${formData.telefono_fijo ? 'has-value' : ''}`}>
                        <label className="edit-socio-label">
                          <FontAwesomeIcon icon={faPhone} className="input-icon" />
                          Teléfono Fijo
                        </label>
                        <input
                          name="telefono_fijo"
                          value={formData.telefono_fijo || ''}
                          onChange={handleNumberChange}
                          className="edit-socio-input"
                          inputMode="tel"
                        />
                        <span className="edit-socio-input-highlight"></span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* COBRANZA (lazy: cobradores) */}
            {activeTab === 'cobranza' && (
              <div className="edit-tab-pane active">
                {!readyPrimerPestana ? (
                  <div className="edit-skeleton">
                    <div className="skeleton-line w60" />
                    <div className="skeleton-line w80" />
                  </div>
                ) : (
                  <div className="edit-socio-section">
                    <div className="edit-socio-input-wrapper always-active has-value">
                      <label className="edit-socio-label">
                        <FontAwesomeIcon icon={faMoneyBillWave} className="input-icon" />
                        Medios de Pago {loadingCobradores && <MiniSpinner />}
                      </label>
                      <select 
                        name="id_cobrador" 
                        value={formData.id_cobrador || ''} 
                        onChange={handleChange}
                        className="edit-socio-input"
                        disabled={loadingCobradores}
                      >
                        <option value="" disabled hidden>Seleccione cobrador</option>
                        {cobradores.map(c => (
                          <option key={c.id} value={c.id}>{c.nombre}</option>
                        ))}
                      </select>
                      <span className="edit-socio-input-highlight"></span>
                    </div>

                    <div className={`edit-socio-input-wrapper cometarios-e ${formData.comentario ? 'has-value' : ''}`}>
                      <label className="edit-socio-label">
                        <FontAwesomeIcon icon={faComment} className="input-icon" />
                        Comentarios
                      </label>
                      <textarea
                        name="comentario"
                        value={formData.comentario || ''}
                        onChange={handleChange}
                        className="edit-socio-textarea"
                        rows="4"
                      />
                      <span className="edit-socio-input-highlight"></span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="edit-socio-buttons-container">
            <button 
              type="submit" 
              className="edit-socio-button"
              disabled={loadingSubmit || loadingSocio}
              title={loadingSocio ? 'Esperando datos del socio' : 'Guardar cambios'}
            >
              <FontAwesomeIcon icon={faSave} className="edit-socio-icon-button" />
              <span className="edit-socio-button-text">
                {loadingSubmit ? 'Guardando...' : 'Actualizar Socio'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditarSocio;
