import React, { useState } from 'react';
import { FaExclamationTriangle } from 'react-icons/fa';
import BASE_URL from '../../../config/config';
import Toast from '../../Global/Toast';
import './ModalEliminarPago.css'; // usa las mismas clases que el de socio

const ModalEliminarPago = ({ socio, periodo, onClose, onEliminado }) => {
  const [toast, setToast] = useState(null);
  const [cargando, setCargando] = useState(false);

  const mostrarToast = (tipo, mensaje, duracion = 3000) => {
    setToast({ tipo, mensaje, duracion });
  };

  const handleEliminar = async () => {
    setCargando(true);
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
        mostrarToast('exito', 'Pago eliminado correctamente');
        setTimeout(() => {
          onEliminado({ ...socio, estado_pago: 'deudor', medio_pago: '' });
          onClose();
        }, 1000);
      } else {
        mostrarToast('error', 'Error: ' + data.mensaje);
      }
    } catch (err) {
      console.error(err);
      mostrarToast('error', 'Error al conectar con el servidor');
    } finally {
      setCargando(false);
    }
  };

  if (!socio) return null;

  return (
    <>
      {/* Toast fijo arriba de todo */}
      <div className="toast-fixed-container">
        {toast && (
          <Toast
            tipo={toast.tipo}
            mensaje={toast.mensaje}
            duracion={toast.duracion}
            onClose={() => setToast(null)}
          />
        )}
      </div>

      {/* Mismas clases del modal de eliminar socio */}
      <div className="soc-modal-overlay-eliminar">
        <div className="soc-modal-contenido-eliminar">
          <div className="soc-modal-icono-eliminar">
            <FaExclamationTriangle />
          </div>
          <h3 className="soc-modal-titulo-eliminar">Eliminar Pago</h3>
          <p className="soc-modal-texto-eliminar">
            ¿Deseás eliminar el pago del socio <strong>{socio.nombre}</strong> para el período <strong>{periodo}</strong>?
          </p>
          <div className="soc-modal-botones-eliminar">
            <button
              className="soc-boton-cancelar-eliminar"
              onClick={onClose}
              disabled={cargando}
            >
              Cancelar
            </button>
            <button
              className="soc-boton-confirmar-eliminar"
              onClick={handleEliminar}
              disabled={cargando}
            >
              {cargando ? 'Eliminando...' : 'Eliminar'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ModalEliminarPago;
