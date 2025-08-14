import React, { useState, useEffect } from 'react';
import { FaExclamationTriangle } from 'react-icons/fa';
import './ModalDarBajaSocio.css';

const ModalDarBajaSocio = ({ socio, onClose, onDarBaja }) => {
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setMotivo('');
    setError('');
  }, [socio]);

  if (!socio) return null;

  const handleConfirmar = () => {
    const m = motivo.trim();
    if (!m) {
      setError('Por favor, ingresá un motivo.');
      return;
    }
    onDarBaja(socio.id_socio, m);
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

        <div className="soc-modal-form-group">
          <label className="soc-modal-label" htmlFor="motivo-baja">
            Motivo de la baja <span className="soc-required">*</span>
          </label>
          <textarea
            id="motivo-baja"
            className={`soc-modal-textarea ${error ? 'soc-input-error' : ''}`}
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
            className="soc-boton-cancelar-baja"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            className="soc-boton-confirmar-baja"
            onClick={handleConfirmar}
            disabled={!motivo.trim()}
            title={!motivo.trim() ? 'Ingresá un motivo' : 'Dar de baja'}
          >
            Dar de baja
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModalDarBajaSocio;