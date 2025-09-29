// src/components/Categorias/AgregarCategoria.jsx
import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BASE_URL from '../../config/config';
import Toast from '../Global/Toast';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faSave } from '@fortawesome/free-solid-svg-icons';
import './AgregarCategoria.css';

// 🔧 Límites configurables
const MAX_MENSUAL = 200000;  // cambiá acá el tope mensual permitido
const MAX_ANUAL   = 2000000; // cambiá acá el tope anual permitido

const AgregarCategoria = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ nombre: '', montoMensual: '', montoAnual: '' });
  const [guardando, setGuardando] = useState(false);

  // ===== TOAST =====
  const [toast, setToast] = useState({
    show: false,
    tipo: 'exito',
    mensaje: '',
    duracion: 3000,
  });
  const showToast = (tipo, mensaje, duracion = 3000) => {
    setToast({ show: true, tipo, mensaje, duracion });
  };
  const closeToast = () => setToast((t) => ({ ...t, show: false }));

  const nombreRef = useRef(null);

  const api = (action) => `${BASE_URL}/api.php?action=${action}`;
  const toUpper = (v) => (v ?? '').toString().toLocaleUpperCase('es-AR');

  const onGuardar = async (e) => {
    e?.preventDefault?.();
    if (!form.nombre.trim()) return showToast('error', 'El nombre es obligatorio.', 2800);

    const mMensual = Number(form.montoMensual);
    const mAnual = Number(form.montoAnual);

    if (Number.isNaN(mMensual) || mMensual < 0) return showToast('error', 'Monto mensual inválido.', 2800);
    if (Number.isNaN(mAnual) || mAnual < 0) return showToast('error', 'Monto anual inválido.', 2800);

    // 🔴 Chequeo de límites (frontend)
    if (mMensual > MAX_MENSUAL) {
      return showToast('error', `El monto mensual no puede ser mayor a ${MAX_MENSUAL.toLocaleString('es-AR')}.`, 3200);
    }
    if (mAnual > MAX_ANUAL) {
      return showToast('error', `El monto anual no puede ser mayor a ${MAX_ANUAL.toLocaleString('es-AR')}.`, 3200);
    }

    try {
      setGuardando(true);
      const r = await fetch(api('categorias_guardar'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: toUpper(form.nombre).trim(),
          montoMensual: parseInt(mMensual, 10),
          montoAnual: parseInt(mAnual, 10),
        }),
      });

      // Si backend avisa error específico, lo mostramos tal cual
      if (!r.ok) {
        let msg = 'No se pudo guardar la categoría.';
        try {
          const err = await r.json();
          if (err?.mensaje) msg = err.mensaje;
        } catch {}
        showToast('error', msg, 3200);
        return;
      }

      const data = await r.json();
      if (!data?.ok) {
        return showToast('error', data?.mensaje || 'No se pudo guardar la categoría.', 3200);
      }

      const dur = 2500;
      showToast('exito', 'Categoría creada.', dur);
      setTimeout(() => navigate('/categorias', { replace: true }), dur);
    } catch (e) {
      console.error(e);
      showToast('error', 'No se pudo guardar la categoría.', 3000);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="cat_agr_page">
      <div className="cat_agr_card">
        <header className="cat_agr_header">
          <h2 className="cat_agr_title">Nueva categoría</h2>
        </header>

        <form className="cat_agr_form" onSubmit={onGuardar}>
          <div className="cat_agr_form_row">
            <label className="cat_agr_label">Nombre</label>
            <input
              ref={nombreRef}
              className="cat_agr_input"
              type="text"
              value={form.nombre}
              onChange={(e) => setForm((f) => ({ ...f, nombre: toUpper(e.target.value) }))}
              placeholder='Ej: "A", "B" '
              maxLength={50}
              required
              style={{ textTransform: 'uppercase' }}
            />
          </div>

          <div className="cat_agr_form_grid">
            <div className="cat_agr_form_row">
              <label className="cat_agr_label">Monto mensual</label>
              <input
                className="cat_agr_input"
                type="number"
                inputMode="numeric"
                value={form.montoMensual}
                onChange={(e) => setForm((f) => ({ ...f, montoMensual: e.target.value }))}
                placeholder="0"
                min="0"
                step="1"
                required
                max={MAX_MENSUAL}
                title={`Máximo permitido: ${MAX_MENSUAL.toLocaleString('es-AR')}`}
              />
            </div>
            <div className="cat_agr_form_row">
              <label className="cat_agr_label">Monto anual</label>
              <input
                className="cat_agr_input"
                type="number"
                inputMode="numeric"
                value={form.montoAnual}
                onChange={(e) => setForm((f) => ({ ...f, montoAnual: e.target.value }))}
                placeholder="0"
                min="0"
                step="1"
                required
                max={MAX_ANUAL}
                title={`Máximo permitido: ${MAX_ANUAL.toLocaleString('es-AR')}`}
              />
            </div>
          </div>

          <div className="cat_agr_form_actions">
            <button
              type="button"
              className="cat_agr_btn cat_agr_btn_primary cat_agr_btn_back"
              onClick={() => navigate('/categorias')}
              title="Volver"
              aria-label="Volver"
              disabled={guardando}
            >
              <FontAwesomeIcon icon={faArrowLeft} />
              <span className="cat_agr_btn_text">Volver</span>
            </button>

            <button type="submit" className="cat_agr_btn cat_agr_btn_primary" disabled={guardando}>
              <FontAwesomeIcon icon={faSave} />
              <span className="cat_agr_btn_text">{guardando ? 'Agregar' : 'Agregar'}</span>
            </button>
          </div>
        </form>
      </div>

      {toast.show && (
        <Toast
          tipo={toast.tipo}
          mensaje={toast.mensaje}
          duracion={toast.duracion}
          onClose={closeToast}
        />
      )}
    </div>
  );
};

export default AgregarCategoria;
