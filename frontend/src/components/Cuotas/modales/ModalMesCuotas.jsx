// src/components/Cuotas/modales/ModalMesCuotas.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTimes,
  faCalendarAlt,
  faPrint,
  faFilePdf,
} from "@fortawesome/free-solid-svg-icons";
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
  // =========================
  // Helpers
  // =========================
  const normalize = (s = "") =>
    String(s)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .trim();

  const isAnualName = (p) => normalize(p?.nombre).includes("ANUAL");
  const ventanaActiva = ventanaAnualActiva();

  const idsSeleccionadosComoString = useMemo(
    () => seleccionados.map(String),
    [seleccionados]
  );

  const anioEfectivo = useMemo(() => {
    const prefer = String(anioSeleccionado || "").trim();
    if (prefer) return prefer;
    if (anios && anios.length) return String(anios[0]);
    return String(new Date().getFullYear());
  }, [anioSeleccionado, anios]);

  // =========================
  // ✅ NUEVO: al cambiar el año, deselecciono todo
  // =========================
  const prevAnioRef = useRef(anioEfectivo);
  useEffect(() => {
    const prev = prevAnioRef.current;
    if (String(prev) !== String(anioEfectivo)) {
      onSeleccionadosChange?.([]); // 🔥 deselecciona cajas
    }
    prevAnioRef.current = anioEfectivo;
  }, [anioEfectivo, onSeleccionadosChange]);

  // =========================
  // Montos base (referencia/anual)
  // =========================
  const [mMensual, setMMensual] = useState(Number(montoMensual) || 0);
  const [mAnual, setMAnual] = useState(Number(montoAnual) || 0);

  useEffect(() => {
    setMMensual(Number(montoMensual) || 0);
    setMAnual(Number(montoAnual) || 0);
  }, [montoMensual, montoAnual]);

  // =========================
  // Socio enriquecido (para comprobante)
  // =========================
  const [socioDet, setSocioDet] = useState(null);
  const [cargandoSocio, setCargandoSocio] = useState(false);

  useEffect(() => {
    const fetchSocio = async () => {
      if (!id_socio) {
        setSocioDet(null);
        return;
      }
      setCargandoSocio(true);
      try {
        const res = await fetch(
          `${BASE_URL}/api.php?action=socio_comprobante&id=${encodeURIComponent(
            id_socio
          )}`
        );
        const data = await res.json();
        if (data?.exito && data.socio) {
          const s = data.socio;
          setSocioDet({
            ...s,
            id_socio: s.id_socio ?? id_socio,
            nombre_categoria: s.nombre_categoria || "",
            id_categoria: s.id_categoria ?? null,
          });

          // si el backend manda montos, los tomo como referencia
          if (Number(s.monto_mensual)) setMMensual(Number(s.monto_mensual));
          if (Number(s.monto_anual)) setMAnual(Number(s.monto_anual));
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

  const socioBase = useMemo(
    () => (socioDet ? socioDet : socioInfo || {}),
    [socioDet, socioInfo]
  );

  // =========================
  // Períodos visibles/filtrados
  // =========================
  const periodosConVisibilidad = useMemo(() => {
    if (ventanaActiva) return periodos;
    return periodos.filter((p) => !isAnualName(p));
  }, [periodos, ventanaActiva]);

  const periodosFiltradosPorAnio = useMemo(() => {
    if (!anioEfectivo) return periodosConVisibilidad;
    return periodosConVisibilidad.filter((p) => {
      const nombrePeriodo = p.nombre || "";
      const matchAnio = nombrePeriodo.match(/(20\d{2})/);
      return matchAnio ? String(matchAnio[1]) === String(anioEfectivo) : true;
    });
  }, [periodosConVisibilidad, anioEfectivo]);

  const anualPeriodo = useMemo(
    () => periodosFiltradosPorAnio.find(isAnualName) || null,
    [periodosFiltradosPorAnio]
  );

  const periodosNoAnual = useMemo(
    () => periodosFiltradosPorAnio.filter((p) => !isAnualName(p)),
    [periodosFiltradosPorAnio]
  );

  const idsNoAnual = useMemo(
    () => periodosNoAnual.map((p) => String(p.id)),
    [periodosNoAnual]
  );

  const selectedNoAnualCount = useMemo(
    () => idsNoAnual.filter((id) => idsSeleccionadosComoString.includes(id))
      .length,
    [idsNoAnual, idsSeleccionadosComoString]
  );

  const allNoAnualSelected = useMemo(
    () =>
      idsNoAnual.length > 0 && selectedNoAnualCount === idsNoAnual.length,
    [idsNoAnual.length, selectedNoAnualCount]
  );

  const algunAnualSeleccionado = useMemo(() => {
    if (!anualPeriodo) return false;
    return idsSeleccionadosComoString.includes(String(anualPeriodo.id));
  }, [anualPeriodo, idsSeleccionadosComoString]);

  const soloAnualSeleccionado =
    algunAnualSeleccionado && seleccionados.length === 1;

  // =========================
  // ESC / cerrar
  // =========================
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

  // =========================
  // Year picker UI
  // =========================
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
  // ✅ MONTOS POR PERÍODO (como ModalPagos) + ✅ SIN PARPADEO
  // =========================
  const [montosPorPeriodo, setMontosPorPeriodo] = useState({});
  const [montosPeriodosListos, setMontosPeriodosListos] = useState(true);

  const [totalStable, setTotalStable] = useState(0);
  const [loadingMontos, setLoadingMontos] = useState(false);

  const montosPeriodoAbortRef = useRef(null);
  const montosPeriodoReqIdRef = useRef(0);
  const montosPeriodoCacheRef = useRef(new Map());

  const buildMontosQS = (idPeriodo) => {
    const qs = new URLSearchParams();
    if (id_cat_monto) qs.set("id_cat_monto", String(id_cat_monto));
    if (id_socio) qs.set("id_socio", String(id_socio));

    qs.set("anio", String(anioEfectivo));
    if (idPeriodo) qs.set("id_periodo", String(idPeriodo));

    return qs.toString();
  };

  const buildMontosCacheKey = (idPeriodo) => {
    return `anio=${anioEfectivo}|periodo=${idPeriodo || 0}|id_cat_monto=${
      id_cat_monto || 0
    }|id_socio=${id_socio || 0}`;
  };

  const refrescarMontosBase = async (idPeriodoOpt = 0) => {
    if (!id_socio && !id_cat_monto) return;
    try {
      const res = await fetch(
        `${BASE_URL}/api.php?action=montos&${buildMontosQS(idPeriodoOpt || 0)}`
      );
      const data = await res.json();
      if (data?.exito) {
        if (Number(data.mensual)) setMMensual(Number(data.mensual));
        if (Number(data.anual)) setMAnual(Number(data.anual));
      }
    } catch {
      // silent
    }
  };

  const esAnualSeleccion = useMemo(() => {
    if (!ventanaActiva) return false;
    if (algunAnualSeleccionado) return true;
    return idsNoAnual.length > 0 && selectedNoAnualCount === idsNoAnual.length;
  }, [ventanaActiva, algunAnualSeleccionado, idsNoAnual.length, selectedNoAnualCount]);

  const seleccionSinAnual = useMemo(() => {
    const anualId = anualPeriodo ? String(anualPeriodo.id) : null;
    return idsSeleccionadosComoString.filter((id) => !(anualId && id === anualId));
  }, [idsSeleccionadosComoString, anualPeriodo]);

  const refrescarMontosDePeriodosSeleccionados = async () => {
    if (condonar || esAnualSeleccion || seleccionSinAnual.length === 0) {
      setMontosPeriodosListos(true);
      setLoadingMontos(false);
      return;
    }

    const ids = seleccionSinAnual
      .map((x) => Number(x))
      .filter(Number.isFinite)
      .sort((a, b) => a - b);

    const nextLocal = { ...montosPorPeriodo };
    const missing = [];

    for (const idp of ids) {
      const key = buildMontosCacheKey(idp);
      if (montosPeriodoCacheRef.current.has(key)) {
        nextLocal[idp] = Number(montosPeriodoCacheRef.current.get(key)) || 0;
      } else if (nextLocal[idp] == null) {
        missing.push(idp);
      }
    }

    setMontosPorPeriodo(nextLocal);

    if (missing.length === 0) {
      const ok = ids.every((idp) => Number(nextLocal[idp]) > 0);
      setMontosPeriodosListos(ok);
      setLoadingMontos(false);
      return;
    }

    setMontosPeriodosListos(false);
    setLoadingMontos(true);

    if (montosPeriodoAbortRef.current) {
      try {
        montosPeriodoAbortRef.current.abort();
      } catch {}
    }
    const ctrl = new AbortController();
    montosPeriodoAbortRef.current = ctrl;

    const reqId = ++montosPeriodoReqIdRef.current;

    try {
      const results = await Promise.all(
        missing.map(async (idp) => {
          const res = await fetch(
            `${BASE_URL}/api.php?action=montos&${buildMontosQS(idp)}`,
            { signal: ctrl.signal }
          );
          const data = await res.json();
          return { idp, data };
        })
      );

      if (reqId !== montosPeriodoReqIdRef.current) return;

      const merged = { ...nextLocal };

      for (const { idp, data } of results) {
        if (data?.exito) {
          const monto = Number(data.mensual) || 0;
          merged[idp] = monto;

          const key = buildMontosCacheKey(idp);
          montosPeriodoCacheRef.current.set(key, monto);

          if (Number(data.anual) > 0) setMAnual(Number(data.anual));
        } else {
          merged[idp] = merged[idp] ?? 0;
        }
      }

      setMontosPorPeriodo(merged);

      const ok = ids.every((idp) => Number(merged[idp]) > 0);
      setMontosPeriodosListos(ok);
      setLoadingMontos(false);
    } catch (e) {
      if (e?.name === "AbortError") return;
      setMontosPeriodosListos(false);
      setLoadingMontos(false);
    }
  };

  useEffect(() => {
    refrescarMontosDePeriodosSeleccionados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id_socio, id_cat_monto, anioEfectivo, esAnualSeleccion, seleccionSinAnual.join(","), condonar]);

  useEffect(() => {
    setMontosPorPeriodo({});
    setMontosPeriodosListos(true);
    setLoadingMontos(false);
    montosPeriodoCacheRef.current.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anioEfectivo, id_socio, id_cat_monto]);

  // =========================
  // Toggle selección
  // =========================
  const toggleId = async (id) => {
    const strId = String(id);
    const p = periodosFiltradosPorAnio.find((x) => String(x.id) === strId);
    const esAnual = p ? isAnualName(p) : false;
    const yaEsta = idsSeleccionadosComoString.includes(strId);

    if (esAnual) {
      if (!ventanaActiva) return;
      if (!yaEsta) {
        await refrescarMontosBase(id);
        onSeleccionadosChange([id]);
      } else {
        onSeleccionadosChange([]);
      }
      return;
    }

    const base = seleccionados.filter((x) => {
      const pp = periodosFiltradosPorAnio.find(
        (q) => String(q.id) === String(x)
      );
      return !(pp && isAnualName(pp));
    });

    const next = yaEsta
      ? base.filter((pid) => String(pid) !== strId)
      : [...base, id];

    if (ventanaActiva && anualPeriodo) {
      const nextStr = next.map(String);
      const completa =
        idsNoAnual.length > 0 &&
        nextStr.length === idsNoAnual.length &&
        idsNoAnual.every((n) => nextStr.includes(n));

      if (completa) {
        await refrescarMontosBase(anualPeriodo.id);
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
      await refrescarMontosBase(anualPeriodo.id);
      onSeleccionadosChange([anualPeriodo.id]);
    } else {
      onSeleccionadosChange(periodosNoAnual.map((p) => p.id));
    }
  };

  // =========================
  // Orden
  // =========================
  const periodosOrdenados = useMemo(() => {
    return periodosFiltradosPorAnio.slice().sort((a, b) => {
      const na = Number(a.id);
      const nb = Number(b.id);
      if (Number.isNaN(na) || Number.isNaN(nb))
        return String(a.id).localeCompare(String(b.id), "es");
      return na - nb;
    });
  }, [periodosFiltradosPorAnio]);

  // =========================
  // Texto + Total (SUMA REAL POR PERIODO)
  // =========================
  const periodoTexto = useMemo(() => {
    if (esAnualSeleccion) return `CONTADO ANUAL ${anioEfectivo}`;

    const pares = periodosNoAnual
      .filter((p) => idsSeleccionadosComoString.includes(String(p.id)))
      .map((p) =>
        (p?.nombre || "")
          .replace(/^\s*per[ií]odo?s?\s*:?\s*/i, "")
          .trim()
      );

    const cuerpo = pares.join(" / ");
    return `${cuerpo} ${anioEfectivo}`.trim();
  }, [esAnualSeleccion, periodosNoAnual, idsSeleccionadosComoString, anioEfectivo]);

  const totalCalculado = useMemo(() => {
    if (condonar) return 0;
    if (esAnualSeleccion) return Number(mAnual) || 0;

    let suma = 0;
    for (const idStr of seleccionSinAnual) {
      const idp = Number(idStr);
      if (!Number.isFinite(idp)) continue;
      const v = Number(montosPorPeriodo[idp]);
      if (Number.isFinite(v)) suma += v;
    }
    return suma;
  }, [condonar, esAnualSeleccion, mAnual, seleccionSinAnual, montosPorPeriodo]);

  useEffect(() => {
    if (condonar) {
      setTotalStable(0);
      return;
    }
    if (esAnualSeleccion) {
      if (Number(mAnual) > 0) setTotalStable(Number(mAnual) || 0);
      return;
    }

    if (
      seleccionSinAnual.length > 0 &&
      montosPeriodosListos &&
      Number(totalCalculado) > 0
    ) {
      setTotalStable(Number(totalCalculado) || 0);
    }

    if (seleccionados.length === 0) setTotalStable(0);
  }, [
    condonar,
    esAnualSeleccion,
    mAnual,
    montosPeriodosListos,
    totalCalculado,
    seleccionados.length,
    seleccionSinAnual.length,
  ]);

  const buildSocioParaComprobante = () => {
    const periodoCodigo = esAnualSeleccion
      ? anualPeriodo?.id || 7
      : seleccionados[0] || 0;

    const importe = condonar
      ? 0
      : esAnualSeleccion
      ? Number(mAnual) || 0
      : Number(totalStable) || 0;

    return {
      ...socioBase,
      id_periodo: periodoCodigo,
      periodo_texto: periodoTexto,
      importe_total: importe,
      anio: anioEfectivo,
    };
  };

  // =========================
  // Acciones (Imprimir / PDF)
  // =========================
  const [modoSalida, setModoSalida] = useState("imprimir");

  const handleGenerarPDFComprobante = async () => {
    if (esAnualSeleccion) await refrescarMontosBase(anualPeriodo?.id || 0);
    if (
      !condonar &&
      !esAnualSeleccion &&
      seleccionados.length > 0 &&
      !montosPeriodosListos
    ) {
      await refrescarMontosDePeriodosSeleccionados();
    }

    const socioParaImprimir = buildSocioParaComprobante();
    const periodoCodigo = socioParaImprimir.id_periodo;

    await generarReciboPDFUnico({
      listaSocios: [socioParaImprimir],
      periodoActual: periodoCodigo,
      anioSeleccionado: anioEfectivo,
      headerImageUrl: `${BASE_URL}/assets/cabecera_rh.png`,
      nombreArchivo: `Comprobante_${socioBase.id_socio || id_socio}_${anioEfectivo}.pdf`,
      baseUrl: BASE_URL,
    });
  };

  const handleImprimir = async () => {
    if (esAnualSeleccion) await refrescarMontosBase(anualPeriodo?.id || 0);
    if (
      !condonar &&
      !esAnualSeleccion &&
      seleccionados.length > 0 &&
      !montosPeriodosListos
    ) {
      await refrescarMontosDePeriodosSeleccionados();
    }

    onImprimir?.({
      anio: Number(anioEfectivo),
      seleccionados: [...seleccionados],
      esAnual: esAnualSeleccion,
      periodoTexto,
      importe_total: condonar ? 0 : Number(totalStable) || 0,
      socioEnriquecido: { ...socioBase },
    });
  };

  const handleAccionPrincipal = async () => {
    if (modoSalida === "imprimir") return handleImprimir();
    return handleGenerarPDFComprobante();
  };

  // =========================
  // UI flags
  // =========================
  const totalSeleccionados = seleccionados.length;

  const bloquearPrincipal =
    !condonar &&
    (esAnualSeleccion
      ? Number(mAnual) <= 0
      : totalSeleccionados > 0 &&
        (!montosPeriodosListos || Number(totalStable) <= 0));

  // =========================
  // Render
  // =========================
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

          <button
            className="modmes_close-btn"
            onClick={onCancelar}
            aria-label="Cerrar"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M12 4L4 12M4 4L12 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
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
                  <label
                    className={`modmes_mode-option ${
                      modoSalida === "imprimir" ? "active" : ""
                    }`}
                  >
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

                  <label
                    className={`modmes_mode-option ${
                      modoSalida === "pdf" ? "active" : ""
                    }`}
                  >
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
                    <div
                      className="modmes_year-popover"
                      role="listbox"
                      aria-label="Seleccionar año"
                    >
                      {anios.map((anio) => {
                        const val = String(anio);
                        const isActive = anioEfectivo === val;
                        return (
                          <button
                            key={val}
                            className={`modmes_year-item ${
                              isActive ? "active" : ""
                            }`}
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

                {/* Seleccionar Todos */}
                <button
                  type="button"
                  className="modmes_btn modmes_btn-small modmes_btn-terciario modmes_btn-tight"
                  onClick={seleccionarTodos}
                  disabled={periodosNoAnual.length === 0 && !anualPeriodo}
                  title={
                    ventanaActiva
                      ? "Seleccionar todos (equivale a Contado Anual)"
                      : "Seleccionar todos los bimestres"
                  }
                >
                  {soloAnualSeleccionado || allNoAnualSelected ? "Quitar" : "Todos"}
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
                      className={`modmes_periodo-card ${
                        checked ? "modmes_seleccionado" : ""
                      }`}
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
              <div style={{ padding: "6px 10px", fontSize: 12, opacity: 0.8 }}>
                Cargando datos del socio…
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="modmes_footer modmes_footer-sides">
          <div className="modmes_footer-left">
            <div
              className="modmes_total-badge"
              style={{ display: "flex", alignItems: "center", gap: 8 }}
            >
              <span>
                Total:&nbsp;
                {new Intl.NumberFormat("es-AR", {
                  style: "currency",
                  currency: "ARS",
                  maximumFractionDigits: 0,
                }).format(totalStable)}
              </span>

              {loadingMontos && (
                <span
                  title="Calculando…"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    opacity: 0.8,
                    fontSize: 12,
                    userSelect: "none",
                  }}
                >
                  <span className="modmes_dot" />
                  <span className="modmes_dot" />
                  <span className="modmes_dot" />
                </span>
              )}
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
              disabled={totalSeleccionados === 0 || bloquearPrincipal}
              title={bloquearPrincipal ? "Cargando montos…" : undefined}
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

      <style>{`
        .modmes_dot{
          width:4px;height:4px;border-radius:999px;
          background: currentColor;
          display:inline-block;
          animation: modmesDot 1s infinite ease-in-out;
        }
        .modmes_dot:nth-child(2){ animation-delay: .15s; }
        .modmes_dot:nth-child(3){ animation-delay: .30s; }
        @keyframes modmesDot{
          0%,80%,100%{ transform: translateY(0); opacity:.35; }
          40%{ transform: translateY(-3px); opacity:1; }
        }
      `}</style>
    </div>
  );
};

export default ModalMesCuotas;
