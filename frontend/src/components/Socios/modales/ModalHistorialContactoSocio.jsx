import React from "react";
import "./ModalHistorialContactoSocio.css";

const LABELS_ESTADO = {
  CONTACTADO:    "CONTACTADO",
  PENDIENTE:     "PENDIENTE",
  NO_CONTACTADO: "NO CONTACTÓ",
  SIN_GESTION:   "SIN GESTIÓN",
};

const formatDateTime = (value) => {
  const s = String(value ?? "").trim();
  if (!s) return "";

  const [datePart = "", timePart = ""] = s.replace("T", " ").split(" ");
  const [yy, mm, dd] = datePart.split("-");
  const time = timePart ? timePart.slice(0, 5) : "";

  if (yy && mm && dd) {
    return time ? `${dd}/${mm}/${yy} ${time}` : `${dd}/${mm}/${yy}`;
  }
  return s;
};

const normalizeEstado = (estadoRaw) => {
  const estado = String(estadoRaw ?? "SIN_GESTION").trim().toUpperCase();

  if (estado === "VOLVER_A_LLAMAR")   return "PENDIENTE";
  if (estado === "TELEFONO_INVALIDO") return "NO_CONTACTADO";
  if (["CONTACTADO", "PENDIENTE", "NO_CONTACTADO"].includes(estado)) return estado;
  return "SIN_GESTION";
};

const badgeClass = (estadoRaw) => {
  const estado = normalizeEstado(estadoRaw);
  const map = {
    CONTACTADO:    "mhc-badge mhc-badge--contactado",
    PENDIENTE:     "mhc-badge mhc-badge--pendiente",
    NO_CONTACTADO: "mhc-badge mhc-badge--no-contactado",
    SIN_GESTION:   "mhc-badge mhc-badge--sin-gestion",
  };
  return map[estado] ?? "mhc-badge mhc-badge--sin-gestion";
};

const ModalHistorialContactoSocio = ({
  mostrar,
  socio,
  registros = [],
  cargando = false,
  onClose,
}) => {
  if (!mostrar || !socio) return null;

  return (
    <div className="mhc-overlay" onClick={onClose}>
      <div
        className="mhc-container"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Historial de contactos"
      >
        {/* ── Header ── */}
        <div className="mhc-header">
          <div className="mhc-header-content">
            <h3 className="mhc-title">
              Historial de contactos · {socio.nombre}
            </h3>
            <p className="mhc-subtitle">
              Acá ves todos los contactos guardados del socio, del más reciente al más antiguo.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="mhc-close-btn"
            aria-label="Cerrar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6"  y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* ── Body ── */}
        <div className="mhc-body">
          {cargando ? (
            <div className="mhc-empty">Cargando historial...</div>
          ) : registros.length === 0 ? (
            <div className="mhc-empty">
              Este socio todavía no tiene contactos registrados.
            </div>
          ) : (
            <div className="mhc-list">
              {registros.map((item) => {
                const estado  = normalizeEstado(item.estado_contacto);
                const detalle = String(item.detalle_contacto ?? "").trim();

                return (
                  <div key={item.id_contacto} className="mhc-card">
                    <div className="mhc-card-top">
                      <div className="mhc-date">
                        {formatDateTime(item.fecha_contacto || item.created_at)}
                      </div>

                      <span className={badgeClass(item.estado_contacto)}>
                        {LABELS_ESTADO[estado] || estado || "SIN GESTIÓN"}
                      </span>
                    </div>

                    <div className="mhc-detail">
                      {detalle || "SIN DETALLE CARGADO EN ESTE CONTACTO."}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="mhc-footer">
          <button
            type="button"
            onClick={onClose}
            className="mhc-btn-primary"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModalHistorialContactoSocio;