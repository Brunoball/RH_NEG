// src/components/Familias/ModalFamilia.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { FaTimes, FaSave, FaEdit, FaPlus } from 'react-icons/fa';
import './ModalFamilia.css';

export default function ModalFamilia({ open, onClose, familia, onSave }) {
  const [nombre, setNombre] = useState('');
  const [obs, setObs] = useState('');
  const [activo, setActivo] = useState(true);

  const isEdit = !!familia;

  useEffect(() => {
    if (!open) return;
    setNombre((familia?.nombre_familia || '').toString().toUpperCase());
    setObs((familia?.observaciones || '').toString().toUpperCase());
    setActivo((familia?.activo ?? 1) === 1);
  }, [open, familia]);

  const handleGuardar = useCallback(() => {
    onSave?.({
      id_familia: familia?.id_familia ?? null,
      nombre_familia: nombre.trim(),
      observaciones: obs.trim(),
      activo: activo ? 1 : 0,
    });
  }, [onSave, familia, nombre, obs, activo]);

  // Esc = cerrar, Ctrl/Cmd+Enter = guardar
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleGuardar();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose, handleGuardar]);

  if (!open) return null;

  const handleNombre = (e) => setNombre(e.target.value.toUpperCase());
  const handleObs = (e) => setObs(e.target.value.toUpperCase());

  const titleId = 'modalfa_title';

  return (
    <div
      className="modalfa-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        className={`modalfa-modal ${isEdit ? 'modalfa-mode-edit' : 'modalfa-mode-new'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modalfa-head">
          <h3 id={titleId} className="modalfa-title">
            <span className="modalfa-titleicon" aria-hidden="true">
              {isEdit ? <FaEdit /> : <FaPlus />}
            </span>
            {isEdit ? 'Editar familia' : 'Nueva familia'}
          </h3>
          <button className="modalfa-close" onClick={onClose} aria-label="Cerrar">
            <FaTimes />
          </button>
        </div>

        <div className="modalfa-body">
          <label htmlFor="modalfa_nombre" className="modalfa-label">Apellido *</label>
          <input
            id="modalfa_nombre"
            className="modalfa-input modalfa-uppercase"
            value={nombre}
            onChange={handleNombre}
            maxLength={120}
            autoFocus
          />

          <label htmlFor="modalfa_obs" className="modalfa-label">Observaciones</label>
          <textarea
            id="modalfa_obs"
            className="modalfa-textarea modalfa-uppercase"
            rows={3}
            value={obs}
            onChange={handleObs}
          />

          {/* Switch moderno para Activo */}
          <label className="modalfa-switch">
            <input
              type="checkbox"
              checked={activo}
              onChange={(e) => setActivo(e.target.checked)}
            />
            <span className="modalfa-switch-track">
              <span className="modalfa-switch-thumb" />
            </span>
            <span className="modalfa-switch-label">Activo</span>
          </label>
        </div>

        <div className="modalfa-foot">
          <button onClick={onClose} className="modalfa-btn modalfa-ghost">Cancelar</button>
          <button onClick={handleGuardar} className="modalfa-btn modalfa-solid">
            <FaSave /> Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
