// src/components/Categorias/Categorias.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BASE_URL from '../../config/config';
import Toast from '../Global/Toast';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft,
  faPlus,
  faTrash,
  faEdit,
  faTimes,
  faClockRotateLeft,
  faArrowTrendUp,
  faArrowTrendDown,
} from '@fortawesome/free-solid-svg-icons';
import './Categorias.css';

const Modal = ({ open, title, onClose, children, width = 720 }) => {
  if (!open) return null;
  return (
    <div className="cat_modal" role="dialog" aria-modal="true" aria-labelledby="cat_modal_title">
      <div className="cat_modal_card" style={{ maxWidth: width }}>
        <div className="cat_modal_head">
          <h3 id="cat_modal_title" className="cat_modal_title">{title}</h3>
          <button onClick={onClose} className="cat_modal_close" aria-label="Cerrar">
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
        <div className="cat_modal_body">{children}</div>
      </div>
    </div>
  );
};

/* ===== Modal Confirmar Eliminación (estilo Principal) ===== */
function ConfirmDeleteModal({ open, categoria, onConfirm, onCancel, loading }) {
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
      aria-labelledby="catdel-modal-title"
      onClick={onCancel}
    >
      <div
        className="catdel-modal-container catdel-modal--danger"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="catdel-modal__icon" aria-hidden="true">
          <FontAwesomeIcon icon={faTrash} />
        </div>

        <h3 id="catdel-modal-title" className="catdel-modal-title catdel-modal-title--danger">
          Eliminar categoría
        </h3>

        <p className="catdel-modal-text">
          Vas a eliminar <strong>{categoria?.nombre}</strong>. <br />
          <strong>ATENCIÓN:</strong> todos los socios que tengan esta categoría quedarán <strong>sin categoría</strong>.
          Esta acción <u>no se puede deshacer</u>.
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
            {loading ? 'Eliminando…' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}

const Categorias = () => {
  const navigate = useNavigate();

  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);

  // ====== TOAST ======
  const [toast, setToast] = useState({ show: false, tipo: 'exito', mensaje: '', duracion: 3000 });
  const showToast = (tipo, mensaje, duracion = 3000) => setToast({ show: true, tipo, mensaje, duracion });
  const closeToast = () => setToast((t) => ({ ...t, show: false }));

  const nombreRef = useRef(null);

  // ====== Historial
  const [modalHistOpen, setModalHistOpen] = useState(false);
  const [histLoading, setHistLoading] = useState(false);
  const [hist, setHist] = useState([]); // [{id_historial, precio_viejo, precio_nuevo, fecha_cambio}]
  const [histCategoria, setHistCategoria] = useState({ id: null, nombre: '' });

  // ====== Eliminar (modal)
  const [delState, setDelState] = useState({ open: false, cat: null, loading: false });

  // Helpers
  const api = (action) => `${BASE_URL}/api.php?action=${action}`;

  const cargar = async () => {
    try {
      setLoading(true);
      const r = await fetch(api('categorias_listar'));
      const data = await r.json();
      setLista(Array.isArray(data?.categorias) ? data.categorias : []);
    } catch (e) {
      console.error(e);
      showToast('error', 'No se pudieron cargar las categorías.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const filtradas = useMemo(() => lista, [lista]);

  // Abrir modal de confirmación
  const pedirConfirmacionEliminar = (cat) => {
    setDelState({ open: true, cat, loading: false });
  };

  // Confirmar eliminación (llamado por el modal)
  const confirmarEliminar = async () => {
    const cat = delState.cat;
    if (!cat) return setDelState({ open: false, cat: null, loading: false });

    try {
      setDelState((s) => ({ ...s, loading: true }));

      const r = await fetch(api('categorias_eliminar'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Enviamos idCategoria; el backend también acepta id_cat_monto
        body: JSON.stringify({ idCategoria: cat.idCategoria }),
      });

      // Leemos SIEMPRE como texto y luego intentamos parsear
      const text = await r.text();
      let resp = null;
      try { resp = JSON.parse(text); } catch (_) { /* no es JSON válido */ }

      if (!r.ok) {
        // Error HTTP real (500, 404, etc.)
        throw new Error(`HTTP ${r.status}: ${text.slice(0, 400)}`);
      }

      if (!resp || resp.ok !== true) {
        // 200 pero body inválido o ok=false
        const msg = (resp && (resp.mensaje || resp.error)) ||
                    (text?.trim() ? `Respuesta inválida: ${text.slice(0, 400)}` : 'Respuesta inválida del servidor');
        throw new Error(msg);
      }

      const afectados = Number(resp.socios_afectados ?? 0);
      showToast('exito', `Categoría eliminada. Socios sin categoría: ${afectados}.`);
      setDelState({ open: false, cat: null, loading: false });
      await cargar();
    } catch (e) {
      console.error(e);
      showToast('error', e.message || 'No se pudo eliminar la categoría.');
      setDelState((s) => ({ ...s, loading: false }));
    }
  };

  // ====== Historial por categoría (solo abre modal si hay registros)
  const abrirHistorial = async (cat) => {
    setHistCategoria({ id: cat.idCategoria, nombre: cat.nombre });
    setHistLoading(true);
    setHist([]); // limpiar cualquier lista previa
    try {
      const r = await fetch(api('categorias_historial'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idCategoria: cat.idCategoria }),
      });
      const data = await r.json();
      if (!data?.ok) throw new Error(data?.mensaje || 'No se pudo obtener el historial.');

      const registros = Array.isArray(data.historial) ? data.historial : [];

      if (registros.length === 0) {
        // 👉 No abrir modal, solo toast informativo
        showToast('info', 'Esta categoría no tiene historial de precios.');
        setHistLoading(false);
        return;
      }

      // Hay registros: setear estado y abrir modal
      setHist(registros);
      setModalHistOpen(true);
    } catch (err) {
      console.error(err);
      // No abrir modal si hubo error
      showToast('error', 'No se pudo cargar el historial.');
    } finally {
      setHistLoading(false);
    }
  };

  const fmtARS = (n) =>
    Number(n).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

  const renderCambio = (viejo, nuevo) => {
    const pv = Number(viejo);
    const pn = Number(nuevo);
    if (!(pv > 0)) {
      return <span className="cat_change_dash">—</span>;
    }
    const diff = pn - pv;
    const pct = (diff / pv) * 100;
    const sign = diff >= 0 ? '+' : '';
    const isUp = diff > 0;
    const isDown = diff < 0;

    return (
      <span className={`cat_change ${isUp ? 'cat_change_up' : ''} ${isDown ? 'cat_change_down' : ''}`}>
        <FontAwesomeIcon icon={isUp ? faArrowTrendUp : faArrowTrendDown} className="cat_change_icon" />
        {sign}{pct.toFixed(1)}%
      </span>
    );
  };

  return (
    <div className="cat_page">
      <div className="cat_card">
        <header className="cat_header">
          <h2 className="cat_title">Categorías</h2>
        </header>

        <div className="cat_list">
          <div className="cat_list_head">
            <div className="cat_col cat_col_name cat_head_cell">Nombre</div>
            <div className="cat_col cat_col_amount cat_head_cell cat_center">Monto mensual</div>
            <div className="cat_col cat_col_amount cat_head_cell cat_center">Monto anual</div>
            <div className="cat_col cat_col_actions cat_head_cell cat_right">Acciones</div>
          </div>

          {loading ? (
            <>
              {[...Array(3)].map((_, i) => (
                <div key={i} className="cat_row cat_row_skeleton">
                  <span className="cat_skel cat_skel_text" />
                  <span className="cat_skel cat_skel_text cat_skel_short" />
                  <span className="cat_skel cat_skel_text cat_skel_short" />
                  <span className="cat_skel cat_skel_icon" />
                </div>
              ))}
            </>
          ) : filtradas.length === 0 ? (
            <div className="cat_empty">No hay categorías para mostrar.</div>
          ) : (
            filtradas.map((c, index) => (
              <div
                key={c.idCategoria}
                className="cat_row"
                style={{ animationDelay: `${index * 0.06}s` }}
              >
                <div className="cat_cell cat_col_name">{c.nombre}</div>
                <div className="cat_cell cat_col_amount cat_center">{fmtARS(c.montoMensual)}</div>
                <div className="cat_cell cat_col_amount cat_center">{fmtARS(c.montoAnual)}</div>
                <div className="cat_cell cat_col_actions cat_right">
                  <button
                    className="cat_icon_btn"
                    onClick={() => navigate(`/categorias/editar/${c.idCategoria}`, { state: { categoria: c } })}
                    title="Editar"
                    aria-label={`Editar categoría ${c.nombre}`}
                  >
                    <FontAwesomeIcon icon={faEdit} />
                  </button>
                  <button
                    className="cat_icon_btn"
                    onClick={() => abrirHistorial(c)}
                    title="Historial"
                    aria-label={`Ver historial de ${c.nombre}`}
                  >
                    <FontAwesomeIcon icon={faClockRotateLeft} />
                  </button>
                  <button
                    className="cat_icon_btn cat_icon_btn_danger"
                    onClick={() => pedirConfirmacionEliminar(c)}
                    title="Eliminar"
                    aria-label={`Eliminar categoría ${c.nombre}`}
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <section className="cat_toolbar">
          <button
            className="cat_btn cat_btn_primary cat_btn_back"
            onClick={() => navigate('/panel')}
            title="Volver"
            aria-label="Volver"
          >
            <FontAwesomeIcon icon={faArrowLeft} />
            <span className="cat_btn_text">Volver</span>
          </button>

        <div className="cat_toolbar_spacer" />

          <button
            className="cat_btn cat_btn_outline"
            onClick={() => navigate('/categorias/nueva')}
          >
            <FontAwesomeIcon icon={faPlus} />
            <span className="cat_btn_text">Nueva</span>
          </button>
        </section>
      </div>

      {/* Modal Historial (solo se muestra cuando modalHistOpen === true) */}
      <Modal
        open={modalHistOpen}
        onClose={() => setModalHistOpen(false)}
        title={`Historial de precios · ${histCategoria.nombre || ''}`}
      >
        {histLoading ? (
          <div className="cat_hist_loading">Cargando historial…</div>
        ) : hist.length === 0 ? (
          <div className="cat_hist_empty">Sin cambios de precio registrados.</div>
        ) : (
          <div className="cat_hist_table_wrap">
            <table className="cat_hist_table">
              <thead>
                <tr>
                  <th className="cat_th_center">#</th>
                  <th className="cat_th_right">Precio viejo</th>
                  <th className="cat_th_right">Precio nuevo</th>
                  <th className="cat_th_center">Cambio</th>
                  <th className="cat_th_center">Fecha cambio</th>
                </tr>
              </thead>
              <tbody>
                {hist.map((h, i) => (
                  <tr key={h.id_historial || i}>
                    <td className="cat_td_center" data-label="#"> {h.id_historial} </td>
                    <td className="cat_td_right" data-label="Precio viejo">{fmtARS(h.precio_viejo)}</td>
                    <td className="cat_td_right" data-label="Precio nuevo">{fmtARS(h.precio_nuevo)}</td>
                    <td className="cat_td_center" data-label="Cambio">
                      {renderCambio(h.precio_viejo, h.precio_nuevo)}
                    </td>
                    <td className="cat_td_center" data-label="Fecha cambio">{h.fecha_cambio}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      {/* Modal Confirmar Eliminación */}
      <ConfirmDeleteModal
        open={delState.open}
        categoria={delState.cat}
        onConfirm={confirmarEliminar}
        onCancel={() => setDelState({ open: false, cat: null, loading: false })}
        loading={delState.loading}
      />

      {/* TOAST */}
      {toast.show && (
        <Toast
          tipo={toast.tipo}        // 'exito' | 'error' | 'info'
          mensaje={toast.mensaje}
          duracion={toast.duracion}
          onClose={closeToast}
        />
      )}
    </div>
  );
};

export default Categorias;
