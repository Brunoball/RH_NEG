import React from 'react';
import { FaExclamationTriangle, FaTrash, FaTimes } from 'react-icons/fa';
import './ModalEliminarSocio.css';

const ModalEliminarSocio = ({ socio, onClose, onEliminar }) => {
  if (!socio) return null;

  return (
    <div className="soc-modal-overlay-eliminar">
      <div className="soc-modal-contenido-eliminar">
        <div className="soc-modal-icono-eliminar">
          <FaExclamationTriangle />
        </div>
        <h3 className="soc-modal-titulo-eliminar">Eliminar Socio Permanentemente</h3>
        <p className="soc-modal-texto-eliminar">
          ¿Estás seguro que deseas eliminar permanentemente al socio <strong>{socio.nombre}</strong>?
        </p>
        <div className="soc-modal-botones-eliminar">
          <button
            className="soc-boton-cancelar-eliminar"
            onClick={onClose}
          >
            <FaTimes /> Cancelar
          </button>
          <button
            className="soc-boton-confirmar-eliminar"
            onClick={() => onEliminar(socio.id_socio)}
          >
            <FaTrash /> Eliminar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModalEliminarSocio;