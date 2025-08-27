import React, { useEffect, useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faCalendarAlt, faPrint } from "@fortawesome/free-solid-svg-icons";
import "./ModalMesCuotas.css";

const ModalMesCuotas = ({
  periodos = [],
  seleccionados = [],
  onSeleccionadosChange,
  onCancelar,
  onImprimir,
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

  const periodosNoAnual = useMemo(
    () => periodos.filter((p) => !isAnual(p)),
    [periodos]
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

    if (yaEsta) {
      onSeleccionadosChange(seleccionados.filter((x) => String(x) !== strId));
    } else {
      onSeleccionadosChange([...seleccionados, id]);
    }
  };

  const seleccionarTodos = () => {
    if (allNoAnualSelected) {
      onSeleccionadosChange([]);
    } else {
      onSeleccionadosChange(periodosNoAnual.map((p) => p.id));
    }
  };

  const periodosOrdenados = useMemo(() => {
    return periodos.slice().sort((a, b) => {
      const na = Number(a.id);
      const nb = Number(b.id);
      if (Number.isNaN(na) || Number.isNaN(nb)) {
        return String(a.id).localeCompare(String(b.id), "es");
      }
      return na - nb;
    });
  }, [periodos]);

  const totalSeleccionados = seleccionados.length;

  return (
    <div className="mescuot_overlay">
      <div className="mescuot_contenido">
        {/* Header */}
        <div className="mescuot_header">
          <div className="mescuot_header-left">
            <div className="mescuot_icon-circle">
              <FontAwesomeIcon icon={faCalendarAlt} />
            </div>
            <div className="mescuot_header-texts">
              <h2 className="mescuot_title">Seleccionar Períodos</h2>
            </div>
          </div>
          <button className="mescuot_close-btn" onClick={onCancelar} aria-label="Cerrar">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="mescuot_body">
          <div className="mescuot_periodos-section">
            <div className="mescuot_section-header">
              <h4 className="mescuot_section-title">Períodos disponibles</h4>
              <div className="mescuot_section-header-actions">
                <button
                  type="button"
                  className="mescuot_btn mescuot_btn-small mescuot_btn-terciario"
                  onClick={seleccionarTodos}
                  disabled={periodosNoAnual.length === 0}
                >
                  {allNoAnualSelected
                    ? `Deseleccionar todos (${totalSeleccionados})`
                    : `Seleccionar todos (${totalSeleccionados})`}
                </button>
              </div>
            </div>

            <div className="mescuot_periodos-grid-container">
              <div className="mescuot_periodos-grid">
                {periodosOrdenados.map((p) => {
                  const strId = String(p.id);
                  const checked = idsSeleccionadosComoString.includes(strId);
                  return (
                    <label
                      key={p.id}
                      className={`mescuot_periodo-card ${checked ? "mescuot_seleccionado" : ""}`}
                    >
                      <div className="mescuot_periodo-checkbox">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleId(p.id)}
                          aria-checked={checked}
                          aria-label={p.nombre}
                        />
                        <span className="mescuot_checkmark" aria-hidden="true" />
                      </div>
                      <span className="mescuot_periodo-label">{p.nombre}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mescuot_footer mescuot_footer-sides">
          <div className="mescuot_footer-left">
            <div className="mescuot_selection-info">
              {soloAnualSeleccionado ? "1" : `${totalSeleccionados}`} seleccionados
            </div>
          </div>
          <div className="mescuot_footer-right">
            <button
              type="button"
              className="mescuot_btn mescuot_btn-secondary mescuot_action-btn"
              onClick={onCancelar}
            >
              <FontAwesomeIcon icon={faTimes} />
              <span className="btn-label">Cancelar</span>
            </button>
            <button
              type="button"
              className="mescuot_btn mescuot_btn-primary mescuot_action-btn"
              onClick={onImprimir}
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
