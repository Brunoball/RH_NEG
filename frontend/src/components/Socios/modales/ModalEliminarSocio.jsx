import React from 'react';

const ModalEliminarSocio = ({ socio, onClose, onEliminar }) => {
  if (!socio) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-contenido">
        <h3>¿Deseás eliminar a {socio.nombre}?</h3>
        <p>Esta acción no se puede deshacer.</p>
        <div className="botones-modal">
          <button className="btn-cancelar" onClick={onClose}>Cancelar</button>
          <button className="btn-aceptar" onClick={() => onEliminar(socio.id_socio)}>Eliminar</button>
        </div>
      </div>
    </div>
  );
};

export default ModalEliminarSocio;
