// src/components/Socios/SociosBaja.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BASE_URL from '../../config/config';
import { FaUserCheck, FaTrash, FaInfoCircle, FaCalendarAlt, FaFileExcel } from 'react-icons/fa';
import Toast from '../Global/Toast';
import './SociosBaja.css';

/* Exportar */
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

/* ===========================
   Helpers
=========================== */
const useIsMobile = (breakpoint = 768) => {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= breakpoint);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= breakpoint);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, [breakpoint]);
  return isMobile;
};

/* =========================================================
   Celda de Motivo (vista de tabla): icono si hay overflow
   ========================================================= */
function MotivoCell({ motivo, onClick }) {
  const textRef = useRef(null);
  const [truncado, setTruncado] = useState(false);

  const chequearTruncado = () => {
    const el = textRef.current;
    if (!el) return;
    const desbordaH = el.scrollWidth > el.clientWidth;
    const desbordaV = el.scrollHeight > el.clientHeight;
    setTruncado(desbordaH || desbordaV);
  };

  useEffect(() => { chequearTruncado(); }, [motivo]);
  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    let ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(chequearTruncado);
      ro.observe(el);
    }
    const t = setTimeout(chequearTruncado, 0);
    const onWinResize = () => chequearTruncado();
    window.addEventListener('resize', onWinResize);
    window.addEventListener('orientationchange', onWinResize);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', onWinResize);
      window.removeEventListener('orientationchange', onWinResize);
      clearTimeout(t);
    };
  }, []);

  return (
    <div className="soc-col-comentario-baja" onClick={onClick} title={motivo || 'Sin motivo'}>
      <span ref={textRef} className="soc-motivo-text">
        {motivo || 'Sin motivo'}
      </span>
      {truncado && <FaInfoCircle className="soc-icono-info-motivo" />}
    </div>
  );
}

/* =========================================================
   Motivo en tarjeta (mobile): ancho fijo 100px + botón
   ========================================================= */
