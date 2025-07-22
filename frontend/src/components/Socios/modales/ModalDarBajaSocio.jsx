import React from 'react';

const ModalDarBajaSocio = ({ socio, onClose, onDarBaja }) => {
  if (!socio) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-contenido">
        <h2>Dar de baja al socio</h2>
        <p>¿Estás seguro de que querés dar de baja a <strong>{socio.nombre}</strong>?</p>
        <div className="modal-botones">
          <button className="btn-cancelar" onClick={onClose}>Cancelar</button>
          <button className="btn-confirmar" onClick={() => onDarBaja(socio.id_socio)}>Dar de baja</button>
        </div>
      </div>
    </div>
  );
};

export default ModalDarBajaSocio;
