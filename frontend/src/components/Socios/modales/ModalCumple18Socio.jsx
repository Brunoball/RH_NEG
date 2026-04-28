import React, { useEffect, useMemo, useState } from "react";
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

const ModalConfirmarCierreCumple18 = ({
  socio,
  cantidadPendiente = 0,
  onCancelar,
  onConfirmar,
}) => {
  const quedanAtras = Number(cantidadPendiente) > 1;

  return (
    <div
      className="cumple18-confirm-overlay"
      role="presentation"
      onClick={onCancelar}
    >
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
          <h3>¿Cerrar esta tarjeta?</h3>
          <p>
            Si confirmás, esta tarjeta dejará de mostrarse para{" "}
            <strong>{socio?.nombre || "este socio"}</strong> durante este año.
          </p>

          {quedanAtras && (
            <p className="cumple18-confirm__hint">
              Todavía vas a poder seguir viendo las demás tarjetas pendientes.
            </p>
          )}
        </div>

        <div className="cumple18-confirm__actions">
          <button
            type="button"
            className="cumple18-confirm__btn cumple18-confirm__btn--secondary"
            onClick={onCancelar}
          >
            Cancelar
          </button>

          <button
            type="button"
            className="cumple18-confirm__btn cumple18-confirm__btn--danger"
            onClick={onConfirmar}
          >
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
  indiceActual = 1,
  onAnterior,
  onSiguiente,
  onClose,
  onVerSocio,
}) => {
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false);
  const [oculto, setOculto] = useState(false);

  useEffect(() => {
    setMostrarConfirmacion(false);
    setOculto(false);
  }, [socio?.id_socio]);

  const edadTexto = useMemo(() => {
    const edad = Number(info?.edad);
    if (!Number.isFinite(edad) || edad <= 0) return "entre 18 y 23 años";
    return `${edad} año${edad === 1 ? "" : "s"}`;
  }, [info?.edad]);

  if (!mostrar || !socio) return null;

  const totalPendientes = Math.max(Number(cantidadPendiente) || 1, 1);
  const posicion = Math.min(
    Math.max(Number(indiceActual) || 1, 1),
    totalPendientes
  );
  const hayMasAtras = totalPendientes > 1;

  const pedirConfirmacionCierre = () => setMostrarConfirmacion(true);
  const cancelarCierre = () => setMostrarConfirmacion(false);
  const confirmarCierre = () => {
    setMostrarConfirmacion(false);
    onClose?.();
  };

  return (
    <>
      {oculto && (
        <button
          type="button"
          className="cumple18-tab"
          onClick={() => setOculto(false)}
          aria-label="Mostrar tarjetas de socios para contactar"
          title="Mostrar tarjetas"
        >
          <FaBirthdayCake className="cumple18-tab__icon" />
        </button>
      )}

      <div
        className={`cumple18-toast-wrap${
          oculto ? " cumple18-toast-wrap--hidden" : ""
        }`}
      >
        {hayMasAtras && (
          <div className="cumple18-toast-shadow cumple18-toast-shadow--two" />
        )}
        {hayMasAtras && (
          <div className="cumple18-toast-shadow cumple18-toast-shadow--one" />
        )}

        <div className="cumple18-toast" role="alert" aria-live="assertive">
          <button
            type="button"
            className="cumple18-toast__close"
            onClick={pedirConfirmacionCierre}
            title="Cerrar tarjeta"
            aria-label="Cerrar tarjeta"
          >
            <FaTimes />
          </button>

          <button
            type="button"
            className="cumple18-toast__minimize"
            onClick={() => setOculto(true)}
            title="Minimizar"
            aria-label="Minimizar"
          >
            <FaChevronRight />
          </button>

          <div className="cumple18-toast__icon">
            <FaBirthdayCake />
          </div>

          <div className="cumple18-toast__content">
            <div className="cumple18-toast__topline">
              <span className="cumple18-toast__eyebrow">
                Socios para contactar
              </span>
              <span className="cumple18-toast__counter">
                {posicion} de {totalPendientes}
              </span>
            </div>

            <h3>Socios entre 18 y 23 años</h3>

            <div className="cumple18-toast__panel">
              <div className="cumple18-toast__name">
                {socio.nombre || `Socio ${socio.id_socio}`}
              </div>

              <p className="cumple18-toast__description">
                Tiene <strong>{edadTexto}</strong>. Podés contactarlo para
                actualizar sus datos o hacer seguimiento.
              </p>

              <div className="cumple18-toast__details">
                <span>ID: {socio.id_socio}</span>
                {socio.nacimiento && (
                  <span>Nacimiento: {formatFecha(socio.nacimiento)}</span>
                )}
              </div>
            </div>

            <div className="cumple18-toast__actions">
              {hayMasAtras && (
                <button
                  type="button"
                  className="cumple18-toast__arrow-btn"
                  onClick={onAnterior}
                  title="Tarjeta anterior"
                  aria-label="Tarjeta anterior"
                >
                  <FaChevronLeft />
                </button>
              )}

              <button
                type="button"
                className="cumple18-toast__btn cumple18-toast__btn--primary"
                onClick={onVerSocio}
              >
                <FaEye /> Ver socio
              </button>

              {hayMasAtras && (
                <button
                  type="button"
                  className="cumple18-toast__arrow-btn"
                  onClick={onSiguiente}
                  title="Siguiente tarjeta"
                  aria-label="Siguiente tarjeta"
                >
                  <FaChevronRight />
                </button>
              )}
            </div>
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