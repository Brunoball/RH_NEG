import React, { useState } from 'react';
import { FaExclamationTriangle } from 'react-icons/fa';
import BASE_URL from '../../../config/config';
import Toast from '../../Global/Toast';
import './ModalEliminarCondonacion.css';

/**
 * Props:
 * - socio: { id_socio, nombre, ... }
 * - periodo: string|number
 * - periodoTexto: string
 * - onClose: fn
 * - onEliminado: fn
 */
const ModalEliminarCondonacion = ({ socio, periodo, periodoTexto, onClose, onEliminado }) => {
  const [toast, setToast] = useState(null);
  const [cargando, setCargando] = useState(false);

  const mostrarToast = (tipo, mensaje, duracion = 3000) =>
    setToast({ tipo, mensaje, duracion });

  const handleEliminar = async () => {
    setCargando(true);
    try {
      const res = await fetch(`${BASE_URL}/api.php?action=eliminar_pago`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_socio: socio.id_socio,
          id_periodo: periodo,
        }),
      });

      const data = await res.json();
      if (data.exito) {
        mostrarToast('exito', 'Condonación eliminada correctamente');
        setTimeout(() => {
          onEliminado?.({ ...socio, estado_pago: 'deudor', medio_pago: '' });
          onClose?.();
        }, 900);
      } else {
        mostrarToast('error', 'Error: ' + (data.mensaje ?? 'No se pudo eliminar la condonación'));
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

      <div className="condon-modal-overlay" role="dialog" aria-modal="true">
        <div className="condon-modal-contenido" role="document">
          <div className="condon-modal-icono">
            <FaExclamationTriangle />
          </div>
          <h3 className="condon-modal-titulo">Eliminar Condonación</h3>
          <p className="condon-modal-texto">
            ¿Deseás eliminar la condonación del socio <strong>{socio.nombre}</strong> para el período{' '}
            <strong>{periodoTexto ?? periodo}</strong>?
          </p>
          <div className="condon-modal-botones">
            <button className="condon-boton-cancelar" onClick={onClose} disabled={cargando}>
              Cancelar
            </button>
            <button className="condon-boton-confirmar" onClick={handleEliminar} disabled={cargando}>
              {cargando ? 'Eliminando...' : 'Eliminar'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ModalEliminarCondonacion;
