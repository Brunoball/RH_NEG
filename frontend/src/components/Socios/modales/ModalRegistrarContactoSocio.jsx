import React, { useEffect, useMemo, useState } from "react";
import "./ModalRegistrarContactoSocio.css";

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

    const fechaUlt =
      socio.ultimo_contacto_fecha ||
      socio._ultimoContactoFecha ||
      "";

    const estadoRaw = String(
      socio.ultimo_contacto_estado ||
        socio._ultimoContactoEstado ||
        "SIN_GESTION"
    )
      .trim()
      .toUpperCase();

    const estadoUlt =
      estadoRaw === "VOLVER_A_LLAMAR"
        ? "PENDIENTE"
        : estadoRaw === "TELEFONO_INVALIDO"
        ? "NO_CONTACTADO"
        : estadoRaw || "SIN_GESTION";

    const notaUlt = String(
      socio.ultimo_contacto ||
        socio._ultimoContactoNota ||
        ""
    ).trim();

    return {
      fecha: fechaUlt,
      fechaLabel: fechaUlt ? formatDateDisplay(fechaUlt) : "SIN FECHA",
      estado: estadoUlt || "SIN_GESTION",
      estadoLabel: LABELS_ESTADO[estadoUlt] || "SIN GESTIÓN",
      nota: notaUlt,
      existe: Boolean(
        fechaUlt ||
          notaUlt ||
          (estadoUlt && estadoUlt !== "SIN_GESTION")
      ),
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

  const abrirCalendario = (e) => {
    const input = e.currentTarget;

    if (typeof input.showPicker === "function") {
      try {
        input.showPicker();
      } catch (error) {
        // Evita que React rompa si el navegador bloquea showPicker.
      }
    }
  };

  return (
    <div
      className="mrc-overlay"
      onClick={() => {
        if (!guardando) onClose?.();
      }}
    >
      <div
        className="mrc-container"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Registrar contacto"
      >
        {/* ── Header ── */}
        <div className="mrc-header">
          <div className="mrc-header-content">
            <h3 className="mrc-title">{titulo}</h3>

            <p className="mrc-subtitle">
              Registrá un nuevo contacto sin perder de vista el último que ya
              quedó guardado.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={guardando}
            className="mrc-close-btn"
            aria-label="Cerrar"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* ── Form ── */}
        <form onSubmit={handleSubmit} style={{ display: "contents" }}>
          <div className="mrc-body">
            {/* Último contacto */}
            <div className="mrc-ultimo-box">
              <div className="mrc-ultimo-head">
                <div>
                  <div className="mrc-ultimo-section-label">
                    Último contacto registrado
                  </div>

                  <div className="mrc-ultimo-meta">
                    {ultimoResumen?.existe
                      ? `${ultimoResumen.fechaLabel} · ${ultimoResumen.estadoLabel}`
                      : "SIN GESTIÓN REGISTRADA"}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onOpenHistorial}
                  className="mrc-historial-btn"
                >
                  VER HISTORIAL
                </button>
              </div>

              <div className="mrc-ultimo-detail">
                {ultimoResumen?.existe
                  ? ultimoResumen.nota ||
                    "SIN DETALLE CARGADO EN EL ÚLTIMO CONTACTO."
                  : "ESTE SOCIO TODAVÍA NO TIENE CONTACTOS REGISTRADOS."}
              </div>
            </div>

            {/* Fecha + Resultado */}
            <div className="mrc-grid">
              <div className="mrc-field">
                <label className="mrc-label">
                  Fecha del nuevo contacto
                </label>

                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  onPointerDown={abrirCalendario}
                  max="9999-12-31"
                  required
                  className="mrc-input"
                />
              </div>

              <div className="mrc-field">
                <label className="mrc-label">Resultado</label>

                <select
                  value={estado}
                  onChange={(e) => setEstado(e.target.value)}
                  required
                  className="mrc-select"
                >
                  {ESTADOS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Nota */}
            <div className="mrc-field">
              <label className="mrc-label">Observación / detalle</label>

              <textarea
                value={nota}
                onChange={(e) => setNota(aMayusculas(e.target.value))}
                rows={5}
                placeholder="EJ.: HABLÓ CON FAMILIAR, QUEDÓ PENDIENTE, PIDIÓ QUE LO LLAMEN MÁS ADELANTE, ETC."
                className="mrc-textarea"
              />
            </div>

            {/* Hint */}
            <div className="mrc-hint">
              <strong>Tip:</strong> este guardado crea un nuevo registro en el
              historial y además actualiza cuál es el último contacto del socio.
            </div>
          </div>

          {/* ── Footer ── */}
          <div className="mrc-footer">
            <button
              type="button"
              onClick={onClose}
              disabled={guardando}
              className="mrc-btn-secondary"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={guardando}
              className="mrc-btn-primary"
            >
              {guardando ? "Guardando..." : "Guardar contacto"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ModalRegistrarContactoSocio;