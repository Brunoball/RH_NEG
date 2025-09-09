// src/components/Categorias/EditarCategoria.jsx
import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import BASE_URL from '../../config/config';
import Toast from '../Global/Toast';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faSave } from '@fortawesome/free-solid-svg-icons';
import './EditarCategoria.css';

const EditarCategoria = () => {
  const navigate = useNavigate();
  const { id } = useParams(); // /categorias/editar/:id
  const location = useLocation();
  const fromState = location?.state?.categoria || null;

  const [form, setForm] = useState({
    idCategoria: fromState?.idCategoria || Number(id),
    nombre: fromState?.nombre || '',
    montoMensual: fromState?.montoMensual ?? '',
    montoAnual: fromState?.montoAnual ?? '',
  });
  const [cargando, setCargando] = useState(!fromState);
  const [guardando, setGuardando] = useState(false);
  const [toast, setToast] = useState({ show: false, tipo: 'exito', mensaje: '' });
  const nombreRef = useRef(null);

  const api = (action) => `${BASE_URL}/api.php?action=${action}`;
  const showToast = (tipo, mensaje, duracion = 2800) => {
    setToast({ show: true, tipo, mensaje, duracion });
    setTimeout(() => setToast({ show: false, tipo, mensaje: '' }), duracion);
  };
  const toUpper = (v) => (v ?? '').toString().toLocaleUpperCase('es-AR');

  // Si entran directo por URL sin state, obtenemos por id (si el backend lo soporta)
  useEffect(() => {
    const fetchById = async () => {
      try {
        setCargando(true);
        const r = await fetch(api('categorias_obtener'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idCategoria: Number(id) }),
        });
        const data = await r.json();
        if (data?.ok && data?.categoria) {
          const c = data.categoria;
          setForm({
            idCategoria: c.idCategoria,
            nombre: toUpper(c.nombre || ''),
            montoMensual: c.montoMensual ?? '',
            montoAnual: c.montoAnual ?? '',
          });
        } else {
          showToast('error', 'No se pudo obtener la categoría.');
          navigate('/categorias', { replace: true });
        }
      } catch (e) {
        console.error(e);
        showToast('error', 'No se pudo obtener la categoría.');
        navigate('/categorias', { replace: true });
      } finally {
        setCargando(false);
      }
    };

    if (!fromState) fetchById();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const onGuardar = async (e) => {
    e?.preventDefault?.();
    if (!form.nombre.trim()) return showToast('error', 'El nombre es obligatorio.');
    const mMensual = Number(form.montoMensual);
    const mAnual = Number(form.montoAnual);
    if (Number.isNaN(mMensual) || mMensual < 0) return showToast('error', 'Monto mensual inválido.');
    if (Number.isNaN(mAnual) || mAnual < 0) return showToast('error', 'Monto anual inválido.');

    try {
      setGuardando(true);
      const r = await fetch(api('categorias_actualizar'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idCategoria: form.idCategoria,
          nombre: toUpper(form.nombre).trim(),
          montoMensual: parseInt(mMensual, 10),
          montoAnual: parseInt(mAnual, 10),
        }),
      });
      const data = await r.json();
      if (!data?.ok) throw new Error(data?.mensaje || 'Error al guardar');
      showToast('exito', 'Categoría actualizada.');
      navigate('/categorias', { replace: true });
    } catch (e) {
      console.error(e);
      showToast('error', 'No se pudo guardar la categoría.');
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) {
    return (
      <div className="cat_edi_page">
        <div className="cat_edi_card">
          <header className="cat_edi_header">
            <h2 className="cat_edi_title">Editar categoría</h2>
            <button
              className="cat_edi_btn cat_edi_btn_primary cat_edi_btn_back"
              onClick={() => navigate('/categorias')}
              title="Volver"
              aria-label="Volver"
            >
              <FontAwesomeIcon icon={faArrowLeft} />
              <span className="cat_edi_btn_text">Volver</span>
            </button>
          </header>
          <div className="cat_edi_loading">Cargando…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="cat_edi_page">
      <div className="cat_edi_card">
        <header className="cat_edi_header">
          <h2 className="cat_edi_title">Editar categoría</h2>
          <button
            className="cat_edi_btn cat_edi_btn_primary cat_edi_btn_back"
            onClick={() => navigate('/categorias')}
            title="Volver"
            aria-label="Volver"
          >
            <FontAwesomeIcon icon={faArrowLeft} />
            <span className="cat_edi_btn_text">Volver</span>
          </button>
        </header>

        <form className="cat_edi_form" onSubmit={onGuardar}>
          <div className="cat_edi_form_row">
            <label className="cat_edi_label">Nombre</label>
            <input
              ref={nombreRef}
              className="cat_edi_input"
              type="text"
              value={form.nombre}
              onChange={(e) => setForm((f) => ({ ...f, nombre: toUpper(e.target.value) }))}
              placeholder='Ej: "A", "B", "INTERNO"'
              maxLength={50}
              required
              style={{ textTransform: 'uppercase' }}
            />
          </div>

          <div className="cat_edi_form_grid">
            <div className="cat_edi_form_row">
              <label className="cat_edi_label">Monto mensual</label>
              <input
                className="cat_edi_input"
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
            <div className="cat_edi_form_row">
              <label className="cat_edi_label">Monto anual</label>
              <input
                className="cat_edi_input"
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

          <div className="cat_edi_form_actions">
            {/* Solo botón Guardar */}
            <button type="submit" className="cat_edi_btn cat_edi_btn_primary" disabled={guardando}>
              <FontAwesomeIcon icon={faSave} />
              <span className="cat_edi_btn_text">{guardando ? 'Guardando…' : 'Guardar'}</span>
            </button>
          </div>
        </form>
      </div>

      {toast.show && <Toast tipo={toast.tipo} mensaje={toast.mensaje} />}
    </div>
  );
};

export default EditarCategoria;
