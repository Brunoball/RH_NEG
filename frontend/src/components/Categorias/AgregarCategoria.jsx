// src/components/Categorias/AgregarCategoria.jsx
import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BASE_URL from '../../config/config';
import Toast from '../Global/Toast';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faSave } from '@fortawesome/free-solid-svg-icons';
import './AgregarCategoria.css';

const AgregarCategoria = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ nombre: '', montoMensual: '', montoAnual: '' });
  const [guardando, setGuardando] = useState(false);
  const [toast, setToast] = useState({ show: false, tipo: 'exito', mensaje: '' });
  const nombreRef = useRef(null);

  const api = (action) => `${BASE_URL}/api.php?action=${action}`;
  const showToast = (tipo, mensaje, duracion = 2800) => {
    setToast({ show: true, tipo, mensaje, duracion });
    setTimeout(() => setToast({ show: false, tipo, mensaje: '' }), duracion);
  };
  const toUpper = (v) => (v ?? '').toString().toLocaleUpperCase('es-AR');

  const onGuardar = async (e) => {
    e?.preventDefault?.();
    if (!form.nombre.trim()) return showToast('error', 'El nombre es obligatorio.');
    const mMensual = Number(form.montoMensual);
    const mAnual = Number(form.montoAnual);
    if (Number.isNaN(mMensual) || mMensual < 0) return showToast('error', 'Monto mensual inválido.');
    if (Number.isNaN(mAnual) || mAnual < 0) return showToast('error', 'Monto anual inválido.');

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
      const data = await r.json();
      if (!data?.ok) throw new Error(data?.mensaje || 'Error al guardar');
      showToast('exito', 'Categoría creada.');
      navigate('/categorias', { replace: true });
    } catch (e) {
      console.error(e);
      showToast('error', 'No se pudo guardar la categoría.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="cat_agr_page">
      <div className="cat_agr_card">
        <header className="cat_agr_header">
          <h2 className="cat_agr_title">Nueva categoría</h2>

          <button
            className="cat_agr_btn cat_agr_btn_primary cat_agr_btn_back"
            onClick={() => navigate('/categorias')}
            title="Volver"
            aria-label="Volver"
          >
            <FontAwesomeIcon icon={faArrowLeft} />
            <span className="cat_agr_btn_text">Volver</span>
          </button>
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
              placeholder='Ej: "A", "B", "INTERNO"'
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
              />
            </div>
          </div>

          <div className="cat_agr_form_actions">
            {/* Solo botón Agregar */}
            <button type="submit" className="cat_agr_btn cat_agr_btn_primary" disabled={guardando}>
              <FontAwesomeIcon icon={faSave} />
              <span className="cat_agr_btn_text">{guardando ? 'Guardando...' : 'Agregar'}</span>
            </button>
          </div>
        </form>
      </div>

      {toast.show && <Toast tipo={toast.tipo} mensaje={toast.mensaje} />}
    </div>
  );
};

export default AgregarCategoria;
