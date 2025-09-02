// src/components/Cuotas/modales/ModalEliminarCondonacion.jsx
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
 * - esCondonacionAnual: boolean
 * - onClose: fn
 * - onEliminado: fn
 */
const ModalEliminarCondonacion = ({
  socio,
  periodo,
  periodoTexto,
  esCondonacionAnual = false,
  onClose,
  onEliminado,
}) => {
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

  // === Lógica para aviso ANUAL (idéntica al modal de pago) ===
  const ID_CONTADO_ANUAL = 7;
  const esBimestre = String(periodo) !== String(ID_CONTADO_ANUAL);

  // Mostrar “CONTADO ANUAL” si la condonación real proviene de ANUAL aunque estemos en un bimestre
  const etiquetaPeriodo =
    esCondonacionAnual && esBimestre ? 'CONTADO ANUAL' : (periodoTexto ?? periodo);

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
            ¿Deseás eliminar la condonación del socio <strong>{socio.nombre}</strong> para{' '}
            <strong>{etiquetaPeriodo}</strong>?
          </p>

          {/* Aviso cuando es ANUAL, igual que en el modal de pago */}
          {esCondonacionAnual && esBimestre && (
            <div className="soc-alert soc-alert-danger" role="alert">
              Esta condonación corresponde a <strong>CONTADO ANUAL</strong>.{' '}
              Al <strong>eliminarla</strong>, se borra el <strong>registro de todo el año</strong>.
            </div>
          )}

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
