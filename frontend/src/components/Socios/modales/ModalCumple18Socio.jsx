import React, { useEffect, useState } from "react";
import {
  FaBirthdayCake,
  FaTimes,
  FaEye,
  FaExclamationTriangle,
  FaChevronRight,
  FaChevronLeft,
} from "react-icons/fa";

const formatFecha = (value) => {
  const s = String(value ?? "").slice(0, 10);
  if (!s) return "";
  const [yy, mm, dd] = s.split("-");
  if (yy && mm && dd) return `${dd}/${mm}/${yy}`;
  return s;
};

const ModalConfirmarCierreCumple18 = ({ socio, cantidadPendiente = 0, onCancelar, onConfirmar }) => {
  const quedanAtras = Number(cantidadPendiente) > 1;
  return (
    <div className="cumple18-confirm-overlay" role="presentation" onClick={onCancelar}>
      <div
        className="cumple18-confirm"
        role="dialog"
        aria-modal="true"
        aria-label="Confirmar cierre de alerta"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cumple18-confirm__icon">
          <FaExclamationTriangle />
        </div>
        <div className="cumple18-confirm__content">
          <h3>¿Cerrar esta notificación?</h3>
          <p>
            Si confirmás el cierre, esta alerta no se volverá a mostrar para{" "}
            <strong>{socio?.nombre || "este socio"}</strong>.
          </p>
          {quedanAtras && (
            <p className="cumple18-confirm__hint">
              Cuando cierres esta, se va a mostrar automáticamente la siguiente notificación pendiente.
            </p>
          )}
        </div>
        <div className="cumple18-confirm__actions">
          <button type="button" className="cumple18-confirm__btn cumple18-confirm__btn--secondary" onClick={onCancelar}>
            Cancelar
          </button>
          <button type="button" className="cumple18-confirm__btn cumple18-confirm__btn--danger" onClick={onConfirmar}>
            Sí, cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

const ModalCumple18Socio = ({
  mostrar,
  socio,
  info,
  cantidadPendiente = 0,
  onClose,
  onVerSocio,
}) => {
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false);
  const [oculto, setOculto] = useState(false);

  useEffect(() => {
    setMostrarConfirmacion(false);
    setOculto(false);
  }, [socio?.id_socio]);

  if (!mostrar || !socio) return null;

  const totalPendientes = Number(cantidadPendiente) || 1;
  const hayMasAtras = totalPendientes > 1;

  const pedirConfirmacionCierre = () => setMostrarConfirmacion(true);
  const cancelarCierre = () => setMostrarConfirmacion(false);
  const confirmarCierre = () => {
    setMostrarConfirmacion(false);
    onClose?.();
  };

  return (
    <>
      {/* Pestaña cuando está minimizado */}
      {oculto && (
        <button
          type="button"
          className="cumple18-tab"
          onClick={() => setOculto(false)}
          aria-label="Mostrar notificación de cumpleaños 18"
          title="Ver alerta de cumpleaños"
        >
          <FaBirthdayCake className="cumple18-tab__icon" />
          <FaChevronLeft className="cumple18-tab__chevron" />
        </button>
      )}

      <div className={`cumple18-toast-wrap${oculto ? " cumple18-toast-wrap--hidden" : ""}`}>
        {hayMasAtras && <div className="cumple18-toast-shadow cumple18-toast-shadow--two" />}
        {hayMasAtras && <div className="cumple18-toast-shadow cumple18-toast-shadow--one" />}

        <div className="cumple18-toast" role="alert" aria-live="assertive">
          {/* Botón cerrar definitivo */}
          <button
            type="button"
            className="cumple18-toast__close"
            onClick={pedirConfirmacionCierre}
            title="Cerrar notificación"
            aria-label="Cerrar notificación"
          >
            <FaTimes />
          </button>

          {/* Botón minimizar — esquina superior izquierda del contenido */}
          <button
            type="button"
            className="cumple18-toast__minimize"
            onClick={() => setOculto(true)}
            title="Minimizar"
            aria-label="Minimizar notificación"
          >
            <FaChevronRight />
          </button>

          <div className="cumple18-toast__icon">
            <FaBirthdayCake />
          </div>

          <div className="cumple18-toast__content">
            <div className="cumple18-toast__topline">
              <span className="cumple18-toast__eyebrow">Notificación importante</span>
              {hayMasAtras && (
                <span className="cumple18-toast__counter">1 de {totalPendientes}</span>
              )}
            </div>

            <h3>Socio cumple 18 años</h3>
            <p>
              <strong>{socio.nombre || `Socio ${socio.id_socio}`}</strong> ya cumplió 18 años
              {info?.fechaCumple18Label ? ` el ${info.fechaCumple18Label}` : ""}.
            </p>

            <div className="cumple18-toast__details">
              <span>ID: {socio.id_socio}</span>
              {socio.nacimiento && <span>Nacimiento: {formatFecha(socio.nacimiento)}</span>}
            </div>

            {hayMasAtras && (
              <div className="cumple18-toast__queue-hint">
                Hay {totalPendientes - 1} notificación{totalPendientes - 1 === 1 ? "" : "es"} más esperando atrás.
              </div>
            )}

            <div className="cumple18-toast__actions">
              <button
                type="button"
                className="cumple18-toast__btn cumple18-toast__btn--primary"
                onClick={onVerSocio}
              >
                <FaEye /> Ver socio
              </button>
              <button
                type="button"
                className="cumple18-toast__btn cumple18-toast__btn--secondary"
                onClick={pedirConfirmacionCierre}
              >
                Cerrar
              </button>
            </div>

            <small>Esta alerta queda fija hasta que confirmes el cierre.</small>
          </div>
        </div>
      </div>

      {mostrarConfirmacion && (
        <ModalConfirmarCierreCumple18
          socio={socio}
          cantidadPendiente={totalPendientes}
          onCancelar={cancelarCierre}
          onConfirmar={confirmarCierre}
        />
      )}
    </>
  );
};

export default ModalCumple18Socio;