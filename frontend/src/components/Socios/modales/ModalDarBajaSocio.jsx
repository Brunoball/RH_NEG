import React, { useState, useEffect, useRef } from 'react';
import { FaExclamationTriangle } from 'react-icons/fa';
import './ModalDarBajaSocio.css';

const TZ = 'America/Argentina/Cordoba';

const hoyISO = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

const ModalDarBajaSocio = ({ socio, onClose, onDarBaja }) => {
  const [motivo, setMotivo] = useState('');
  const [fechaBaja, setFechaBaja] = useState(hoyISO());
  const [error, setError] = useState('');

  const fechaBajaRef = useRef(null);

  useEffect(() => {
    setMotivo('');
    setFechaBaja(hoyISO());
    setError('');
  }, [socio]);

  if (!socio) return null;

  const abrirCalendario = () => {
    const input = fechaBajaRef.current;
    if (!input) return;

    input.focus({ preventScroll: true });

    try {
      if (typeof input.showPicker === 'function') {
        input.showPicker();
      } else {
        input.click();
      }
    } catch {
      input.click();
    }
  };

  const handleConfirmar = () => {
    const m = motivo.trim();

    if (!fechaBaja || !/^\d{4}-\d{2}-\d{2}$/.test(fechaBaja)) {
      setError('Por favor, seleccioná una fecha de baja válida.');
      return;
    }

    if (!m) {
      setError('Por favor, ingresá un motivo.');
      return;
    }

    onDarBaja(socio.id_socio, m, fechaBaja);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') onClose();
  };

  return (
    <div className="soc-modal-overlay-baja" onKeyDown={handleKeyDown} tabIndex={-1}>
      <div className="soc-modal-contenido-baja">
        <div className="soc-modal-icono-baja">
          <FaExclamationTriangle />
        </div>

        <h3 className="soc-modal-titulo-baja">Dar de baja al socio</h3>

        <p className="soc-modal-texto-baja">
          ¿Estás seguro de que querés dar de baja a <strong>{socio.nombre}</strong>?
        </p>

        <div
          className="soc-modal-form-group"
          onPointerDown={(e) => {
            e.preventDefault();
            abrirCalendario();
          }}
        >
          <label className="soc-modal-label" htmlFor="fecha-baja">
            Fecha de baja <span className="soc-required">*</span>
          </label>

          <input
            ref={fechaBajaRef}
            id="fecha-baja"
            type="date"
            className={`soc-modal-input ${error && !fechaBaja ? 'soc-input-error' : ''}`}
            value={fechaBaja}
            onChange={(e) => {
              setFechaBaja(e.target.value);
              if (error) setError('');
            }}
          />
        </div>

        <div className="soc-modal-form-group">
          <label className="soc-modal-label" htmlFor="motivo-baja">
            Motivo de la baja <span className="soc-required">*</span>
          </label>

          <textarea
            id="motivo-baja"
            className={`soc-modal-textarea ${error && !motivo.trim() ? 'soc-input-error' : ''}`}
            placeholder="Escribí el motivo de la baja..."
            value={motivo}
            onChange={(e) => {
              setMotivo(e.target.value);
              if (error) setError('');
            }}
            rows={4}
          />

          {error && <div className="soc-modal-error">{error}</div>}
        </div>

        <div className="soc-modal-botones-baja">
          <button
            type="button"
            className="soc-boton-cancelar-baja"
            onClick={onClose}
          >
            Cancelar
          </button>

          <button
            type="button"
            className="soc-boton-confirmar-baja"
            onClick={handleConfirmar}
            disabled={!motivo.trim() || !fechaBaja}
            title={!motivo.trim() || !fechaBaja ? 'Completá fecha y motivo' : 'Dar de baja'}
          >
            Dar de baja
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModalDarBajaSocio;