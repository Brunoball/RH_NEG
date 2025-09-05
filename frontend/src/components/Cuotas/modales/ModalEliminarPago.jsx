import React, { useState } from 'react';
import { FaExclamationTriangle } from 'react-icons/fa';
import BASE_URL from '../../../config/config';
import Toast from '../../Global/Toast';
import './ModalEliminarPago.css';

/**
 * Props:
 * - socio: { id_socio, nombre, ... }
 * - periodo: string|number (ID del período seleccionado en la UI)
 * - periodoTexto: string (texto visible del período)
 * - esPagoAnual: boolean  -> true si el estado "pagado" proviene de un registro ANUAL
 * - anio: number          -> ⬅️ NUEVO: año seleccionado en la UI
 * - onClose: fn
 * - onEliminado: fn(affectedPeriods: number[] | void)
 */
const ModalEliminarPago = ({
  socio,
  periodo,
  periodoTexto,
  esPagoAnual = false,
  anio = 0,               // ⬅️ NUEVO
  onClose,
  onEliminado
}) => {
  const [toast, setToast] = useState(null);
  const [cargando, setCargando] = useState(false);

  const mostrarToast = (tipo, mensaje, duracion = 3000) => {
    setToast({ tipo, mensaje, duracion });
  };

  const handleEliminar = async () => {
    if (!anio) {
      mostrarToast('error', 'No se recibió el año seleccionado.');
      return;
    }
    setCargando(true);
    try {
      const res = await fetch(`${BASE_URL}/api.php?action=eliminar_pago`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_socio: socio.id_socio,
          id_periodo: periodo,
          anio,                                 // ⬅️ NUEVO
        }),
      });

      const data = await res.json();
      if (data.exito) {
        mostrarToast('exito', data.mensaje || 'Pago eliminado correctamente');
        const affected = Array.isArray(data.affected_periods)
          ? data.affected_periods
          : [periodo];

        setTimeout(() => {
          onEliminado?.(affected);
          onClose?.();
        }, 700);
      } else {
        mostrarToast('error', 'Error: ' + (data.mensaje ?? 'No se pudo eliminar'));
      }
    } catch (err) {
      console.error(err);
      mostrarToast('error', 'Error al conectar con el servidor');
    } finally {
      setCargando(false);
    }
  };

  if (!socio) return null;

  // ID del período ANUAL (contado anual)
  const ID_CONTADO_ANUAL = 7;

  // Si el modal se abrió parado en un bimestre (1..6)
  const esBimestre = String(periodo) !== String(ID_CONTADO_ANUAL);

  // Mostrar “CONTADO ANUAL” si el pago real proviene de ANUAL aunque estemos en un bimestre
  const etiquetaPeriodo =
    esPagoAnual && esBimestre ? 'CONTADO ANUAL' : (periodoTexto ?? periodo);

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

      <div className="soc-modal-overlay-eliminar" role="dialog" aria-modal="true">
        <div className="soc-modal-contenido-eliminar" role="document">
          <div className="soc-modal-icono-eliminar" aria-hidden="true">
            <FaExclamationTriangle />
          </div>

          <h3 className="soc-modal-titulo-eliminar">Eliminar Pago</h3>

          <p className="soc-modal-texto-eliminar">
            ¿Deseás eliminar el pago del socio <strong>{socio.nombre}</strong> para{' '}
            <strong>{etiquetaPeriodo}</strong> {anio ? <>del año <strong>{anio}</strong></> : null}?
          </p>

          {esPagoAnual && esBimestre && (
            <div className="soc-alert soc-alert-danger" role="alert">
              Este pago corresponde a <strong>CONTADO ANUAL</strong>.{' '}
              Al eliminarlo, se borra el <strong>registro de todo el año</strong>.
            </div>
          )}

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
