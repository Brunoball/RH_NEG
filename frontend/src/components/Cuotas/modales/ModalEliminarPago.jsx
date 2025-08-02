import React from 'react';
import BASE_URL from '../../../config/config';
import './ModalEliminarPago.css';

const ModalEliminarPago = ({ socio, periodo, onClose, onEliminado }) => {
  const handleEliminar = async () => {
    try {
      const res = await fetch(`${BASE_URL}/api.php?action=eliminar_pago`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_socio: socio.id_socio,
          id_periodo: periodo
        })
      });

      const data = await res.json();
      if (data.exito) {
        alert('✅ Pago eliminado correctamente.');
        onEliminado(); // Actualiza la lista
        onClose();     // Cierra el modal
      } else {
        alert('Error: ' + data.mensaje);
      }
    } catch (err) {
      console.error(err);
      alert('Error al conectar con el servidor');
    }
  };

  return (
    <div className="modal-eliminar-overlay">
      <div className="modal-eliminar-contenido">
        <h3>¿Eliminar pago?</h3>
        <p>
          ¿Deseás eliminar el pago del socio <strong>{socio.nombre}</strong> 
          para el período <strong>{periodo}</strong>?
        </p>
        <div className="modal-eliminar-botones">
          <button className="btn-cancelar" onClick={onClose}>Cancelar</button>
          <button className="btn-confirmar" onClick={handleEliminar}>Eliminar</button>
        </div>
      </div>
    </div>
  );
};

export default ModalEliminarPago;
