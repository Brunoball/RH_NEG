// src/components/Cuotas/modales/ModalMesCuotas.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faCalendarAlt, faPrint } from "@fortawesome/free-solid-svg-icons";
import BASE_URL from "../../../config/config"; // <- para refrescar montos al vuelo (opcional)
import "./ModalMesCuotas.css";

/**
 * NUEVO:
 * - La tarjeta "ANUAL" solo se muestra en la ventana 15-dic → fin-feb (oculta desde 1-mar hasta 14-dic).
 * - Cuando se presiona ANUAL (o se convierte a anual por seleccionar todos dentro de la ventana),
 *   se intenta REFRESCAR el precio anual desde DB EN ESE MOMENTO y se usa ese valor exacto.
 * - Antes de "Imprimir" se vuelve a refrescar (si es anual) por si cambió mientras estaba abierto.
 * - Si no hay forma de refrescar (porque no se pasan IDs o el endpoint no responde),
 *   se usa el montoAnual recibido por props como fallback.
 *
 * API de props:
 * - periodos, seleccionados, onSeleccionadosChange, onCancelar, onImprimir, anios, anioSeleccionado, onAnioChange
 * - montoMensual, montoAnual, condonar
 * - (OPCIONALES para refresco): id_socio, id_cat_monto
 */

const MESES_ANIO = 6; // cantidad de bimestres que representan el anual

const ventanaAnualActiva = () => {
  const hoy = new Date();
  const y = hoy.getFullYear();
  const startActual = new Date(y, 11, 15);   // 15-dic-y
  const endSiguiente = new Date(y + 1, 2, 1); // 1-mar-(y+1)
  if (hoy >= startActual && hoy < endSiguiente) return true;

  const startPrev = new Date(y - 1, 11, 15); // 15-dic-(y-1)
  const endActual = new Date(y, 2, 1);       // 1-mar-y
  if (hoy >= startPrev && hoy < endActual) return true;

  return false;
};

