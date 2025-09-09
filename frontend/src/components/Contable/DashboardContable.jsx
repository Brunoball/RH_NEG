// src/components/Contable/DashboardContable.jsx
import React, { useState, useEffect, useMemo, useRef, useTransition, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "./dashboard.css";
import BASE_URL from "../../config/config";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faDollarSign,
  faCalendarAlt,
  faExclamationTriangle,
  faTimes,
  faListAlt,
  faTable,
  faChartPie,
  faFileExcel,
  faSearch,
  faMagnifyingGlass,
  faFilter,
} from "@fortawesome/free-solid-svg-icons";
import * as XLSX from "xlsx";
import ContableChartsModal from "./modalcontable/ContableChartsModal";

/* ===== Constantes ===== */
const MESES_NOMBRES = Object.freeze([
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"
]);
const mesUC = (mNum) => MESES_NOMBRES[mNum - 1].toUpperCase();
const labelMes = (m) => m && m !== "Todos los meses" ? ` · ${mesUC(parseInt(m, 10))}` : "";

export default function DashboardContable() {
  const navigate = useNavigate();

  // ===== Filtros =====
  const [anioSeleccionado, setAnioSeleccionado] = useState("");
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState("Selecciona un periodo");
  const [mesSeleccionado, setMesSeleccionado] = useState("Todos los meses");
  const [cobradorSeleccionado, setCobradorSeleccionado] = useState("todos");
  const [searchText, setSearchText] = useState("");

  // ===== Datos base =====
  const [aniosDisponibles, setAniosDisponibles] = useState([]);
  const [periodosOpts, setPeriodosOpts] = useState([]);
  const [datosMeses, setDatosMeses] = useState([]);
  const [datosEmpresas, setDatosEmpresas] = useState([]);
  const [cobradores, setCobradores] = useState([]);
  const [totalSocios, setTotalSocios] = useState(0);
  const [condonados, setCondonados] = useState([]);

  // ===== UI =====
  const [error, setError] = useState(null);
  const [mostrarModalGraficos, setMostrarModalGraficos] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isLoadingTable, setIsLoadingTable] = useState(false);
  const computeRAF1 = useRef(0);
  const computeRAF2 = useRef(0);
  const [sidebarView, setSidebarView] = useState("filtros"); // 'filtros' | 'resumen'

  // ===== Utils =====
  const nfPesos = useMemo(() => new Intl.NumberFormat("es-AR"), []);
  const fetchJSON = useCallback(async (url, signal) => {
    const sep = url.includes("?") ? "&" : "?";
    const res = await fetch(`${url}${sep}ts=${Date.now()}`, { method: "GET", signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }, []);
  const ok  = (obj) => obj && (obj.success === true || obj.exito === true);
  const arr = (obj) => Array.isArray(obj?.data) ? obj.data : (Array.isArray(obj?.datos) ? obj.datos : []);

  // ---- Helpers
  const extractMonthsFromPeriodLabel = (label) => {
    if (!label) return [];
    const nums = String(label).match(/\d{1,2}/g) || [];
    const months = nums.map((n) => parseInt(n, 10)).filter((n) => !Number.isNaN(n) && n >= 1 && n <= 12);
    return Array.from(new Set(months));
  };
  const getMonthFromDate = (yyyy_mm_dd) => {
    if (!yyyy_mm_dd || typeof yyyy_mm_dd !== "string" || yyyy_mm_dd.length < 7) return null;
    const mm = parseInt(yyyy_mm_dd.substring(5, 7), 10);
    return Number.isNaN(mm) ? null : mm;
  };
  const getNombreCobrador = (p) =>
    p?.Cobrador || p?.Nombre_Cobrador || p?.nombre_cobrador || p?.cobrador || p?.Cobrador_Nombre || "";
  const isAnualLabel = (s) => String(s || "").toUpperCase().includes("ANUAL");

  const getTxt = (o, k) => (typeof o?.[k] === "string" ? o[k].trim() : "");

  // Nombre socio
  const getNombreSocio = (p) => {
    const combinado =
      getTxt(p, "Socio") || getTxt(p, "socio") ||
      getTxt(p, "Nombre_Completo") || getTxt(p, "nombre_completo");
    if (combinado) return combinado;

    const ape =
      getTxt(p, "Apellido") || getTxt(p, "apellido") ||
      getTxt(p, "Apellidos") || getTxt(p, "apellidos") ||
      getTxt(p, "Apellido_Socio") || getTxt(p, "apellido_socio");
    const nom =
      getTxt(p, "Nombre") || getTxt(p, "nombre") ||
      getTxt(p, "Nombres") || getTxt(p, "nombres") ||
      getTxt(p, "Nombre_Socio") || getTxt(p, "nombre_socio");
    if (ape && nom) return `${ape} ${nom}`.replace(/\s+/g, " ").trim();
    return ape || nom || "";
  };

  // Categoría
  const getCategoriaTxt = (p) =>
    getTxt(p, "Nombre_Categoria") ||
    getTxt(p, "nombre_categoria") ||
    getTxt(p, "Categoria") ||
    getTxt(p, "categoria") ||
    "";

  // Formato “Cat (Monto)”
  const catMontoStr = (cat, precioNum) => {
    const montoFmt = Number.isFinite(precioNum) ? nfPesos.format(precioNum) : "0";
    const catTxt = (cat || "-").toString().trim() || "-";
    return `${catTxt} (${montoFmt})`;
  };

  /* ========= Carga inicial ========= */
  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        setError(null);
        const rawListas = await fetchJSON(`${BASE_URL}/api.php?action=listas`, ctrl.signal).catch(() => null);
        let periodosSrv = [];
        let cobradoresSrv = [];
        if (rawListas && ok(rawListas) && rawListas.listas) {
          if (Array.isArray(rawListas.listas.periodos)) {
            periodosSrv = rawListas.listas.periodos
              .filter((p) => {
                const id = typeof p === "object" && p ? String(p.id ?? "") : "";
                const nombre = typeof p === "string" ? p : (p?.nombre || "");
                if (id === "7") return false; // oculto anual en filtros
                if (isAnualLabel(nombre)) return false;
                return true;
              })
              .map((p) => (typeof p === "string" ? p : (p?.nombre || "")))
              .map((s) => s.toString().trim())
              .filter(Boolean);
          }
          if (Array.isArray(rawListas.listas.cobradores)) {
            cobradoresSrv = rawListas.listas.cobradores
              .map((c) => c?.nombre)
              .filter(Boolean)
              .map(String)
              .sort((a, b) => a.localeCompare(b, "es"));
          }
        }
        if (periodosSrv.length === 0) {
          periodosSrv = Array.from({ length: 12 }, (_, i) => `PERÍODO ${i + 1}`);
        }
        const opts = periodosSrv.map((label) => ({ value: label, months: extractMonthsFromPeriodLabel(label) }));
        setPeriodosOpts(opts);
        setCobradores(cobradoresSrv);

        const rawContable = await fetchJSON(`${BASE_URL}/api.php?action=contable`, ctrl.signal);
        if (!ok(rawContable)) throw new Error("Respuesta inválida del servidor contable");

        const anios = Array.isArray(rawContable.anios) ? rawContable.anios.map((n) => parseInt(n, 10)).filter(Boolean) : [];
        setAniosDisponibles(anios);

        const anioSrv = parseInt(rawContable.anio_aplicado ?? 0, 10);
        const anioIni = anioSrv > 0 ? anioSrv : (anios.length ? Math.max(...anios) : "");
        setAnioSeleccionado(anioIni || "");

        setDatosMeses(arr(rawContable));
        setCondonados(Array.isArray(rawContable?.condonados) ? rawContable.condonados : []);
        setDatosEmpresas([]);
        setTotalSocios(Number(rawContable?.total_socios ?? 0) || 0);
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Error en carga inicial:", err);
          setError("Error al cargar datos. Verifique la conexión o intente más tarde.");
        }
      }
    })();
    return () => ctrl.abort();
  }, [fetchJSON]);

  /* ========= Re-fetch por año ========= */
  useEffect(() => {
    if (!anioSeleccionado) return;
    const ctrl = new AbortController();
    (async () => {
      try {
        const raw = await fetchJSON(`${BASE_URL}/api.php?action=contable&anio=${encodeURIComponent(anioSeleccionado)}`, ctrl.signal);
        if (!ok(raw)) throw new Error("Formato inválido en datos contables del año");

        const anios = Array.isArray(raw.anios) ? raw.anios.map((n) => parseInt(n, 10)).filter(Boolean) : [];
        setAniosDisponibles(anios);

        setDatosMeses(arr(raw));
        setCondonados(Array.isArray(raw?.condonados) ? raw.condonados : []);
        setTotalSocios(Number(raw?.total_socios ?? 0) || 0);

        setIsLoadingTable(true);
        requestAnimationFrame(() => requestAnimationFrame(() => setIsLoadingTable(false)));
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Error al cargar año:", err);
          setError("No se pudieron obtener los pagos del año seleccionado.");
        }
      }
    })();
    return () => ctrl.abort();
  }, [anioSeleccionado, fetchJSON]);

  // ======================== Precomputación ========================
  const pagosFlatEnriched = useMemo(() => {
    if (!Array.isArray(datosMeses) || datosMeses.length === 0) return [];
    const out = [];
    for (let i = 0; i < datosMeses.length; i++) {
      const b = datosMeses[i];
      if (Array.isArray(b?.pagos) && b.pagos.length) {
        for (let j = 0; j < b.pagos.length; j++) {
          const p = b.pagos[j];
          const _cb        = String(getNombreCobrador(p)).trim();
          const _month     = getMonthFromDate(p?.fechaPago);
          const _precioNum = parseFloat(p?.Precio) || 0; // del backend
          const _nombreCompleto = getNombreSocio(p);
          const _categoriaTxt   = getCategoriaTxt(p);
          out.push({ ...p, _cb, _month, _precioNum, _nombreCompleto, _categoriaTxt, _originalIndex: out.length });
        }
      }
    }
    return out;
  }, [datosMeses]);

  // Agrupar pagos por mes (para filtros)
  const pagosPorMes = useMemo(() => {
    const buckets = Array.from({ length: 13 }, () => []);
    for (let i = 0; i < pagosFlatEnriched.length; i++) {
      const p = pagosFlatEnriched[i];
      if (p._month != null && p._month >= 1 && p._month <= 12) buckets[p._month].push(p);
    }
    return buckets;
  }, [pagosFlatEnriched]);

  // Combinar periodos en función de los números que tenga el nombre
  const periodMergedMap = useMemo(() => {
    const map = new Map();
    for (const opt of periodosOpts) {
      const months = (opt?.months && opt.months.length) ? opt.months : extractMonthsFromPeriodLabel(opt?.value);
      if (!months || !months.length) continue;
      const merged = [];
      for (let m of months) if (m >= 1 && m <= 12 && pagosPorMes[m]?.length) merged.push(...pagosPorMes[m]);
      map.set(opt.value, merged);
    }
    return map;
  }, [periodosOpts, pagosPorMes]);

  /* ===== Meses disponibles por período ===== */
  const mesesDisponibles = useMemo(() => {
    if (!anioSeleccionado) return [];
    if (!periodoSeleccionado || periodoSeleccionado === "Selecciona un periodo") {
      return Array.from({ length: 12 }, (_, i) => i + 1);
    }
    const opt = periodosOpts.find(o => o.value === periodoSeleccionado);
    const ms  = opt?.months?.length ? opt.months : extractMonthsFromPeriodLabel(periodoSeleccionado);
    return (ms && ms.length) ? ms : [];
  }, [anioSeleccionado, periodoSeleccionado, periodosOpts]);

  useEffect(() => {
    if (mesSeleccionado !== "Todos los meses") {
      const n = parseInt(mesSeleccionado, 10);
      if (!mesesDisponibles.includes(n)) setMesSeleccionado("Todos los meses");
    }
  }, [mesesDisponibles, mesSeleccionado]);

  // ======= Derivados (con transición) =======
  const [derived, setDerived] = useState({ registros: [], total: 0, cobradoresUnicos: 0 });

  // ordenar por fecha desc (más reciente primero)
  const byFechaDesc = (a, b) => {
    const da = Date.parse(a?.fechaPago || "") || 0;
    const db = Date.parse(b?.fechaPago || "") || 0;
    return db - da;
  };
  const sortByFechaDesc = (arr) => [...arr].sort(byFechaDesc);

  const recompute = useCallback((periodLabel, monthSel, cobrador) => {
    const monthNum = monthSel && monthSel !== "Todos los meses" ? parseInt(monthSel, 10) : 0;

    if ((!periodLabel || periodLabel === "Selecciona un periodo") && !monthNum) {
      let base = (cobrador === "todos") ? pagosFlatEnriched : pagosFlatEnriched.filter((p) => p._cb === cobrador);
      base = sortByFechaDesc(base);
      let total = 0; const setCb = new Set();
      for (let i = 0; i < base.length; i++) { total += base[i]._precioNum; if (base[i]._cb) setCb.add(base[i]._cb); }
      return { registros: base, total, cobradoresUnicos: setCb.size };
    }

    if ((periodLabel === "Selecciona un periodo" || !periodLabel) && monthNum) {
      let base = pagosPorMes[monthNum] ? sortByFechaDesc(pagosPorMes[monthNum]) : [];
      if (cobrador !== "todos") base = base.filter((p) => p._cb === cobrador);
      let total = 0; const setCb = new Set();
      for (let i = 0; i < base.length; i++) { total += base[i]._precioNum; if (base[i]._cb) setCb.add(base[i]._cb); }
      return { registros: base, total, cobradoresUnicos: setCb.size };
    }

    let merged = periodMergedMap.get(periodLabel) || [];
    if (monthNum) merged = merged.filter((p) => p._month === monthNum);
    if (cobrador !== "todos") merged = merged.filter((p) => p._cb === cobrador);
    merged = sortByFechaDesc(merged);

    let total = 0; const setCb = new Set();
    for (let i = 0; i < merged.length; i++) { total += merged[i]._precioNum; if (merged[i]._cb) setCb.add(merged[i]._cb); }
    return { registros: merged, total, cobradoresUnicos: setCb.size };
  }, [pagosFlatEnriched, pagosPorMes, periodMergedMap]);

  useEffect(() => {
    if (!pagosFlatEnriched.length && !pagosPorMes.some(arr => arr.length)) {
      setDerived({ registros: [], total: 0, cobradoresUnicos: 0 });
      setIsLoadingTable(false);
      return;
    }
    setIsLoadingTable(true);
    cancelAnimationFrame(computeRAF1.current);
    cancelAnimationFrame(computeRAF2.current);
    computeRAF1.current = requestAnimationFrame(() => {
      startTransition(() => {
        const d = recompute(periodoSeleccionado, mesSeleccionado, cobradorSeleccionado);
        computeRAF2.current = requestAnimationFrame(() => {
          setDerived(d);
          setIsLoadingTable(false);
        });
      });
    });
    return () => { cancelAnimationFrame(computeRAF1.current); cancelAnimationFrame(computeRAF2.current); };
  }, [periodoSeleccionado, mesSeleccionado, cobradorSeleccionado, pagosFlatEnriched, pagosPorMes, recompute]);

  // ==== Handlers ====
  const volver = useCallback(() => navigate(-1), [navigate]);
  const handlePeriodoChange  = useCallback((e) => setPeriodoSeleccionado(e.target.value), []);
  const handleMesChange      = useCallback((e) => setMesSeleccionado(e.target.value), []);
  const handleCobradorChange = useCallback((e) => setCobradorSeleccionado(e.target.value), []);
  const handleYearChange     = useCallback((e) => setAnioSeleccionado(e.target.value), []);
  const handleSearch         = useCallback((e) => setSearchText(e.target.value), []);

  // Buscador (aplica sobre registros visibles) — incluye CATEGORÍA
  const registrosFiltradosPorBusqueda = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return derived.registros;
    return (derived.registros || []).filter((r) => {
      const socio   = (r._nombreCompleto || "").toLowerCase();
      const cobr    = (r._cb || "").toLowerCase();
      const periodo = (r.Mes_Pagado || "").toLowerCase();
      const fecha   = (r.fechaPago || "").toLowerCase();
      const monto   = String(r._precioNum || "").toLowerCase();
      const categ   = (r._categoriaTxt || "").toLowerCase();
      return socio.includes(q) || cobr.includes(q) || periodo.includes(q) || fecha.includes(q) || monto.includes(q) || categ.includes(q);
    });
  }, [derived.registros, searchText]);

  // Exportar Excel (respeta filtros/búsqueda) — mantenemos columnas separadas
  const exportarExcel = useCallback(() => {
    const rows = registrosFiltradosPorBusqueda || [];
    if (!rows.length) {
      alert("No hay registros para exportar con los filtros actuales.");
      return;
    }
    const data = rows.map((r) => ({
      "SOCIO": r._nombreCompleto,
      "CATEGORIA": r._categoriaTxt || "",
      "MONTO": Number(r._precioNum || 0),
      "COBRADOR": r._cb || "",
      "FECHA DE PAGO": r.fechaPago || "",
      "PERIODO PAGO": r.Mes_Pagado || "",
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data, {
      header: ["SOCIO","CATEGORIA","MONTO","COBRADOR","FECHA DE PAGO","PERIODO PAGO"],
    });
    ws["!cols"] = [{ wch: 32 }, { wch: 14 }, { wch: 10 }, { wch: 20 }, { wch: 14 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws, "Pagos");

    const parts = [];
    if (anioSeleccionado) parts.push(anioSeleccionado);
    if (periodoSeleccionado && periodoSeleccionado !== "Selecciona un periodo") parts.push(periodoSeleccionado.replace(/\s+/g, "_"));
    if (mesSeleccionado && mesSeleccionado !== "Todos los meses") parts.push(mesUC(parseInt(mesSeleccionado, 10)));
    const fname = `resumen_pagos_${parts.join("_") || "filtros"}.xlsx`;
    XLSX.writeFile(wb, fname);
  }, [registrosFiltradosPorBusqueda, anioSeleccionado, periodoSeleccionado, mesSeleccionado]);

  const calcularTotalRegistros = useCallback(
    () => registrosFiltradosPorBusqueda.length,
    [registrosFiltradosPorBusqueda.length]
  );

  return (
    <div className="contable-viewport">
      {/* HEADER SUPERIOR SIMPLE */}
      <header className="contable-topbar">
        <h1 className="contable-topbar-title">
          <FontAwesomeIcon icon={faDollarSign} /> Resumen de pagos
        </h1>
        <button className="contable-back-button" onClick={volver}> Volver</button>
      </header>

      {/* LAYOUT DOS COLUMNAS */}
      <div className="contable-grid">
        {/* PANEL IZQUIERDO */}
        <aside className="contable-sidebar">
          {error && (
            <div className="contable-warning">
              <FontAwesomeIcon icon={faExclamationTriangle} />
              <span>{error}</span>
              <button onClick={() => setError(null)} className="contable-close-error">
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
          )}

          {/* Conmutador Filtros/Resumen */}
          <div className="side-switch" role="tablist" aria-label="Cambiar sección de la barra lateral">
            <button
              type="button"
              role="tab"
              aria-selected={sidebarView === "filtros"}
              className={`segmented ${sidebarView === "filtros" ? "is-active" : ""}`}
              onClick={() => setSidebarView("filtros")}
            >
              <FontAwesomeIcon icon={faCalendarAlt} /> Filtros
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={sidebarView === "resumen"}
              className={`segmented ${sidebarView === "resumen" ? "is-active" : ""}`}
              onClick={() => setSidebarView("resumen")}
            >
              <FontAwesomeIcon icon={faListAlt} /> Resumen
            </button>
          </div>

          {/* Vistas exclusivas */}
          <div className="side-views">
            {/* ====== VISTA: FILTROS ====== */}
            {sidebarView === "filtros" && (
              <section className="side-block" aria-labelledby="titulo-filtros">
                <h3 id="titulo-filtros" className="side-block-title"><FontAwesomeIcon icon={faCalendarAlt} /> Filtros</h3>

                {/* Año */}
                <label className="side-field">
                  <span>Año</span>
                  <select value={anioSeleccionado || ""} onChange={(e) => setAnioSeleccionado(e.target.value)}>
                    {aniosDisponibles.length === 0 ? (
                      <option value="">Sin pagos</option>
                    ) : (
                      aniosDisponibles.map((y) => <option key={y} value={y}>{y}</option>)
                    )}
                  </select>
                </label>

                {/* Período */}
                <label className="side-field">
                  <span>Período</span>
                  <select
                    value={periodoSeleccionado}
                    onChange={(e) => setPeriodoSeleccionado(e.target.value)}
                    disabled={!anioSeleccionado}
                  >
                    <option value="Selecciona un periodo">Selecciona un periodo</option>
                    {periodosOpts.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.value}</option>
                    ))}
                  </select>
                </label>

                {/* Mes dependiente */}
                <label className="side-field">
                  <span>Mes</span>
                  <select
                    value={mesSeleccionado}
                    onChange={(e) => setMesSeleccionado(e.target.value)}
                    disabled={!anioSeleccionado}
                  >
                    <option>Todos los meses</option>
                    {mesesDisponibles.map((m) => <option key={m} value={m}>{mesUC(m)}</option>)}
                  </select>
                </label>

                {/* Cobrador */}
                <label className="side-field">
                  <span>Cobrador</span>
                  <select
                    value={cobradorSeleccionado}
                    onChange={(e) => setCobradorSeleccionado(e.target.value)}
                    disabled={!anioSeleccionado}
                  >
                    <option value="todos">Todos</option>
                    {cobradores.map((cb, idx) => <option key={idx} value={cb}>{cb}</option>)}
                  </select>
                </label>

                {/* Acciones */}
                <div className="side-actions">
                  <button
                    className="btn-dark grafics"
                    type="button"
                    onClick={() => setMostrarModalGraficos(true)}
                    disabled={!anioSeleccionado}
                    title="Ver gráficos"
                  >
                    <FontAwesomeIcon icon={faChartPie} /> Gráficos
                  </button>

                  <button
                    className="btn-dark excel"
                    type="button"
                    onClick={exportarExcel}
                    disabled={!anioSeleccionado}
                    title="Exportar registros visibles"
                  >
                    <FontAwesomeIcon icon={faFileExcel} /> Excel
                  </button>
                </div>
              </section>
            )}

            {/* ====== VISTA: RESUMEN ====== */}
            {sidebarView === "resumen" && (
              <section className="side-block" aria-labelledby="titulo-resumen">
                <h3 id="titulo-resumen" className="side-block-title"><FontAwesomeIcon icon={faListAlt} /> Resumen</h3>
                <div className="side-kpis">
                  <div className="kpi">
                    <span>Total recaudado</span>
                    <strong>${nfPesos.format(derived.total)}</strong>
                    <small>
                      {anioSeleccionado ? `Año ${anioSeleccionado}` : "Sin año"}
                      {periodoSeleccionado !== "Selecciona un periodo" ? ` · ${periodoSeleccionado}` : ""}
                      {labelMes(mesSeleccionado)}
                    </small>
                  </div>

                  <div className="kpi">
                    <span>Cobradores (únicos)</span>
                    <strong>{derived.cobradoresUnicos}</strong>
                    <small>Año {anioSeleccionado || "-"}</small>
                  </div>

                  <div className="kpi">
                    <span>Total registros visibles</span>
                    <strong>{calcularTotalRegistros()}</strong>
                    <small>Aplica búsqueda y filtros</small>
                  </div>
                </div>
              </section>
            )}
          </div>
        </aside>

        {/* CONTENIDO DERECHO */}
        <main className="contable-main">
          <div className="table-toolbar">
            <div className="toolbar-left">
              <h2><FontAwesomeIcon icon={faTable} /> Registros</h2>
              <span className="toolbar-sub">
                {anioSeleccionado ? `Año ${anioSeleccionado}` : ""}
                {periodoSeleccionado !== "Selecciona un periodo" ? ` · ${periodoSeleccionado}` : ""}
                {labelMes(mesSeleccionado)}
              </span>
            </div>

            {/* Buscador */}
            <div className="searchbox">
              <FontAwesomeIcon icon={faSearch} />
              <input
                type="text"
                placeholder="Buscar por socio, categoría, cobrador, período, fecha o monto…"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                disabled={!anioSeleccionado}
              />
            </div>
          </div>

          {/* GRID TABLE */}
          <div className={`contable-tablewrap ${(isLoadingTable || isPending) ? "is-loading" : ""}`}>
            {(isLoadingTable || isPending) && (
              <div className="contable-table-overlay" aria-live="polite" aria-busy="true">
                <div className="contable-spinner" />
              </div>
            )}

            <div className="gridtable" role="table" aria-rowcount={registrosFiltradosPorBusqueda.length || 0}>
              {/* Encabezado */}
              <div className="gridtable-header" role="row">
                <div className="gridtable-cell" role="columnheader">Apellido y Nombre</div>
                <div className="gridtable-cell" role="columnheader">Categoría</div> {/* UNIFICADO */}
                <div className="gridtable-cell" role="columnheader">Cobrador</div>
                <div className="gridtable-cell" role="columnheader">Fecha de Pago</div>
                <div className="gridtable-cell" role="columnheader">Periodo pago</div>
              </div>

              {/* Estados / Filas */}
              {periodoSeleccionado === "Selecciona un periodo" && mesSeleccionado === "Todos los meses" ? (
                <div className="gridtable-empty" role="row">
                  <div className="gridtable-empty-inner" role="cell">
                    <div className="empty-icon"><FontAwesomeIcon icon={faFilter} /></div>
                    {!anioSeleccionado ? "Seleccione un año para ver los pagos" : "Seleccione un período o un mes para ver los registros"}
                  </div>
                </div>
              ) : registrosFiltradosPorBusqueda.length === 0 ? (
                <div className="gridtable-empty" role="row">
                  <div className="gridtable-empty-inner" role="cell">
                    <div className="empty-icon"><FontAwesomeIcon icon={faMagnifyingGlass} /></div>
                    No hay registros para ese filtro/búsqueda.
                  </div>
                </div>
              ) : (
                registrosFiltradosPorBusqueda.map((r, i) => (
                  <div className="gridtable-row" role="row" key={i}>
                    <div className="gridtable-cell" role="cell" data-label="Apellido y Nombre">
                      {r._nombreCompleto}
                    </div>
                    <div className="gridtable-cell" role="cell" data-label="Categoría (Monto)">
                      {catMontoStr(r._categoriaTxt, r._precioNum)}
                    </div>
                    <div className="gridtable-cell" role="cell" data-label="Cobrador">
                      {r._cb || "-"}
                    </div>
                    <div className="gridtable-cell" role="cell" data-label="Fecha de Pago">
                      {r.fechaPago || "-"}
                    </div>
                    <div className="gridtable-cell" role="cell" data-label="Periodo pago">
                      {r.Mes_Pagado || "-"}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </main>
      </div>

      {/* MODAL GRÁFICOS */}
      <ContableChartsModal
        open={mostrarModalGraficos}
        onClose={() => setMostrarModalGraficos(false)}
        datosMeses={datosMeses}
        datosEmpresas={datosEmpresas}
        mesSeleccionado={periodoSeleccionado}
        medioSeleccionado={cobradorSeleccionado}
        totalSocios={totalSocios}
        anioSeleccionado={anioSeleccionado}
        condonados={condonados}
      />
    </div>
  );
}
