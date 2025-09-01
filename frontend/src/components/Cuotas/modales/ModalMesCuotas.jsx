// src/components/Cuotas/modales/ModalMesCuotas.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faCalendarAlt, faPrint } from "@fortawesome/free-solid-svg-icons";
import "./ModalMesCuotas.css";

const ModalMesCuotas = ({
  periodos = [],
  seleccionados = [],
  onSeleccionadosChange,
  onCancelar,
  onImprimir,                // recibe { anio, seleccionados }
  anios = [],
  anioSeleccionado = "",
  onAnioChange = () => {},
}) => {
  const normalize = (s = "") =>
    String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();

  const isAnual = (p) => normalize(p?.nombre).includes("ANUAL");

  const idsSeleccionadosComoString = useMemo(
    () => seleccionados.map(String),
    [seleccionados]
  );

  const anualPeriodo = useMemo(() => periodos.find(isAnual) || null, [periodos]);

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
    if (!anioEfectivo) return periodos;
    return periodos.filter((p) => {
      const nombrePeriodo = p.nombre || "";
      const matchAnio = nombrePeriodo.match(/(20\d{2})/);
      return matchAnio ? String(matchAnio[1]) === String(anioEfectivo) : true;
    });
  }, [periodos, anioEfectivo]);

  const periodosNoAnual = useMemo(
    () => periodosFiltradosPorAnio.filter((p) => !isAnual(p)),
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

  const toggleId = (id) => {
    const strId = String(id);
    const p = periodos.find((x) => String(x.id) === strId);
    const esAnual = p ? normalize(p?.nombre).includes("ANUAL") : false;
    const yaEsta = idsSeleccionadosComoString.includes(strId);

    if (esAnual) {
      onSeleccionadosChange(yaEsta ? [] : [id]);
      return;
    }
    if (algunAnualSeleccionado) {
      onSeleccionadosChange([id]);
      return;
    }

    let next = yaEsta
      ? seleccionados.filter((x) => String(x) !== strId)
      : [...seleccionados, id];

    if (anualPeriodo) {
      const nextStr = next.map(String);
      const completa =
        idsNoAnual.length > 0 &&
        nextStr.length === idsNoAnual.length &&
        idsNoAnual.every((n) => nextStr.includes(n));
      if (completa) {
        onSeleccionadosChange([anualPeriodo.id]);
        return;
      }
    }

    onSeleccionadosChange(next);
  };

  const seleccionarTodos = () => {
    if (soloAnualSeleccionado || allNoAnualSelected) {
      onSeleccionadosChange([]);
      return;
    }
    if (anualPeriodo) {
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
                  title="Seleccionar todos (equivalente a Contado Anual)"
                >
                  {soloAnualSeleccionado || allNoAnualSelected
                    ? `Deseleccionar (CONTADO ANUAL)`
                    : `Seleccionar todos (${totalSeleccionados})`}
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
              {soloAnualSeleccionado
                ? "CONTADO ANUAL"
                : (allNoAnualSelected ? "CONTADO ANUAL" : `${totalSeleccionados} seleccionados`)}
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

            {/* Pasa SIEMPRE { anio, seleccionados } */}
            <button
              type="button"
              className="modmes_btn modmes_btn-primary modmes_action-btn"
              onClick={() =>
                onImprimir?.({
                  anio: Number(anioEfectivo),
                  seleccionados: [...seleccionados],
                })
              }
              disabled={totalSeleccionados === 0}
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