const ModalMesCuotas = ({
  periodos = [],
  seleccionados = [],
  onSeleccionadosChange,
  onCancelar,
  onImprimir,                // recibe { anio, seleccionados, esAnual, periodoTexto, importe_total }
  anios = [],
  anioSeleccionado = "",
  onAnioChange = () => {},
  // ===== NUEVOS/EXISTENTES PROPS =====
  montoMensual = 0,
  montoAnual = 0,
  condonar = false,
  // Para refrescar montos al vuelo (opcionales):
  id_socio,
  id_cat_monto,
}) => {
  const normalize = (s = "") =>
    String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();

  const isAnualName = (p) => normalize(p?.nombre).includes("ANUAL");
  const ventanaActiva = ventanaAnualActiva();

  // ====== estado local de montos (se puede refrescar) ======
  const [mMensual, setMMensual] = useState(Number(montoMensual) || 0);
  const [mAnual, setMAnual] = useState(Number(montoAnual) || 0);

  useEffect(() => {
    // Si cambian props de montos, actualizamos base local
    setMMensual(Number(montoMensual) || 0);
    setMAnual(Number(montoAnual) || 0);
  }, [montoMensual, montoAnual]);

  const refrescarMontosActuales = async () => {
    // Solo intenta si tenemos algún identificador
    if (!id_socio && !id_cat_monto) return;

    try {
      const qs = new URLSearchParams();
      if (id_cat_monto) qs.set('id_cat_monto', String(id_cat_monto));
      if (id_socio)     qs.set('id_socio',     String(id_socio));

      const res = await fetch(`${BASE_URL}/api.php?action=montos&${qs.toString()}`);
      const data = await res.json();
      if (data?.exito) {
        setMMensual(Number(data.mensual) || 0);
        setMAnual(Number(data.anual) || 0);
      }
      // Nota: si no exito, mantenemos valores actuales (fallback a props ya seteadas)
    } catch {
      // Silencioso: si falla, seguimos con los valores actuales
    }
  };

  // -------- Helpers de fecha para descuento anual (idéntico criterio a ModalPagos) --------
  const idsSeleccionadosComoString = useMemo(
    () => seleccionados.map(String),
    [seleccionados]
  );

  // Ocultamos la tarjeta ANUAL fuera de ventana
  const periodosConVisibilidad = useMemo(() => {
    if (ventanaActiva) return periodos;
    return periodos.filter((p) => !isAnualName(p));
  }, [periodos, ventanaActiva]);

  const anualPeriodo = useMemo(
    () => periodosConVisibilidad.find(isAnualName) || null,
    [periodosConVisibilidad]
  );

  const algunAnualSeleccionado = useMemo(() => {
    if (!anualPeriodo) return false;
    return idsSeleccionadosComoString.includes(String(anualPeriodo.id));
  }, [anualPeriodo, idsSeleccionadosComoString]);

  const soloAnualSeleccionado =
    algunAnualSeleccionado && seleccionados.length === 1;

  // Año efectivo a usar siempre
  const anioEfectivo = useMemo(() => {
    const prefer = String(anioSeleccionado || "").trim();
    if (prefer) return prefer;
    if (anios && anios.length) return String(anios[0]);
    return String(new Date().getFullYear());
  }, [anioSeleccionado, anios]);

  // === Filtro por año seleccionado (opcional, según nombres con año) ===
  const periodosFiltradosPorAnio = useMemo(() => {
    if (!anioEfectivo) return periodosConVisibilidad;
    return periodosConVisibilidad.filter((p) => {
      const nombrePeriodo = p.nombre || "";
      const matchAnio = nombrePeriodo.match(/(20\d{2})/);
      return matchAnio ? String(matchAnio[1]) === String(anioEfectivo) : true;
    });
  }, [periodosConVisibilidad, anioEfectivo]);

  const periodosNoAnual = useMemo(
    () => periodosFiltradosPorAnio.filter((p) => !isAnualName(p)),
    [periodosFiltradosPorAnio]
  );

  const idsNoAnual = useMemo(
    () => periodosNoAnual.map((p) => String(p.id)),
    [periodosNoAnual]
  );

  const selectedNoAnualCount = useMemo(
    () => idsNoAnual.filter((id) => idsSeleccionadosComoString.includes(id)).length,
    [idsNoAnual, idsSeleccionadosComoString]
  );

  const allNoAnualSelected = useMemo(
    () => idsNoAnual.length > 0 && selectedNoAnualCount === idsNoAnual.length,
    [idsNoAnual.length, selectedNoAnualCount]
  );

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape" || e.key === "Esc" || e.keyCode === 27) {
        e.preventDefault();
        onCancelar?.();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onCancelar]);

  const toggleId = async (id) => {
    const strId = String(id);
    const p = periodosFiltradosPorAnio.find((x) => String(x.id) === strId);
    const esAnual = p ? isAnualName(p) : false;
    const yaEsta = idsSeleccionadosComoString.includes(strId);

    if (esAnual) {
      // Solo toggle si la ventana está activa (si no, ni siquiera se muestra)
      if (!ventanaActiva) return;
      if (!yaEsta) {
        // refrescar justo antes de seleccionar anual
        await refrescarMontosActuales();
        onSeleccionadosChange([id]);
      } else {
        onSeleccionadosChange([]);
      }
      return;
    }

    // Si estaba seleccionado ANUAL, y tocan un bimestre, salir del anual
    const base = seleccionados.filter((x) => {
      const pp = periodosFiltradosPorAnio.find((q) => String(q.id) === String(x));
      return !(pp && isAnualName(pp));
    });

    let next = yaEsta
      ? base.filter((pid) => String(pid) !== strId)
      : [...base, id];

    // Convertir a ANUAL automáticamente solo si la ventana está activa y existe ANUAL visible
    if (ventanaActiva && anualPeriodo) {
      const nextStr = next.map(String);
      const completa =
        idsNoAnual.length > 0 &&
        nextStr.length === idsNoAnual.length &&
        idsNoAnual.every((n) => nextStr.includes(n));
      if (completa) {
        // refresco rápido antes de convertir a anual
        await refrescarMontosActuales();
        onSeleccionadosChange([anualPeriodo.id]);
        return;
      }
    }

    onSeleccionadosChange(next);
  };

  const seleccionarTodos = async () => {
    if (soloAnualSeleccionado || allNoAnualSelected) {
      onSeleccionadosChange([]);
      return;
    }
    if (ventanaActiva && anualPeriodo) {
      await refrescarMontosActuales();
      onSeleccionadosChange([anualPeriodo.id]);
    } else {
      onSeleccionadosChange(periodosNoAnual.map((p) => p.id));
    }
  };

  const periodosOrdenados = useMemo(() => {
    return periodosFiltradosPorAnio.slice().sort((a, b) => {
      const na = Number(a.id);
      const nb = Number(b.id);
      if (Number.isNaN(na) || Number.isNaN(nb)) {
        return String(a.id).localeCompare(String(b.id), "es");
      }
      return na - nb;
    });
  }, [periodosFiltradosPorAnio]);

  const totalSeleccionados = seleccionados.length;

  // === Year picker ===
  const [showYearPicker, setShowYearPicker] = useState(false);
  const yearRef = useRef(null);

  useEffect(() => {
    const onDocClick = (e) => {
      if (!yearRef.current) return;
      if (showYearPicker && !yearRef.current.contains(e.target)) {
        setShowYearPicker(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [showYearPicker]);

  const handleYearPick = (y) => {
    onAnioChange(String(y));
    setShowYearPicker(false);
  };

  // =========================
  // CÁLCULO DE TOTAL + TEXTO
  // =========================

  // “Es anual” solo si: (a) seleccionan la tarjeta anual, o (b) seleccionan todos los bimestres
  // y la ventana anual está activa. Fuera de ventana, NUNCA es anual.
  const esAnualSeleccion = useMemo(() => {
    if (!ventanaActiva) return false;
    if (algunAnualSeleccionado) return true;
    return idsNoAnual.length > 0 && selectedNoAnualCount === idsNoAnual.length;
  }, [ventanaActiva, algunAnualSeleccionado, idsNoAnual.length, selectedNoAnualCount]);

  // Conteo de bimestres seleccionados (no cuenta "anual")
  const cantidadBimestresSeleccionados = useMemo(() => {
    if (esAnualSeleccion) return MESES_ANIO; // coherencia visual
    return periodosNoAnual.reduce(
      (acc, p) => acc + (idsSeleccionadosComoString.includes(String(p.id)) ? 1 : 0),
      0
    );
  }, [esAnualSeleccion, periodosNoAnual, idsSeleccionadosComoString]);

  // Texto de períodos
  const periodoTexto = useMemo(() => {
    if (esAnualSeleccion) return `CONTADO ANUAL ${anioEfectivo}`;

    const pares = periodosNoAnual
      .filter((p) => idsSeleccionadosComoString.includes(String(p.id)))
      .map((p) => (p?.nombre || "").replace(/^\s*per[ií]odo?s?\s*:?\s*/i, "").trim());

    const cuerpo = pares.join(" ");
    return `${cuerpo} ${anioEfectivo}`.trim();
  }, [esAnualSeleccion, periodosNoAnual, idsSeleccionadosComoString, anioEfectivo]);

  // TOTAL con misma regla definitiva:
  // - Si es anual: usar SIEMPRE el precio anual exacto de DB (si logramos refrescar). No usar mensual×6.
  // - Si no es anual: mensual × cantidad de bimestres.
  const totalCalculado = useMemo(() => {
    if (condonar) return 0;
    if (esAnualSeleccion) return Number(mAnual) || 0;
    return (Number(mMensual) || 0) * cantidadBimestresSeleccionados;
  }, [condonar, esAnualSeleccion, mAnual, mMensual, cantidadBimestresSeleccionados]);

  const handleImprimir = async () => {
    // Si es anual, refrescar montos justo antes de imprimir
    if (esAnualSeleccion) {
      await refrescarMontosActuales();
    }

    onImprimir?.({
      anio: Number(anioEfectivo),
      seleccionados: [...seleccionados],
      esAnual: esAnualSeleccion,
      periodoTexto,
      importe_total: condonar
        ? 0
        : (esAnualSeleccion
            ? (Number(mAnual) || 0)
            : (Number(mMensual) || 0) * cantidadBimestresSeleccionados),
    });
  };

  return (
    <div className="modmes_overlay">
      <div className="modmes_contenido">
        {/* Header */}
        <div className="modmes_header">
          <div className="modmes_header-left">
            <div className="modmes_icon-circle">
              <FontAwesomeIcon icon={faCalendarAlt} />
            </div>
            <div className="modmes_header-texts">
              <h2 className="modmes_title">Seleccionar Períodos</h2>
            </div>
          </div>
          <button className="modmes_close-btn" onClick={onCancelar} aria-label="Cerrar">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="modmes_body">
          <div className="modmes_periodos-section">
            <div className="modmes_section-header">
              <h4 className="modmes_section-title">PERÍODOS DISPONIBLES</h4>

              <div className="modmes_section-header-actions">
                {/* Selector de Año */}
                <div className="modmes_year-picker" ref={yearRef}>
                  <button
                    type="button"
                    className="modmes_year-button"
                    onClick={() => setShowYearPicker((s) => !s)}
                    title="Cambiar año"
                    aria-haspopup="listbox"
                    aria-expanded={showYearPicker}
                  >
                    <FontAwesomeIcon icon={faCalendarAlt} />
                    <span>{anioEfectivo}</span>
                  </button>

                  {showYearPicker && (
                    <div className="modmes_year-popover" role="listbox" aria-label="Seleccionar año">
                      {anios.map((anio) => {
                        const val = String(anio);
                        const isActive = anioEfectivo === val;
                        return (
                          <button
                            key={val}
                            className={`modmes_year-item ${isActive ? "active" : ""}`}
                            onClick={() => handleYearPick(val)}
                            role="option"
                            aria-selected={isActive}
                          >
                            {val}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Botón Seleccionar Todos */}
                <button
                  type="button"
                  className="modmes_btn modmes_btn-small modmes_btn-terciario"
                  onClick={seleccionarTodos}
                  disabled={periodosNoAnual.length === 0 && !anualPeriodo}
                  title={ventanaActiva ? "Seleccionar todos (equivale a Contado Anual)" : "Seleccionar todos los bimestres"}
                >
                  {soloAnualSeleccionado || allNoAnualSelected
                    ? (ventanaActiva ? `Deseleccionar (CONTADO ANUAL)` : `Deseleccionar todos`)
                    : (ventanaActiva ? `Seleccionar todos (CONTADO ANUAL)` : `Seleccionar todos (${totalSeleccionados})`)}
                </button>
              </div>
            </div>

            <div className="modmes_periodos-grid-container">
              <div className="modmes_periodos-grid">
                {periodosOrdenados.map((p) => {
                  const strId = String(p.id);
                  const checked = idsSeleccionadosComoString.includes(strId);
                  return (
                    <label
                      key={p.id}
                      className={`modmes_periodo-card ${checked ? "modmes_seleccionado" : ""}`}
                    >
                      <div className="modmes_periodo-checkbox">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleId(p.id)}
                          aria-checked={checked}
                          aria-label={p.nombre}
                        />
                        <span className="modmes_checkmark" aria-hidden="true" />
                      </div>
                      <span className="modmes_periodo-label">{p.nombre}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="modmes_footer modmes_footer-sides">
          <div className="modmes_footer-left">
            <div className="modmes_selection-info">
              {esAnualSeleccion ? "CONTADO ANUAL" : `${totalSeleccionados} seleccionados`}
            </div>
          </div>
          <div className="modmes_footer-right">
            <button
              type="button"
              className="modmes_btn modmes_btn-secondary modmes_action-btn"
              onClick={onCancelar}
            >
              <FontAwesomeIcon icon={faTimes} />
              <span className="btn-label">Cancelar</span>
            </button>

            {/* Pasa SIEMPRE { anio, seleccionados, esAnual, periodoTexto, importe_total } */}
            <button
              type="button"
              className="modmes_btn modmes_btn-primary modmes_action-btn"
              onClick={handleImprimir}
              disabled={totalSeleccionados === 0}
              title={esAnualSeleccion ? `Total: ${new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(totalCalculado)}` : undefined}
            >
              <FontAwesomeIcon icon={faPrint} />
              <span className="btn-label">Imprimir</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModalMesCuotas;