function MotivoCellMobile({ motivo, onShow }) {
  const ref = useRef(null);
  const [desborda, setDesborda] = useState(false);

  useEffect(() => {
    const check = () => {
      const el = ref.current;
      if (!el) return;
      setDesborda(el.scrollWidth > el.clientWidth);
    };
    check();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(check) : null;
    if (ro && ref.current) ro.observe(ref.current);
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, [motivo]);

  return (
    <div className="soc-card-row">
      <span className="soc-card-label">Motivo</span>
      <div className="soc-motivo-mobile-wrap">
        <span ref={ref} className="soc-motivo-mobile" title={motivo || 'Sin motivo'}>
          {motivo || 'Sin motivo'}
        </span>
        {desborda && (
          <button type="button" className="soc-btn-ver-motivo" onClick={onShow}>
            Ver todo
          </button>
        )}
      </div>
    </div>
  );
}

const SociosBaja = () => {
  const [socios, setSocios] = useState([]);
  const [sociosFiltrados, setSociosFiltrados] = useState([]);
  const [loading, setLoading] = useState(true);

  const [socioSeleccionado, setSocioSeleccionado] = useState(null);
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false);
  const [mostrarConfirmacionEliminar, setMostrarConfirmacionEliminar] = useState(false);
  const [mostrarModalMotivo, setMostrarModalMotivo] = useState(false);

  const [motivoCompleto, setMotivoCompleto] = useState('');
  const [toast, setToast] = useState({ show: false, tipo: '', mensaje: '' });
  const [busqueda, setBusqueda] = useState('');

  // Fecha de alta editable
  const [fechaAlta, setFechaAlta] = useState('');
  const fechaInputRef = useRef(null);

  const navigate = useNavigate();
  const isMobile = useIsMobile(768);

  // === ROL DEL USUARIO (admin/vista) ===
  const usuario = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('usuario')); } catch { return null; }
  }, []);
  const rol = (usuario?.rol || 'vista').toLowerCase();
  const isAdmin = rol === 'admin';

  // Zona horaria fija para evitar desfasajes
  const TZ = 'America/Argentina/Cordoba';
  const hoyISO = () =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());

  useEffect(() => { obtenerSociosBaja(); }, []);
  useEffect(() => {
    const filtrados = socios.filter((s) =>
      (s.nombre || '').toLowerCase().includes(busqueda.toLowerCase())
    );
    setSociosFiltrados(filtrados);
  }, [busqueda, socios]);

  const obtenerSociosBaja = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${BASE_URL}/api.php?action=socios&baja=1&ts=${Date.now()}`);
      const data = await response.json();
      if (data.exito) {
        setSocios(data.socios || []);
        setSociosFiltrados(data.socios || []);
      } else {
        setToast({ show: true, tipo: 'error', mensaje: 'Error al cargar socios dados de baja' });
      }
    } catch {
      setToast({ show: true, tipo: 'error', mensaje: 'Error de conexión al cargar socios' });
    } finally {
      setLoading(false);
    }
  };

  const mostrarMotivoCompleto = (motivo) => {
    setMotivoCompleto(motivo || 'No hay motivo especificado');
    setMostrarModalMotivo(true);
  };

  const darAltaSocio = async (id) => {
    // Lógica intacta; botones se ocultan en vista, pero por seguridad evitamos si no es admin.
    if (!isAdmin) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaAlta)) {
      setToast({ show: true, tipo: 'error', mensaje: 'Fecha de alta inválida (AAAA-MM-DD).' });
      return;
    }
    try {
      const params = new URLSearchParams();
      params.set('id_socio', String(id));
      params.set('fecha_ingreso', fechaAlta);
      const response = await fetch(`${BASE_URL}/api.php?action=dar_alta_socio&ts=${Date.now()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: params.toString(),
      });
      const text = await response.text();
      const data = (() => { try { return JSON.parse(text); } catch { return { exito:false, mensaje:text }; }})();
      if (response.ok && data.exito) {
        setSocios(prev => prev.filter(s => s.id_socio !== id));
        setSociosFiltrados(prev => prev.filter(s => s.id_socio !== id));
        setMostrarConfirmacion(false);
        setSocioSeleccionado(null);
        setToast({ show: true, tipo: 'exito', mensaje: 'Socio dado de alta correctamente' });
      } else {
        setToast({ show: true, tipo: 'error', mensaje: 'Error al dar de alta: ' + (data.mensaje || 'Desconocido') });
      }
    } catch {
      setToast({ show: true, tipo: 'error', mensaje: 'Error de red al dar de alta' });
    }
  };

  const eliminarSocio = async (id) => {
    if (!isAdmin) return;
    try {
      const response = await fetch(`${BASE_URL}/api.php?action=eliminar_socio&ts=${Date.now()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_socio: id }),
      });
      const data = await response.json();
      if (data.exito) {
        setSocios(prev => prev.filter(s => s.id_socio !== id));
        setSociosFiltrados(prev => prev.filter(s => s.id_socio !== id));
        setMostrarConfirmacionEliminar(false);
        setSocioSeleccionado(null);
        setToast({ show: true, tipo: 'exito', mensaje: 'Socio eliminado permanentemente' });
      } else {
        setToast({ show: true, tipo: 'error', mensaje: 'Error al eliminar: ' + data.mensaje });
      }
    } catch {
      setToast({ show: true, tipo: 'error', mensaje: 'Error de red al intentar eliminar' });
    }
  };

  const closeToast = () => setToast({ ...toast, show: false });

  const formatearFecha = (yyyy_mm_dd) => {
    if (!yyyy_mm_dd) return '';
    const [y, m, d] = (yyyy_mm_dd || '').split('-');
    if (!y || !m || !d) return yyyy_mm_dd;
    return `${d}/${m}/${y}`;
  };

  const openDatePicker = (e) => {
    e.preventDefault();
    const el = fechaInputRef.current;
    if (!el) return;
    try {
      if (typeof el.showPicker === 'function') el.showPicker();
      else { el.focus(); el.click(); }
    } catch { el.focus(); el.click(); }
  };

  const handleKeyDownPicker = (e) => {
    if (e.key === 'Enter' || e.key === ' ') openDatePicker(e);
  };

  const exportarExcel = () => {
    if (!sociosFiltrados.length) {
      setToast({ show: true, tipo: 'error', mensaje: 'No hay registros para exportar.' });
      return;
    }
    const datos = sociosFiltrados.map((s) => ({
      ID: s.id_socio,
      Nombre: s.nombre || '',
      'Fecha de baja': s.ingreso || '',
      Motivo: s.motivo || 'Sin motivo',
    }));
    const ws = XLSX.utils.json_to_sheet(datos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Socios Baja (visibles)');
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
    const ahora = new Date();
    const yyyy = ahora.getFullYear();
    const mm = String(ahora.getMonth() + 1).padStart(2, '0');
    const dd = String(ahora.getDate()).padStart(2, '0');
    saveAs(blob, `Socios_Baja_${yyyy}-${mm}-${dd}.xlsx`);
  };

  return (
    <div className="soc-container-baja">
      <div className="soc-glass-effect-baja"></div>

      {/* BARRA SUPERIOR */}
      <div className="soc-barra-superior-baja">
        <div className="soc-titulo-container-baja">
          <h2 className="soc-titulo-baja">Socios Dados de Baja</h2>
        </div>
        <div className="soc-acciones-superior-baja">
          <button className="soc-boton-volver-baja" onClick={() => navigate('/socios')}>← Volver</button>
        </div>
      </div>

      {/* BUSCADOR */}
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

      {toast.show && (
        <Toast tipo={toast.tipo} mensaje={toast.mensaje} onClose={closeToast} duracion={3000} />
      )}

      {loading ? (
        <p className="soc-cargando-baja">Cargando socios dados de baja...</p>
      ) : (
        <>
          {/* TOPBAR tabla / contador + export */}
          <div className="soc-tabla-topbar-baja">
            <div className="soc-contador-baja">
              Mostrando <strong>{sociosFiltrados.length}</strong> socios
            </div>
            <button className="soc-boton-exportar-baja" onClick={exportarExcel} title="Exportar lo visible a Excel" disabled={loading}>
              <FaFileExcel style={{ marginRight: 6 }} />
              Exportar a Excel
            </button>
          </div>

          {/* ===== Desktop/Tablet: Tabla ===== */}
          {!isMobile ? (
            <div className="soc-tabla-container-baja">
              <div className="soc-tabla-header-container-baja">
                <div className="soc-tabla-header-baja">
                  <div className="soc-col-id-baja">ID</div>
                  <div className="soc-col-nombre-baja">Nombre</div>
                  <div className="soc-col-domicilio-baja">Fecha de baja</div>
                  <div className="soc-col-comentario-baja">Motivo</div>
                  <div className="soc-col-acciones-baja">Acciones</div>
                </div>
              </div>
              <div className="soc-tabla-body-baja">
                {sociosFiltrados.length === 0 ? (
                  <div className="soc-sin-resultados-container-baja">
                    <div className="soc-sin-resultados-baja">
                      <FaUserCheck className="soc-icono-sin-resultados-baja" />
                      No hay socios dados de baja
                    </div>
                  </div>
                ) : (
                  sociosFiltrados.map((s) => (
                    <div className="soc-tabla-fila-baja" key={s.id_socio}>
                      <div className="soc-col-id-baja">{s.id_socio}</div>
                      <div className="soc-col-nombre-baja">{s.nombre}</div>
                      <div className="soc-col-domicilio-baja">{formatearFecha(s.ingreso)}</div>
                      <MotivoCell motivo={s.motivo} onClick={() => mostrarMotivoCompleto(s.motivo)} />
                      <div className="soc-col-acciones-baja">
                        <div className="soc-iconos-acciones-baja">
                          {isAdmin && (
                            <>
                              <FaUserCheck
                                title="Dar de alta"
                                className="soc-icono-baja"
                                onClick={() => { setSocioSeleccionado(s); setFechaAlta(hoyISO()); setMostrarConfirmacion(true); }}
                              />
                              <FaTrash
                                title="Eliminar permanentemente"
                                className="soc-icono-baja"
                                onClick={() => { setSocioSeleccionado(s); setMostrarConfirmacionEliminar(true); }}
                              />
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            /* ===== Mobile: Tarjetas ===== */
            <div className="soc-cards-list">
              {sociosFiltrados.length === 0 ? (
                <div className="soc-sin-resultados-container-baja">
                  <div className="soc-sin-resultados-baja">
                    <FaUserCheck className="soc-icono-sin-resultados-baja" />
                    No hay socios dados de baja
                  </div>
                </div>
              ) : (
                sociosFiltrados.map((s) => (
                  <article className="soc-card" key={s.id_socio}>
                    <header className="soc-card-header">
                      <div className="soc-card-id">ID #{s.id_socio}</div>
                      <div className="soc-card-actions">
                        {isAdmin && (
                          <>
                            <button
                              type="button"
                              className="soc-card-icon-btn success"
                              title="Dar de alta"
                              onClick={() => { setSocioSeleccionado(s); setFechaAlta(hoyISO()); setMostrarConfirmacion(true); }}
                            >
                              <FaUserCheck aria-hidden />
                            </button>
                            <button
                              type="button"
                              className="soc-card-icon-btn danger"
                              title="Eliminar permanentemente"
                              onClick={() => { setSocioSeleccionado(s); setMostrarConfirmacionEliminar(true); }}
                            >
                              <FaTrash aria-hidden />
                            </button>
                          </>
                        )}
                      </div>
                    </header>

                    <div className="soc-card-row">
                      <span className="soc-card-label">Nombre</span>
                      <span className="soc-card-value">{s.nombre}</span>
                    </div>

                    <div className="soc-card-row">
                      <span className="soc-card-label">Fecha de baja</span>
                      <span className="soc-card-value">{formatearFecha(s.ingreso)}</span>
                    </div>

                    <MotivoCellMobile
                      motivo={s.motivo}
                      onShow={() => mostrarMotivoCompleto(s.motivo)}
                    />
                  </article>
                ))
              )}
            </div>
          )}
        </>
      )}

      {/* Modal Alta (estructura y clases intactas) */}
      {mostrarConfirmacion && socioSeleccionado && (
        <div className="soc-modal-overlay-baja">
          <div className="soc-modal-contenido-alta">
            <div className="soc-modal-icono-alta"><FaUserCheck /></div>
            <h3 className="soc-modal-titulo-alta">Reactivar Socio</h3>
            <p className="soc-modal-texto-alta">
              ¿Deseás dar de alta nuevamente al socio <strong>{socioSeleccionado.nombre}</strong>?
            </p>
            <div className="soc-campo-fecha-alta">
              <label htmlFor="fecha_alta" className="soc-label-fecha-alta">Fecha de alta</label>
              <div
                className="soc-input-fecha-container"
                role="button"
                tabIndex={0}
                onMouseDown={openDatePicker}
                onKeyDown={handleKeyDownPicker}
                aria-label="Abrir selector de fecha"
              >
                <input
                  id="fecha_alta"
                  ref={fechaInputRef}
                  type="date"
                  className="soc-input-fecha-alta"
                  value={fechaAlta}
                  onChange={(e) => setFechaAlta(e.target.value)}
                />
                <FaCalendarAlt className="soc-icono-calendario" aria-hidden="true" />
              </div>
            </div>
            <div className="soc-modal-botones-alta">
              <button className="soc-boton-confirmar-alta" onClick={() => darAltaSocio(socioSeleccionado.id_socio)}>Confirmar</button>
              <button className="soc-boton-cancelar-alta" onClick={() => { setMostrarConfirmacion(false); setSocioSeleccionado(null); }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Eliminar (estructura y clases intactas) */}
      {mostrarConfirmacionEliminar && socioSeleccionado && (
        <div className="soc-modal-overlay-baja">
          <div className="soc-modal-contenido-eliminar">
            <div className="soc-modal-icono-eliminar"><FaTrash /></div>
            <h3 className="soc-modal-titulo-eliminar">Eliminar Permanentemente</h3>
            <p className="soc-modal-texto-eliminar">
              ¿Estás seguro que deseas eliminar permanentemente al socio <strong>{socioSeleccionado.nombre}</strong>?
            </p>
            <div className="soc-modal-botones-eliminar">
              <button className="soc-boton-confirmar-eliminar" onClick={() => eliminarSocio(socioSeleccionado.id_socio)}>Eliminar</button>
              <button className="soc-boton-cancelar-eliminar" onClick={() => { setMostrarConfirmacionEliminar(false); setSocioSeleccionado(null); }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Motivo */}
      {mostrarModalMotivo && (
        <div className="soc-modal-overlay-baja">
          <div className="soc-modal-contenido-motivo">
            <div className="soc-modal-icono-motivo"><FaInfoCircle /></div>
            <h3 className="soc-modal-titulo-motivo">Motivo de la baja</h3>
            <div className="soc-modal-texto-motivo">{motivoCompleto}</div>
            <div className="soc-modal-botones-motivo">
              <button className="soc-boton-cerrar-motivo" onClick={() => setMostrarModalMotivo(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Barra inferior móvil */}
      <nav className="soc-bottom-nav" role="navigation" aria-label="Acciones rápidas">
        <button type="button" className="soc-bottom-btn volver" onClick={() => navigate('/socios')}>← Volver</button>
        <button type="button" className="soc-bottom-btn export" onClick={exportarExcel} disabled={loading} title={loading ? 'Cargando...' : 'Exportar lo visible a Excel'}>
          <FaFileExcel aria-hidden="true" />
          <span>Exportar</span>
        </button>
      </nav>
    </div>
  );
};

export default SociosBaja;
