import React, { useState, useEffect } from 'react';
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
    <div className="modal-overlay" onKeyDown={handleKeyDown} tabIndex={-1}>
      <div className="modal-contenido">
        <h2>Dar de baja al socio</h2>
        <p>
          ¿Estás seguro de que querés dar de baja a <strong>{socio.nombre}</strong>?
        </p>

        <label className="modal-label" htmlFor="motivo-baja">
          Motivo de la baja <span style={{color: 'red'}}>*</span>
        </label>
        <textarea
          id="motivo-baja"
          className="modal-textarea"
          placeholder="Escribí el motivo de la baja..."
          value={motivo}
          onChange={(e) => {
            setMotivo(e.target.value);
            if (error) setError('');
          }}
          rows={4}
        />

        {error && <div className="modal-error">{error}</div>}

        <div className="modal-botones">
          <button className="btn-cancelar" onClick={onClose}>Cancelar</button>
          <button
            className="btn-confirmar"
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
