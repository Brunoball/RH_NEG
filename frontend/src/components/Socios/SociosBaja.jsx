import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BASE_URL from '../../config/config';
import { FaUserCheck, FaTrash, FaInfoCircle, FaCalendarAlt, FaFileExcel } from 'react-icons/fa';
import Toast from '../Global/Toast';
import './SociosBaja.css';

/* Exportar */
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

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

  // === ROL DEL USUARIO (admin/vista) ===
  const [usuario] = useState(() => {
    try { return JSON.parse(localStorage.getItem('usuario')); } catch { return null; }
  });
  const rol = (usuario?.rol || 'vista').toLowerCase();
  const isAdmin = rol === 'admin';

  // Fecha de alta editable
  const [fechaAlta, setFechaAlta] = useState('');
  const fechaInputRef = useRef(null);

  const navigate = useNavigate();

  // Zona horaria fija para evitar desfasajes
  const TZ = 'America/Argentina/Cordoba';

  const hoyISO = () => {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  };

  useEffect(() => {
    obtenerSociosBaja();
  }, []);

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
        console.error('Error al obtener socios dados de baja:', data.mensaje);
        setToast({
          show: true,
          tipo: 'error',
          mensaje: 'Error al cargar socios dados de baja',
        });
      }
    } catch (error) {
      console.error('Error de red:', error);
      setToast({
        show: true,
        tipo: 'error',
        mensaje: 'Error de conexión al cargar socios',
      });
    } finally {
      setLoading(false);
    }
  };

  const mostrarMotivoCompleto = (motivo) => {
    setMotivoCompleto(motivo || 'No hay motivo especificado');
    setMostrarModalMotivo(true);
  };

  const darAltaSocio = async (id) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaAlta)) {
      setToast({
        show: true,
        tipo: 'error',
        mensaje: 'Fecha de alta inválida. Usá el formato AAAA-MM-DD.',
      });
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

      let data;
      const text = await response.text();
      try {
        data = JSON.parse(text);
      } catch {
        data = { exito: false, mensaje: text || 'Respuesta no válida' };
      }

      if (response.ok && data.exito) {
        setSocios((prev) => prev.filter((s) => s.id_socio !== id));
        setSociosFiltrados((prev) => prev.filter((s) => s.id_socio !== id));
        setMostrarConfirmacion(false);
        setSocioSeleccionado(null);
        setToast({ show: true, tipo: 'exito', mensaje: `Socio dado de alta correctamente` });
      } else {
        setToast({
          show: true,
          tipo: 'error',
          mensaje: 'Error al dar de alta: ' + (data.mensaje || 'Desconocido'),
        });
      }
    } catch (error) {
      setToast({ show: true, tipo: 'error', mensaje: 'Error de red al dar de alta' });
    }
  };

  const eliminarSocio = async (id) => {
    try {
      const response = await fetch(`${BASE_URL}/api.php?action=eliminar_socio&ts=${Date.now()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_socio: id }),
      });

      const data = await response.json();
      if (data.exito) {
        setSocios((prev) => prev.filter((s) => s.id_socio !== id));
        setSociosFiltrados((prev) => prev.filter((s) => s.id_socio !== id));
        setMostrarConfirmacionEliminar(false);
        setSocioSeleccionado(null);
        setToast({ show: true, tipo: 'exito', mensaje: 'Socio eliminado permanentemente' });
      } else {
        setToast({ show: true, tipo: 'error', mensaje: 'Error al eliminar: ' + data.mensaje });
      }
    } catch (error) {
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
      if (typeof el.showPicker === 'function') {
        el.showPicker();
      } else {
        el.focus();
        el.click();
      }
    } catch {
      el.focus();
      el.click();
    }
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
          {/* Se dejó SOLO el botón Volver aquí (desktop/tablet) */}
          <button className="soc-boton-volver-baja" onClick={() => navigate('/socios')}>
            ← Volver
          </button>
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
        <Toast
          tipo={toast.tipo}
          mensaje={toast.mensaje}
          onClose={closeToast}
          duracion={3000}
        />
      )}

      {loading ? (
        <p className="soc-cargando-baja">Cargando socios dados de baja...</p>
      ) : (
        <div className="soc-tabla-container-baja">
          {/* === TOPBAR DE TABLA: contador + exportar (desktop/tablet) === */}
          <div className="soc-tabla-topbar-baja">
            <div className="soc-contador-baja">
              Mostrando <strong>{sociosFiltrados.length}</strong> socios
            </div>

            <button
              className="soc-boton-exportar-baja"
              onClick={exportarExcel}
              title="Exportar lo visible a Excel"
              disabled={loading}
            >
              <FaFileExcel style={{ marginRight: 6 }} />
              Exportar a Excel
            </button>
          </div>

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
                  <div className="soc-col-domicilio-baja">
                    {formatearFecha(s.ingreso)}
                  </div>
                  <div
                    className="soc-col-comentario-baja"
                    onClick={() => mostrarMotivoCompleto(s.motivo)}
                  >
                    <div className="soc-motivo-contenedor">
                      {s.motivo ? (
                        <>
                          {s.motivo.length > 30 ? `${s.motivo.substring(0, 30)}...` : s.motivo}
                          <FaInfoCircle className="soc-icono-info-motivo" />
                        </>
                      ) : (
                        'Sin motivo'
                      )}
                    </div>
                  </div>
                  <div className="soc-col-acciones-baja">
                    <div className="soc-iconos-acciones-baja">
                      {/* Solo ADMIN: Reactivar y Eliminar */}
                      {isAdmin && (
                        <>
                          <FaUserCheck
                            title="Dar de alta"
                            className="soc-icono-baja"
                            onClick={() => {
                              setSocioSeleccionado(s);
                              setFechaAlta(hoyISO());
                              setMostrarConfirmacion(true);
                            }}
                          />
                          <FaTrash
                            title="Eliminar permanentemente"
                            className="soc-icono-baja"
                            onClick={() => {
                              setSocioSeleccionado(s);
                              setMostrarConfirmacionEliminar(true);
                            }}
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
      )}

      {mostrarConfirmacion && socioSeleccionado && (
        <div className="soc-modal-overlay-baja">
          <div className="soc-modal-contenido-alta">
            <div className="soc-modal-icono-alta">
              <FaUserCheck />
            </div>
            <h3 className="soc-modal-titulo-alta">Reactivar Socio</h3>
            <p className="soc-modal-texto-alta">
              ¿Deseás dar de alta nuevamente al socio <strong>{socioSeleccionado.nombre}</strong>?
            </p>

            <div className="soc-campo-fecha-alta">
              <label htmlFor="fecha_alta" className="soc-label-fecha-alta">
                Fecha de alta
              </label>

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
              <button
                className="soc-boton-confirmar-alta"
                onClick={() => darAltaSocio(socioSeleccionado.id_socio)}
              >
                Confirmar
              </button>
              <button
                className="soc-boton-cancelar-alta"
                onClick={() => {
                  setMostrarConfirmacion(false);
                  setSocioSeleccionado(null);
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {mostrarConfirmacionEliminar && socioSeleccionado && (
        <div className="soc-modal-overlay-baja">
          <div className="soc-modal-contenido-eliminar">
            <div className="soc-modal-icono-eliminar">
              <FaTrash />
            </div>
            <h3 className="soc-modal-titulo-eliminar">Eliminar Permanentemente</h3>
            <p className="soc-modal-texto-eliminar">
              ¿Estás seguro que deseas eliminar permanentemente al socio <strong>{socioSeleccionado.nombre}</strong>?
            </p>
            <div className="soc-modal-botones-eliminar">
              <button
                className="soc-boton-confirmar-eliminar"
                onClick={() => eliminarSocio(socioSeleccionado.id_socio)}
              >
                Eliminar
              </button>
              <button
                className="soc-boton-cancelar-eliminar"
                onClick={() => {
                  setMostrarConfirmacionEliminar(false);
                  setSocioSeleccionado(null);
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {mostrarModalMotivo && (
        <div className="soc-modal-overlay-baja">
          <div className="soc-modal-contenido-motivo">
            <div className="soc-modal-icono-motivo">
              <FaInfoCircle />
            </div>
            <h3 className="soc-modal-titulo-motivo">Motivo de la baja</h3>
            <div className="soc-modal-texto-motivo">
              {motivoCompleto}
            </div>
            <div className="soc-modal-botones-motivo">
              <button
                className="soc-boton-cerrar-motivo"
                onClick={() => setMostrarModalMotivo(false)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======== BARRA INFERIOR (MÓVIL) ======== */}
      <nav className="soc-bottom-nav" role="navigation" aria-label="Acciones rápidas">
        <button
          type="button"
          className="soc-bottom-btn volver"
          onClick={() => navigate('/socios')}
        >
          ← Volver
        </button>

        <button
          type="button"
          className="soc-bottom-btn export"
          onClick={exportarExcel}
          disabled={loading}
          title={loading ? 'Cargando...' : 'Exportar lo visible a Excel'}
        >
          <FaFileExcel aria-hidden="true" />
          <span>Exportar</span>
        </button>
      </nav>
      {/* ======================================= */}
    </div>
  );
};

export default SociosBaja;
