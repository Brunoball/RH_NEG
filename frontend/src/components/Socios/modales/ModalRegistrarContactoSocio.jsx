import React, { useEffect, useMemo, useState } from "react";

const ESTADOS = [
  { value: "CONTACTADO", label: "Lo contactó" },
  { value: "PENDIENTE", label: "Pendiente" },
  { value: "NO_CONTACTADO", label: "No contactó" },
];

const LABELS_ESTADO = {
  CONTACTADO: "CONTACTADO",
  PENDIENTE: "PENDIENTE",
  NO_CONTACTADO: "NO CONTACTÓ",
  SIN_GESTION: "SIN GESTIÓN",
};

const hoyISO = () => new Date().toISOString().slice(0, 10);
const aMayusculas = (valor = "") => valor.toLocaleUpperCase("es-AR");

const formatDateDisplay = (value) => {
  const s = String(value ?? "").trim();
  if (!s) return "";
  const [yy, mm, dd] = s.slice(0, 10).split("-");
  if (yy && mm && dd) return `${dd}/${mm}/${yy}`;
  return s;
};

const ModalRegistrarContactoSocio = ({
  mostrar,
  socio,
  guardando = false,
  onClose,
  onGuardar,
  onOpenHistorial,
}) => {
  const [fecha, setFecha] = useState(hoyISO());
  const [estado, setEstado] = useState("CONTACTADO");
  const [nota, setNota] = useState("");

  useEffect(() => {
    if (!mostrar) return;

    setFecha(hoyISO());
    setEstado("CONTACTADO");
    setNota("");
  }, [mostrar, socio]);

  const titulo = useMemo(() => {
    if (!socio) return "Registrar contacto";
    return `Registrar contacto · ${socio.nombre || `Socio ${socio.id_socio}`}`;
  }, [socio]);

  const ultimoResumen = useMemo(() => {
    if (!socio) return null;

    const fechaUlt = socio.ultimo_contacto_fecha || socio._ultimoContactoFecha || "";
    const estadoRaw = String(
      socio.ultimo_contacto_estado || socio._ultimoContactoEstado || "SIN_GESTION"
    )
      .trim()
      .toUpperCase();
    const estadoUlt =
      estadoRaw === "VOLVER_A_LLAMAR"
        ? "PENDIENTE"
        : estadoRaw === "TELEFONO_INVALIDO"
        ? "NO_CONTACTADO"
        : estadoRaw || "SIN_GESTION";
    const notaUlt = String(socio.ultimo_contacto || socio._ultimoContactoNota || "").trim();

    return {
      fecha: fechaUlt,
      fechaLabel: fechaUlt ? formatDateDisplay(fechaUlt) : "SIN FECHA",
      estado: estadoUlt || "SIN_GESTION",
      estadoLabel: LABELS_ESTADO[estadoUlt] || "SIN GESTIÓN",
      nota: notaUlt,
      existe: Boolean(fechaUlt || notaUlt || (estadoUlt && estadoUlt !== "SIN_GESTION")),
    };
  }, [socio]);

  if (!mostrar || !socio) return null;

  const handleSubmit = (e) => {
    e.preventDefault();

    onGuardar?.({
      ultimo_contacto_fecha: fecha,
      ultimo_contacto_estado: estado,
      ultimo_contacto: aMayusculas(nota.trim()),
    });
  };

  return (
    <div
      style={overlayStyle}
      onClick={() => {
        if (!guardando) onClose?.();
      }}
    >
      <div
        style={modalStyle}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Registrar contacto"
      >
        <div style={headerStyle}>
          <div>
            <h3 style={titleStyle}>{titulo}</h3>
            <p style={subtitleStyle}>
              Registrá un nuevo contacto sin perder de vista el último que ya quedó guardado.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={guardando}
            style={closeButtonStyle}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={bodyStyle}>
            <div style={ultimoContactoBoxStyle}>
              <div style={ultimoContactoHeadStyle}>
                <div>
                  <div style={ultimoContactoTitleStyle}>ÚLTIMO CONTACTO REGISTRADO</div>
                  <div style={ultimoContactoSubStyle}>
                    {ultimoResumen?.existe
                      ? `${ultimoResumen.fechaLabel} · ${ultimoResumen.estadoLabel}`
                      : "SIN GESTIÓN REGISTRADA"}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onOpenHistorial}
                  style={historialButtonStyle}
                >
                  VER HISTORIAL
                </button>
              </div>

              <div style={ultimoContactoDetailStyle}>
                {ultimoResumen?.existe
                  ? ultimoResumen.nota || "SIN DETALLE CARGADO EN EL ÚLTIMO CONTACTO."
                  : "ESTE SOCIO TODAVÍA NO TIENE CONTACTOS REGISTRADOS."}
              </div>
            </div>

            <div style={gridStyle}>
              <div style={fieldStyle}>
                <label style={labelStyle}>Fecha del nuevo contacto</label>
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  max="9999-12-31"
                  required
                  style={inputStyle}
                />
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>Resultado</label>
                <select
                  value={estado}
                  onChange={(e) => setEstado(e.target.value)}
                  required
                  style={inputStyle}
                >
                  {ESTADOS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Observación / detalle</label>
              <textarea
                value={nota}
                onChange={(e) => setNota(aMayusculas(e.target.value))}
                rows={5}
                placeholder="EJ.: HABLÓ CON FAMILIAR, QUEDÓ PENDIENTE, PIDIÓ QUE LO LLAMEN MÁS ADELANTE, ETC."
                style={textareaStyle}
              />
            </div>

            <div style={hintBoxStyle}>
              <strong>Tip:</strong> este guardado crea un nuevo registro en el historial y además actualiza cuál es el último contacto del socio.
            </div>
          </div>

          <div style={footerStyle}>
            <button
              type="button"
              onClick={onClose}
              disabled={guardando}
              style={secondaryButtonStyle}
            >
              Cancelar
            </button>

            <button type="submit" disabled={guardando} style={primaryButtonStyle}>
              {guardando ? "Guardando..." : "Guardar contacto"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const overlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(0, 0, 0, 0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999,
  padding: 16,
};

const modalStyle = {
  width: "100%",
  maxWidth: 720,
  background: "#fff",
  borderRadius: 18,
  boxShadow: "0 18px 55px rgba(0, 0, 0, 0.2)",
  overflow: "hidden",
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
  display: "grid",
  gap: 16,
};

const ultimoContactoBoxStyle = {
  display: "grid",
  gap: 12,
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  padding: 14,
  background: "#f9fafb",
};

const ultimoContactoHeadStyle = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};

const ultimoContactoTitleStyle = {
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: 0.4,
  color: "#374151",
};

const ultimoContactoSubStyle = {
  marginTop: 4,
  fontSize: 13,
  color: "#4b5563",
  fontWeight: 600,
};

const ultimoContactoDetailStyle = {
  fontSize: 13,
  lineHeight: 1.5,
  color: "#111827",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
};

const historialButtonStyle = {
  border: "1px solid #cfd8e3",
  background: "#fff",
  color: "#1f2937",
  borderRadius: 12,
  padding: "9px 14px",
  fontWeight: 700,
  cursor: "pointer",
};

const gridStyle = {
  display: "grid",
  gap: 14,
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
};

const fieldStyle = {
  display: "grid",
  gap: 8,
};

const labelStyle = {
  fontSize: 13,
  fontWeight: 600,
  color: "#374151",
};

const inputStyle = {
  width: "100%",
  border: "1px solid #d1d5db",
  borderRadius: 12,
  padding: "11px 12px",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
};

const textareaStyle = {
  ...inputStyle,
  resize: "vertical",
  minHeight: 110,
  fontFamily: "inherit",
  textTransform: "uppercase",
};

const hintBoxStyle = {
  fontSize: 12.5,
  color: "#4b5563",
  background: "#f9fafb",
  border: "1px solid #eceff3",
  borderRadius: 12,
  padding: "10px 12px",
};

const footerStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: 10,
  padding: "14px 22px 22px",
};

const secondaryButtonStyle = {
  border: "1px solid #d1d5db",
  background: "#fff",
  color: "#374151",
  borderRadius: 12,
  padding: "10px 16px",
  fontWeight: 600,
  cursor: "pointer",
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

export default ModalRegistrarContactoSocio;
