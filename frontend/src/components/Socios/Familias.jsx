// src/components/Familias/Familias.jsx
import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import BASE_URL from '../../config/config';
import {
  FaArrowLeft, FaPlus, FaTrash, FaEdit, FaUsers,
  FaLink, FaSearch, FaFileExport, FaTimes
} from 'react-icons/fa';
import Toast from '../Global/Toast';
import './Familias.css';
import ModalFamilia from './modales/ModalFamilia';
import ModalMiembros from './modales/ModalMiembros';

/* ========= Modal de eliminación (usa checklist de ModalMiembros) ========= */
function ConfirmDeleteFamiliaModal({ open, familia, isDeleting, onConfirm, onCancel, notify }) {
  const [forzar, setForzar] = useState(false);

  useEffect(() => { if (open) setForzar(false); }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel?.();
      if (e.key === 'Enter') {
        if (!forzar) {
          notify?.('Debes aceptar el “Forzar borrado” para continuar.', 'error');
          return;
        }
        onConfirm?.(forzar);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, forzar, onConfirm, onCancel, notify]);

  if (!open) return null;

  const handleConfirmClick = () => {
    if (!forzar) {
      notify?.('Debes aceptar el “Forzar borrado” para continuar.', 'error');
      return;
    }
    onConfirm?.(forzar);
  };

  return (
    <div
      className="famdel-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="famdel-modal-title"
      onClick={onCancel}
    >
      <div
        className="famdel-modal-container famdel-modal--danger"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="famdel-modal__icon" aria-hidden="true">
          <FaTrash />
        </div>

        <h3 id="famdel-modal-title" className="famdel-modal-title famdel-modal-title--danger">
          Eliminar familia
        </h3>

        <p className="famdel-modal-text">
          ¿Estás seguro de eliminar la familia <strong>“{familia?.nombre_familia || '—'}”</strong>?
        </p>

        {/* Checklist igual al de ModalMiembros */}
        <label
          className={`modalmi-selectable famdel-check-mini ${forzar ? 'is-checked' : ''}`}
          title="Forzar borrado"
        >
          <input
            type="checkbox"
            checked={forzar}
            onChange={(e) => setForzar(e.target.checked)}
            disabled={isDeleting}
          />
          <div className="modalmi-checkslot" aria-hidden="true" />
          <span className="famdel-check-mini-text">
            Forzar borrado (desvincula socios y elimina la familia)
          </span>
        </label>

        <div className="famdel-modal-buttons">
          <button className="famdel-btn famdel-btn--ghost" onClick={onCancel} disabled={isDeleting}>
            Cancelar
          </button>
          <button
            className="famdel-btn famdel-btn--solid-danger"
            onClick={handleConfirmClick}
            disabled={isDeleting}
          >
            {isDeleting ? 'Eliminando…' : 'Eliminar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Familias() {
  const navigate = useNavigate();

  const [familias, setFamilias] = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [toast, setToast] = useState({ mostrar: false, tipo: '', mensaje: '' });

  const [modalFamiliaOpen, setModalFamiliaOpen] = useState(false);
  const [editFamilia, setEditFamilia] = useState(null);

  const [modalMiembrosOpen, setModalMiembrosOpen] = useState(false);
  const [familiaSeleccionada, setFamiliaSeleccionada] = useState(null);

  // Modal de eliminar
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Ref buscador
  const searchRef = useRef(null);

  const showToast = useCallback((mensaje, tipo = 'exito') => {
    setToast({ mostrar: true, tipo, mensaje });
  }, []);

  const cargarFamilias = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${BASE_URL}/api.php?action=familias_listar&ts=${Date.now()}`, { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      if (j?.exito) setFamilias(j.familias || []);
      else { showToast(j?.mensaje || 'No se pudieron obtener familias', 'error'); setFamilias([]); }
    } catch {
      showToast('Error de red al obtener familias', 'error');
      setFamilias([]);
    } finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { cargarFamilias(); }, [cargarFamilias]);

  const fmtFechaSolo = (val) => {
    if (!val) return '—';
    const s = String(val).trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) { const [, y, mo, d] = m; return `${d}/${mo}/${y}`; }
    try {
      const d = new Date(s.replace(' ', 'T'));
      if (isNaN(d.getTime())) return s;
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yy = d.getFullYear();
      return `${dd}/${mm}/${yy}`;
    } catch { return s; }
  };

  const toUpperSafe = (x) => (x ?? '').toString().toUpperCase();
  const initial = (name = '') => toUpperSafe(name).trim().charAt(0) || 'F';

  const filtradas = useMemo(() => {
    if (!q.trim()) return familias;
    const t = q.trim().toLowerCase();
    return familias.filter(
      f =>
        (f.nombre_familia || '').toLowerCase().includes(t) ||
        (f.observaciones || '').toLowerCase().includes(t)
    );
  }, [familias, q]);

  const onGuardarFamilia = async (payload) => {
    try {
      const payloadUC = {
        ...payload,
        nombre_familia: toUpperSafe(payload?.nombre_familia),
        observaciones: toUpperSafe(payload?.observaciones),
      };
      const r = await fetch(`${BASE_URL}/api.php?action=familia_guardar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadUC),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      if (j?.exito) {
        showToast(j.mensaje || 'Guardado', 'exito');
        setModalFamiliaOpen(false);
        setEditFamilia(null);
        cargarFamilias();
      } else {
        showToast(j?.mensaje || 'No se pudo guardar', 'error');
      }
    } catch {
      showToast('Error al guardar familia', 'error');
    }
  };

  // Abrir modal de eliminación
  const requestDeleteFamilia = (f) => { setDeleteTarget(f); setDeleteOpen(true); };

  // Confirmar desde modal
  const confirmDeleteFamilia = useCallback(async (forzar) => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const r = await fetch(`${BASE_URL}/api.php?action=familia_eliminar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_familia: deleteTarget.id_familia, forzar: forzar ? 1 : 0 }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      if (j?.exito) {
        showToast(j.mensaje || 'Eliminada', 'exito');
        setFamilias(prev => prev.filter(x => String(x.id_familia) !== String(deleteTarget.id_familia)));
        if (familiaSeleccionada?.id_familia === deleteTarget.id_familia) {
          setModalMiembrosOpen(false);
          setFamiliaSeleccionada(null);
        }
        setDeleteOpen(false);
        setDeleteTarget(null);
      } else {
        showToast(j?.mensaje || 'No se pudo eliminar', 'error');
      }
    } catch {
      showToast('Error al eliminar familia', 'error');
    } finally { setIsDeleting(false); }
  }, [deleteTarget, familiaSeleccionada, showToast]);

  const abrirMiembros = (f) => { setFamiliaSeleccionada(f); setModalMiembrosOpen(true); };

  const onDeltaCounts = useCallback(({ id_familia, deltaActivos = 0, deltaTotales = 0 }) => {
    setFamilias(prev =>
      prev.map(f => {
        if (String(f.id_familia) !== String(id_familia)) return f;
        return {
          ...f,
          miembros_activos: (Number(f.miembros_activos) || 0) + deltaActivos,
          miembros_totales: (Number(f.miembros_totales) || 0) + deltaTotales,
        };
      })
    );
    setFamiliaSeleccionada(prev => {
      if (!prev || String(prev.id_familia) !== String(id_familia)) return prev;
      return {
        ...prev,
        miembros_activos: (Number(prev.miembros_activos) || 0) + deltaActivos,
        miembros_totales: (Number(prev.miembros_totales) || 0) + deltaTotales,
      };
    });
  }, []);

  // Buscador (lupa ↔ cruz + ESC)
  const handleSearchIcon = useCallback(() => {
    if (!q.trim()) { searchRef.current?.focus(); return; }
    setQ(''); searchRef.current?.focus();
  }, [q]);
  const onSearchKeyDown = useCallback((e) => {
    if (e.key === 'Escape' && q) { e.preventDefault(); e.stopPropagation(); setQ(''); }
  }, [q]);

  // Volver: historial si existe; fallback a /panel
  const navigateBack = useCallback(() => {
    if (window.history.state && window.history.state.idx > 0) navigate(-1);
    else navigate('/panel');
  }, [navigate]);

  return (
    <div className="ntg-page">
      {/* TOP BAR (Título | Buscador | Volver) */}
      <header className="ntg-topbar">
        <h1 className="ntg-title">Gestión de familia</h1>

        <div className={`ntg-search ${q ? 'is-filled' : ''}`} role="search">
          <input
            ref={searchRef}
            placeholder="Buscar familia..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onSearchKeyDown}
            aria-label="Buscar familia"
          />
          <button
            className="ntg-search-ico"
            onClick={handleSearchIcon}
            aria-label={q ? 'Limpiar búsqueda' : 'Buscar'}
            title={q ? 'Limpiar' : 'Buscar'}
            type="button"
          >
            {q ? <FaTimes /> : <FaSearch />}
          </button>
        </div>

        <button className="ntg-back" onClick={navigateBack}>
          <FaArrowLeft /> Volver
        </button>
      </header>

      {/* CONTENT CARD */}
      <main className="ntg-content">
        {toast.mostrar && (
          <Toast
            tipo={toast.tipo}
            mensaje={toast.mensaje}
            onClose={() => setToast({ mostrar: false, tipo: '', mensaje: '' })}
            duracion={2400}
          />
        )}

        <div className="card">
          <div className="card-tabs">
            <div className="tabs">
              <button className="tab active"><FaUsers /> Familias</button>
            </div>

            <div className="actions">
              <button
                className="btn btn-add"
                onClick={() => { setEditFamilia(null); setModalFamiliaOpen(true); }}
              >
                <FaPlus /> Añadir Familia
              </button>

              <button
                className="btn btn-export"
                onClick={() => showToast('Exportar a Excel (pendiente)')}
              >
                <FaFileExport /> Exportar (Excel)
              </button>
            </div>
          </div>

          <h2 className="card-title">Grupos Familiares</h2>

          <div className="ntg-table">
            <div className="t-head">
              <div>Familia</div>
              <div className="hide-sm">Observaciones</div>
              <div className="center">Fecha alta</div>
              <div className="center">Estado</div>
              <div className="center">Operación</div>
              {/* Columna Acción eliminada */}
            </div>

            <div className="t-body">
              {loading ? (
                <div className="t-empty">Cargando…</div>
              ) : filtradas.length === 0 ? (
                <div className="t-empty">Sin resultados</div>
              ) : (
                filtradas.map((f) => {
                  const apellido = toUpperSafe(f.nombre_familia);
                  const obs = toUpperSafe(f.observaciones);
                  const activo = Number(f.miembros_activos) > 0;

                  return (
                    <div key={f.id_familia} className="t-row">
                      <div className="cell-name" title={apellido}>
                        <div className="avatar">{initial(apellido)}</div>
                        <div className="name">{apellido}</div>
                      </div>

                      <div className="hide-sm cell-obs" title={obs}>
                        {obs && obs.length > 64 ? `${obs.slice(0, 64)}…` : (obs || '—')}
                      </div>

                      <div className="center" title={f.fecha_alta || f.creado_en || ''}>
                        {f.fecha_alta ? f.fecha_alta : fmtFechaSolo(f.creado_en)}
                      </div>

                      <div className="center">
                        <span className={`badge ${activo ? 'ok' : 'off'}`}>
                          {activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>

                      <div className="cell-ops center">
                        <button
                          title="Gestionar miembros"
                          className="icon-btn icon-btn--link"
                          onClick={() => abrirMiembros(f)}
                        >
                          <FaLink />
                        </button>
                        <button
                          title="Editar"
                          className="icon-btn icon-btn--edit"
                          onClick={() => { setEditFamilia(f); setModalFamiliaOpen(true); }}
                        >
                          <FaEdit />
                        </button>
                        <button
                          title="Eliminar"
                          className="icon-btn danger"
                          onClick={() => requestDeleteFamilia(f)}
                        >
                          <FaTrash />
                        </button>
                      </div>

                      {/* Columna Acción eliminada */}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Modales */}
      <ModalFamilia
        open={modalFamiliaOpen}
        familia={editFamilia}
        onClose={() => { setModalFamiliaOpen(false); setEditFamilia(null); }}
        onSave={onGuardarFamilia}
      />
      <ModalMiembros
        open={modalMiembrosOpen}
        familia={familiaSeleccionada}
        onClose={() => { setModalMiembrosOpen(false); setFamiliaSeleccionada(null); }}
        notify={showToast}
        onDeltaCounts={onDeltaCounts}
      />

      {/* Modal eliminar familia */}
      <ConfirmDeleteFamiliaModal
        open={deleteOpen}
        familia={deleteTarget}
        isDeleting={isDeleting}
        onCancel={() => !isDeleting && setDeleteOpen(false)}
        onConfirm={confirmDeleteFamilia}
        notify={showToast}
      />
    </div>
  );
}
