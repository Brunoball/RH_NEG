import React from "react";

const LABELS_ESTADO = {
  CONTACTADO: "CONTACTADO",
  PENDIENTE: "PENDIENTE",
  NO_CONTACTADO: "NO CONTACTÓ",
  SIN_GESTION: "SIN GESTIÓN",
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

  if (estado === "VOLVER_A_LLAMAR") return "PENDIENTE";
  if (estado === "TELEFONO_INVALIDO") return "NO_CONTACTADO";
  if (estado === "CONTACTADO" || estado === "PENDIENTE" || estado === "NO_CONTACTADO") {
    return estado;
  }

  return "SIN_GESTION";
};

const getBadgeStyle = (estadoRaw) => {
  const estado = normalizeEstado(estadoRaw);

  if (estado === "CONTACTADO") {
    return { background: "#edf8f1", color: "#1e7e34", border: "#b7e4c7" };
  }
  if (estado === "PENDIENTE") {
    return { background: "#fff4e8", color: "#b25b00", border: "#ffd7b0" };
  }
  if (estado === "NO_CONTACTADO") {
    return { background: "#fdeeee", color: "#c0392b", border: "#f5c2c0" };
  }

  return { background: "#f3f4f6", color: "#4b5563", border: "#e5e7eb" };
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
    <div style={overlayStyle} onClick={onClose}>
      <div
        style={modalStyle}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Historial de contactos"
      >
        <div style={headerStyle}>
          <div>
            <h3 style={titleStyle}>Historial de contactos · {socio.nombre}</h3>
            <p style={subtitleStyle}>
              Acá ves todos los contactos guardados del socio, del más reciente al más antiguo.
            </p>
          </div>

          <button type="button" onClick={onClose} style={closeButtonStyle} aria-label="Cerrar">
            ×
          </button>
        </div>

        <div style={bodyStyle}>
          {cargando ? (
            <div style={emptyStateStyle}>Cargando historial...</div>
          ) : registros.length === 0 ? (
            <div style={emptyStateStyle}>Este socio todavía no tiene contactos registrados.</div>
          ) : (
            <div style={listStyle}>
              {registros.map((item) => {
                const badge = getBadgeStyle(item.estado_contacto);
                const estado = normalizeEstado(item.estado_contacto);
                const detalle = String(item.detalle_contacto ?? "").trim();

                return (
                  <div key={item.id_contacto} style={cardStyle}>
                    <div style={cardTopStyle}>
                      <div style={dateStyle}>
                        {formatDateTime(item.fecha_contacto || item.created_at)}
                      </div>

                      <span
                        style={{
                          ...badgeStyle,
                          background: badge.background,
                          color: badge.color,
                          borderColor: badge.border,
                        }}
                      >
                        {LABELS_ESTADO[estado] || estado || "SIN GESTIÓN"}
                      </span>
                    </div>

                    <div style={detailStyle}>
                      {detalle || "SIN DETALLE CARGADO EN ESTE CONTACTO."}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={footerStyle}>
          <button type="button" onClick={onClose} style={primaryButtonStyle}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

const overlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(0, 0, 0, 0.52)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 10000,
  padding: 16,
};

const modalStyle = {
  width: "100%",
  maxWidth: 760,
  maxHeight: "86vh",
  background: "#fff",
  borderRadius: 18,
  boxShadow: "0 18px 55px rgba(0, 0, 0, 0.2)",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
};

const headerStyle = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 16,
  padding: "20px 22px 12px",
  borderBottom: "1px solid #ececec",
};

const titleStyle = {
  margin: 0,
  fontSize: 20,
  fontWeight: 700,
  color: "#1f2937",
};

const subtitleStyle = {
  margin: "6px 0 0",
  fontSize: 13,
  color: "#6b7280",
};

const closeButtonStyle = {
  border: "none",
  background: "transparent",
  fontSize: 28,
  lineHeight: 1,
  cursor: "pointer",
  color: "#6b7280",
};

const bodyStyle = {
  padding: 22,
  overflowY: "auto",
  flex: 1,
};

const listStyle = {
  display: "grid",
  gap: 12,
};

const cardStyle = {
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  background: "#fff",
  padding: 14,
  display: "grid",
  gap: 10,
};

const cardTopStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};

const dateStyle = {
  fontSize: 14,
  fontWeight: 700,
  color: "#111827",
};

const badgeStyle = {
  border: "1px solid",
  borderRadius: 999,
  padding: "5px 10px",
  fontSize: 12,
  fontWeight: 800,
};

const detailStyle = {
  fontSize: 13,
  lineHeight: 1.55,
  color: "#374151",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
};

const emptyStateStyle = {
  minHeight: 160,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  color: "#6b7280",
  fontWeight: 600,
};

const footerStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: 10,
  padding: "14px 22px 22px",
  borderTop: "1px solid #ececec",
};

const primaryButtonStyle = {
  border: "none",
  background: "#2563eb",
  color: "#fff",
  borderRadius: 12,
  padding: "10px 16px",
  fontWeight: 700,
  cursor: "pointer",
};

export default ModalHistorialContactoSocio;
