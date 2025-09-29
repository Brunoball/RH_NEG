import React, { useEffect, useMemo, useState, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faCalendarAlt, faPrint, faFilePdf } from "@fortawesome/free-solid-svg-icons";
import BASE_URL from "../../../config/config";
import { generarReciboPDFUnico } from "../../../utils/ReciboPDF";
import "./ModalMesCuotas.css";

const MESES_ANIO = 6;

const ventanaAnualActiva = () => {
  const hoy = new Date();
  const y = hoy.getFullYear();
  const startActual = new Date(y, 11, 15);
  const endSiguiente = new Date(y + 1, 2, 1);
  if (hoy >= startActual && hoy < endSiguiente) return true;

  const startPrev = new Date(y - 1, 11, 15);
  const endActual = new Date(y, 2, 1);
  if (hoy >= startPrev && hoy < endActual) return true;

  return false;
};

const ModalMesCuotas = ({
  periodos = [],
  seleccionados = [],
  onSeleccionadosChange,
  onCancelar,
  onImprimir,
  anios = [],
  anioSeleccionado = "",
  onAnioChange = () => {},
  montoMensual = 0,
  montoAnual = 0,
  condonar = false,
  id_socio,
  id_cat_monto,
  socioInfo = {},
}) => {
  const normalize = (s = "") =>
    String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
  const isAnualName = (p) => normalize(p?.nombre).includes("ANUAL");
  const ventanaActiva = ventanaAnualActiva();

  const [mMensual, setMMensual] = useState(Number(montoMensual) || 0);
  const [mAnual, setMAnual] = useState(Number(montoAnual) || 0);
  const [modoSalida, setModoSalida] = useState("imprimir");

  // Socio enriquecido desde backend (trae nombre_categoria / id_categoria correctos)
  const [socioDet, setSocioDet] = useState(null);
  const [cargandoSocio, setCargandoSocio] = useState(false);

  useEffect(() => {
    setMMensual(Number(montoMensual) || 0);
    setMAnual(Number(montoAnual) || 0);
  }, [montoMensual, montoAnual]);

  // Trae socio_comprobante para tener categoría correcta
  useEffect(() => {
    const fetchSocio = async () => {
      if (!id_socio) { setSocioDet(null); return; }
      setCargandoSocio(true);
      try {
        const res = await fetch(`${BASE_URL}/api.php?action=socio_comprobante&id=${encodeURIComponent(id_socio)}`);
        const data = await res.json();
        if (data?.exito && data.socio) {
          const s = data.socio;
          setSocioDet({
            ...s,
            id_socio: s.id_socio ?? id_socio,
            nombre_categoria: s.nombre_categoria || "",
            id_categoria: s.id_categoria ?? null,
          });
          if (Number(s.monto_mensual)) setMMensual(Number(s.monto_mensual));
          if (Number(s.monto_anual))   setMAnual(Number(s.monto_anual));
        } else {
          setSocioDet(null);
        }
      } catch {
        setSocioDet(null);
      } finally {
        setCargandoSocio(false);
      }
    };
    fetchSocio();
  }, [id_socio]);

  const refrescarMontosActuales = async () => {
    if (!id_socio && !id_cat_monto) return;
    try {
      const qs = new URLSearchParams();
      if (id_cat_monto) qs.set("id_cat_monto", String(id_cat_monto));
      if (id_socio)     qs.set("id_socio",     String(id_socio));
      const res = await fetch(`${BASE_URL}/api.php?action=montos&${qs.toString()}`);
      const data = await res.json();
      if (data?.exito) {
        setMMensual(Number(data.mensual) || 0);
        setMAnual(Number(data.anual) || 0);
      }
    } catch {/* silent */}
  };

  const idsSeleccionadosComoString = useMemo(
    () => seleccionados.map(String),
    [seleccionados]
  );

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

  const soloAnualSeleccionado = algunAnualSeleccionado && seleccionados.length === 1;

  const anioEfectivo = useMemo(() => {
    const prefer = String(anioSeleccionado || "").trim();
    if (prefer) return prefer;
    if (anios && anios.length) return String(anios[0]);
    return String(new Date().getFullYear());
  }, [anioSeleccionado, anios]);

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
      if (!ventanaActiva) return;
      if (!yaEsta) {
        await refrescarMontosActuales();
        onSeleccionadosChange([id]);
      } else {
        onSeleccionadosChange([]);
      }
      return;
    }

    const base = seleccionados.filter((x) => {
      const pp = periodosFiltradosPorAnio.find((q) => String(q.id) === String(x));
      return !(pp && isAnualName(pp));
    });

    let next = yaEsta
      ? base.filter((pid) => String(pid) !== strId)
      : [...base, id];

    if (ventanaActiva && anualPeriodo) {
      const nextStr = next.map(String);
      const completa =
        idsNoAnual.length > 0 &&
        nextStr.length === idsNoAnual.length &&
        idsNoAnual.every((n) => nextStr.includes(n));
      if (completa) {
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

  // Year picker
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
  const esAnualSeleccion = useMemo(() => {
    if (!ventanaActiva) return false;
    if (algunAnualSeleccionado) return true;
    return idsNoAnual.length > 0 && selectedNoAnualCount === idsNoAnual.length;
  }, [ventanaActiva, algunAnualSeleccionado, idsNoAnual.length, selectedNoAnualCount]);

  const cantidadBimestresSeleccionados = useMemo(() => {
    if (esAnualSeleccion) return MESES_ANIO;
    return periodosNoAnual.reduce(
      (acc, p) => acc + (idsSeleccionadosComoString.includes(String(p.id)) ? 1 : 0),
      0
    );
  }, [esAnualSeleccion, periodosNoAnual, idsSeleccionadosComoString]);

  const periodoTexto = useMemo(() => {
    if (esAnualSeleccion) return `CONTADO ANUAL ${anioEfectivo}`;
    const pares = periodosNoAnual
      .filter((p) => idsSeleccionadosComoString.includes(String(p.id)))
      .map((p) => (p?.nombre || "").replace(/^\s*per[ií]odo?s?\s*:?\s*/i, "").trim());
    const cuerpo = pares.join(" ");
    return `${cuerpo} ${anioEfectivo}`.trim();
  }, [esAnualSeleccion, periodosNoAnual, idsSeleccionadosComoString, anioEfectivo]);

  const totalCalculado = useMemo(() => {
    if (condonar) return 0;
    if (esAnualSeleccion) return Number(mAnual) || 0;
    return (Number(mMensual) || 0) * cantidadBimestresSeleccionados;
  }, [condonar, esAnualSeleccion, mAnual, mMensual, cantidadBimestresSeleccionados]);

  // Socio base (preferimos el enriquecido del backend)
  const socioBase = useMemo(() => {
    if (socioDet) return socioDet;
    return socioInfo || {};
  }, [socioDet, socioInfo]);

  const buildSocioParaComprobante = () => {
    const periodoCodigo = esAnualSeleccion 
      ? (anualPeriodo?.id || 7) 
      : (seleccionados[0] || 0);

    const importe = condonar
      ? 0
      : (esAnualSeleccion
          ? (Number(mAnual) || 0)
          : (Number(mMensual) || 0) * cantidadBimestresSeleccionados);

    return {
      ...socioBase,
      id_periodo: periodoCodigo,
      periodo_texto: periodoTexto,
      importe_total: importe,
      anio: anioEfectivo,
    };
  };

  const handleGenerarPDFComprobante = async () => {
    if (esAnualSeleccion) await refrescarMontosActuales();
    const socioParaImprimir = buildSocioParaComprobante();
    const periodoCodigo = socioParaImprimir.id_periodo;

    await generarReciboPDFUnico({
      listaSocios: [socioParaImprimir],
      periodoActual: periodoCodigo,
      anioSeleccionado: anioEfectivo,
      headerImageUrl: `${BASE_URL}/assets/cabecera_rh.png`,
      nombreArchivo: `Comprobante_${socioBase.id_socio || id_socio}_${anioEfectivo}.pdf`,
      baseUrl: BASE_URL
    });
  };

  const handleImprimir = async () => {
    if (esAnualSeleccion) await refrescarMontosActuales();

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
      socioEnriquecido: { ...socioBase },
    });
  };

  const handleAccionPrincipal = async () => {
    if (modoSalida === "imprimir") {
      await handleImprimir();
    } else {
      await handleGenerarPDFComprobante();
    }
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

              {/* Centro: Imprimir / PDF */}
              <div className="modmes_section-center">
                <div className="modmes_output-mode">
                  <label className={`modmes_mode-option ${modoSalida === "imprimir" ? "active" : ""}`}>
                    <input
                      type="radio"
                      name="modoSalida"
                      value="imprimir"
                      checked={modoSalida === "imprimir"}
                      onChange={() => setModoSalida("imprimir")}
                    />
                    <span className="modmes_mode-bullet" />
                    <span>Imprimir</span>
                  </label>

                  <label className={`modmes_mode-option ${modoSalida === "pdf" ? "active" : ""}`}>
                    <input
                      type="radio"
                      name="modoSalida"
                      value="pdf"
                      checked={modoSalida === "pdf"}
                      onChange={() => setModoSalida("pdf")}
                    />
                    <span className="modmes_mode-bullet" />
                    <span>PDF</span>
                  </label>
                </div>
              </div>

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

                {/* Botón Seleccionar Todos — texto corto */}
                <button
                  type="button"
                  className="modmes_btn modmes_btn-small modmes_btn-terciario modmes_btn-tight"
                  onClick={seleccionarTodos}
                  disabled={periodosNoAnual.length === 0 && !anualPeriodo}
                  title={ventanaActiva ? "Seleccionar todos (equivale a Contado Anual)" : "Seleccionar todos los bimestres"}
                >
                  {soloAnualSeleccionado || allNoAnualSelected ? (ventanaActiva ? "Quitar" : "Quitar") : "Todos"}
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

            {cargandoSocio && (
              <div style={{padding:'6px 10px', fontSize:12, opacity:.8}}>
                Cargando datos del socio…
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="modmes_footer modmes_footer-sides">
          <div className="modmes_footer-left">
            <div className="modmes_total-badge">
              Total: {new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(totalCalculado)}
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

            <button
              type="button"
              className="modmes_btn modmes_btn-primary modmes_action-btn"
              onClick={handleAccionPrincipal}
              disabled={totalSeleccionados === 0}
            >
              {modoSalida === "imprimir" ? (
                <>
                  <FontAwesomeIcon icon={faPrint} />
                  <span className="btn-label">Imprimir</span>
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faFilePdf} />
                  <span className="btn-label">PDF</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModalMesCuotas;
