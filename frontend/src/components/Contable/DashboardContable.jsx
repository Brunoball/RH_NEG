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
  faCreditCard,
  faChartPie,
  faUsers,
  faFileExcel,
  faSearch,
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
  const [condonados, setCondonados] = useState([]); // ⬅️ NUEVO

  // ===== UI =====
  const [error, setError] = useState(null);
  const [mostrarModalGraficos, setMostrarModalGraficos] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isLoadingTable, setIsLoadingTable] = useState(false);
  const computeRAF1 = useRef(0);
  const computeRAF2 = useRef(0);

  // ===== Utils =====
  const nfPesos = useMemo(() => new Intl.NumberFormat("es-AR"), []);
  const collEs = useMemo(() => new Intl.Collator("es", { sensitivity: "base" }), []);
  const fetchJSON = useCallback(async (url, signal) => {
    const sep = url.includes("?") ? "&" : "?";
    const res = await fetch(`${url}${sep}ts=${Date.now()}`, { method: "GET", signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }, []);
  const ok = (obj) => obj && (obj.success === true || obj.exito === true);
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
  const nombreClaveBuild = (p) => `${(p?.Apellido || "").trim()} ${(p?.Nombre || "").trim()}`.trim();
  const periodoRankBuild = (label) => {
    const nums = (label || "").match(/\d{1,2}/g);
    if (!nums || nums.length === 0) return 999;
    const ints = nums.map((n) => parseInt(n, 10)).filter((n) => !Number.isNaN(n));
    return ints.length ? Math.min(...ints) : 999;
  };
  const isAnualLabel = (s) => String(s || "").toUpperCase().includes("ANUAL");

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
                if (id === "7") return false;
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
        setCondonados(Array.isArray(rawContable?.condonados) ? rawContable.condonados : []); // ⬅️ NUEVO
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
        setCondonados(Array.isArray(raw?.condonados) ? raw.condonados : []); // ⬅️ NUEVO
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
          const _cb = String(getNombreCobrador(p)).trim();
          const _month = getMonthFromDate(p?.fechaPago);
          const _fechaTs = p?.fechaPago ? Date.parse(p.fechaPago) : Number.MAX_SAFE_INTEGER;
          const _nombreClave = nombreClaveBuild(p);
          const _periodoRank = periodoRankBuild(p?.Mes_Pagado);
          const _precioNum = parseFloat(p?.Precio) || 0;
          out.push({ ...p, _cb, _month, _fechaTs, _nombreClave, _periodoRank, _precioNum });
        }
      }
    }
    return out;
  }, [datosMeses]);

  const cmpPago = useMemo(() => {
    return (a, b) => {
      const n = collEs.compare(a._nombreClave, b._nombreClave);
      if (n !== 0) return n;
      if (a._periodoRank !== b._periodoRank) return a._periodoRank - b._periodoRank;
      return a._fechaTs - b._fechaTs;
    };
  }, [collEs]);

  const pagosPorMesSorted = useMemo(() => {
    const buckets = Array.from({ length: 13 }, () => []);
    for (let i = 0; i < pagosFlatEnriched.length; i++) {
      const p = pagosFlatEnriched[i];
      if (p._month != null && p._month >= 1 && p._month <= 12) buckets[p._month].push(p);
    }
    for (let m = 1; m <= 12; m++) {
      if (buckets[m].length > 1) buckets[m].sort(cmpPago);
    }
    return buckets;
  }, [pagosFlatEnriched, cmpPago]);

  const periodMergedMap = useMemo(() => {
    const mergeSorted = (arrays, comparator) => {
      const heads = [];
      for (let i = 0; i < arrays.length; i++) {
        const arr = arrays[i];
        if (arr && arr.length) heads.push({ i, idx: 0, val: arr[0] });
      }
      const less = (a, b) => comparator(a.val, b.val) < 0;
      const swap = (i, j) => { const t = heads[i]; heads[i] = heads[j]; heads[j] = t; };
      const siftUp = (i) => { while (i > 0) { const p = (i - 1) >> 1; if (!less(heads[i], heads[p])) break; swap(i, p); i = p; } };
      const siftDown = (i) => {
        for (;;) {
          let l = (i << 1) + 1, r = l + 1, s = i;
          if (l < heads.length && less(heads[l], heads[s])) s = l;
          if (r < heads.length && less(heads[r], heads[s])) s = r;
          if (s === i) break;
          swap(i, s); i = s;
        }
      };
      for (let k = 0; k < heads.length; k++) siftUp(k);
      const out = [];
      while (heads.length) {
        const top = heads[0];
        out.push(top.val);
        const arr = arrays[top.i];
        const nextIdx = top.idx + 1;
        if (nextIdx < arr.length) {
          top.idx = nextIdx; top.val = arr[nextIdx]; siftDown(0);
        } else {
          const last = heads.pop();
          if (heads.length) { heads[0] = last; siftDown(0); }
        }
      }
      return out;
    };

    const map = new Map();
    for (const opt of periodosOpts) {
      const months = (opt?.months && opt.months.length) ? opt.months : extractMonthsFromPeriodLabel(opt?.value);
      if (!months || !months.length) continue;
      const arrays = [];
      for (let m of months) {
        if (m >= 1 && m <= 12 && pagosPorMesSorted[m]?.length) arrays.push(pagosPorMesSorted[m]);
      }
      const merged = arrays.length === 0 ? [] : (arrays.length === 1 ? arrays[0].slice() : mergeSorted(arrays, cmpPago));
      map.set(opt.value, merged);
    }
    return map;
  }, [periodosOpts, pagosPorMesSorted, cmpPago]);

  /* ===== Meses disponibles por período ===== */
  const mesesDisponibles = useMemo(() => {
    if (!anioSeleccionado) return [];
    if (!periodoSeleccionado || periodoSeleccionado === "Selecciona un periodo") {
      return Array.from({ length: 12 }, (_, i) => i + 1);
    }
    const opt = periodosOpts.find(o => o.value === periodoSeleccionado);
    const ms = opt?.months?.length ? opt.months : extractMonthsFromPeriodLabel(periodoSeleccionado);
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

  const recompute = useCallback((periodLabel, monthSel, cobrador) => {
    const monthNum = monthSel && monthSel !== "Todos los meses" ? parseInt(monthSel, 10) : 0;

    if ((!periodLabel || periodLabel === "Selecciona un periodo") && !monthNum) {
      const base = (cobrador === "todos") ? pagosFlatEnriched : pagosFlatEnriched.filter((p) => p._cb === cobrador);
      let total = 0; const setCb = new Set();
      for (let i = 0; i < base.length; i++) { total += base[i]._precioNum; if (base[i]._cb) setCb.add(base[i]._cb); }
      return { registros: [], total, cobradoresUnicos: setCb.size };
    }

    if ((periodLabel === "Selecciona un periodo" || !periodLabel) && monthNum) {
      let base = pagosPorMesSorted[monthNum] ? pagosPorMesSorted[monthNum] : [];
      if (cobrador !== "todos") base = base.filter((p) => p._cb === cobrador);
      let total = 0; const setCb = new Set();
      for (let i = 0; i < base.length; i++) { total += base[i]._precioNum; if (base[i]._cb) setCb.add(base[i]._cb); }
      return { registros: base, total, cobradoresUnicos: setCb.size };
    }

    let merged = periodMergedMap.get(periodLabel) || [];
    if (monthNum) merged = merged.filter((p) => p._month === monthNum);
    if (cobrador !== "todos") merged = merged.filter((p) => p._cb === cobrador);

    let total = 0; const setCb = new Set();
    for (let i = 0; i < merged.length; i++) { total += merged[i]._precioNum; if (merged[i]._cb) setCb.add(merged[i]._cb); }
    return { registros: merged, total, cobradoresUnicos: setCb.size };
  }, [pagosFlatEnriched, pagosPorMesSorted, periodMergedMap]);

  useEffect(() => {
    if (!pagosFlatEnriched.length && !pagosPorMesSorted.some(arr => arr.length)) {
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
  }, [periodoSeleccionado, mesSeleccionado, cobradorSeleccionado, pagosFlatEnriched, pagosPorMesSorted, recompute]);

  // ==== Handlers ====
  const volver = useCallback(() => navigate(-1), [navigate]);
  const handlePeriodoChange = useCallback((e) => setPeriodoSeleccionado(e.target.value), []);
  const handleMesChange = useCallback((e) => setMesSeleccionado(e.target.value), []);
  const handleCobradorChange = useCallback((e) => setCobradorSeleccionado(e.target.value), []);
  const handleYearChange = useCallback((e) => setAnioSeleccionado(e.target.value), []);
  const handleSearch = useCallback((e) => setSearchText(e.target.value), []);

  // Buscador (aplica sobre registros visibles)
  const registrosFiltradosPorBusqueda = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return derived.registros;
    return (derived.registros || []).filter((r) => {
      const socio = `${r.Apellido || ""} ${r.Nombre || ""}`.toLowerCase();
      const cobr = (r._cb || "").toLowerCase();
      const periodo = (r.Mes_Pagado || "").toLowerCase();
      const fecha = (r.fechaPago || "").toLowerCase();
      const monto = String(r._precioNum || "").toLowerCase();
      return socio.includes(q) || cobr.includes(q) || periodo.includes(q) || fecha.includes(q) || monto.includes(q);
    });
  }, [derived.registros, searchText]);

  // Exportar Excel de lo que se ve (respeta búsqueda)
  const exportarExcel = useCallback(() => {
    const rows = registrosFiltradosPorBusqueda || [];
    if (!rows.length) {
      alert("No hay registros para exportar con los filtros actuales.");
      return;
    }
    const data = rows.map((r) => ({
      "SOCIO": `${r.Apellido || ""}${r.Apellido ? ", " : ""}${r.Nombre || ""}`,
      "MONTO": Number(r._precioNum || 0),
      "COBRADOR": r._cb || "",
      "FECHA DE PAGO": r.fechaPago || "",
      "PERIODO PAGO": r.Mes_Pagado || "",
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data, {
      header: ["SOCIO","MONTO","COBRADOR","FECHA DE PAGO","PERIODO PAGO"],
    });
    ws["!cols"] = [{ wch: 32 }, { wch: 10 }, { wch: 20 }, { wch: 14 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws, "Pagos");

    const parts = [];
    if (anioSeleccionado) parts.push(anioSeleccionado);
    if (periodoSeleccionado && periodoSeleccionado !== "Selecciona un periodo") parts.push(periodoSeleccionado.replace(/\s+/g, "_"));
    if (mesSeleccionado && mesSeleccionado !== "Todos los meses") parts.push(mesUC(parseInt(mesSeleccionado, 10)));
    const fname = `resumen_pagos_${parts.join("_") || "filtros"}.xlsx`;
    XLSX.writeFile(wb, fname);
  }, [registrosFiltradosPorBusqueda, anioSeleccionado, periodoSeleccionado, mesSeleccionado]);

  const calcularTotalRegistros = useCallback(() => registrosFiltradosPorBusqueda.length, [registrosFiltradosPorBusqueda.length]);

  return (
    <div className="contable-viewport">
      {/* HEADER SUPERIOR SIMPLE */}
      <header className="contable-topbar">
        <h1 className="contable-topbar-title">
          <FontAwesomeIcon icon={faDollarSign} /> Resumen de pagos
        </h1>
        <button className="contable-back-button" onClick={volver}>← Volver</button>
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

          <section className="side-block">
            <h3 className="side-block-title"><FontAwesomeIcon icon={faCalendarAlt} /> Filtros</h3>

            {/* Año */}
            <label className="side-field">
              <span>Año</span>
              <select value={anioSeleccionado || ""} onChange={handleYearChange}>
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
                onChange={handlePeriodoChange}
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
                onChange={handleMesChange}
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
                onChange={handleCobradorChange}
                disabled={!anioSeleccionado}
              >
                <option value="todos">Todos</option>
                {cobradores.map((cb, idx) => <option key={idx} value={cb}>{cb}</option>)}
              </select>
            </label>

            {/* Acciones */}
            <div className="side-actions">
              <button
                className="btn-dark"
                type="button"
                onClick={() => setMostrarModalGraficos(true)}
                disabled={!anioSeleccionado}
                title="Ver gráficos"
              >
                <FontAwesomeIcon icon={faChartPie} /> Ver gráficos
              </button>

              <button
                className="btn-dark"
                type="button"
                onClick={exportarExcel}
                disabled={!anioSeleccionado}
                title="Exportar registros visibles"
              >
                <FontAwesomeIcon icon={faFileExcel} /> Exportar Excel
              </button>
            </div>
          </section>

          {/* KPIs */}
          <section className="side-block">
            <h3 className="side-block-title"><FontAwesomeIcon icon={faListAlt} /> Resumen</h3>
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
                placeholder="Buscar por socio, cobrador, período, fecha o monto…"
                value={searchText}
                onChange={handleSearch}
                disabled={!anioSeleccionado}
              />
            </div>
          </div>

          <div className={`contable-tablewrap ${(isLoadingTable || isPending) ? "is-loading" : ""}`}>
            {(isLoadingTable || isPending) && (
              <div className="contable-table-overlay" aria-live="polite" aria-busy="true">
                <div className="contable-spinner" />
              </div>
            )}

            <table className="contable-table" aria-busy={(isLoadingTable || isPending) ? "true" : "false"}>
              <thead>
                <tr>
                  <th>Socio</th>
                  <th>Monto</th>
                  <th>Cobrador</th>
                  <th>Fecha de Pago</th>
                  <th>Periodo pago</th>
                </tr>
              </thead>
              <tbody>
                {periodoSeleccionado === "Selecciona un periodo" && mesSeleccionado === "Todos los meses" ? (
                  <tr>
                    <td colSpan="5" className="contable-no-data">
                      {!anioSeleccionado
                        ? "Seleccione un año para ver los pagos"
                        : "Seleccione un período o un mes para ver los registros"}
                    </td>
                  </tr>
                ) : registrosFiltradosPorBusqueda.length > 0 ? (
                  registrosFiltradosPorBusqueda.map((r, i) => (
                    <tr key={i}>
                      <td data-label="Socio">{`${r.Apellido || ""}${r.Apellido ? ", " : ""}${r.Nombre || ""}`}</td>
                      <td data-label="Monto">${nfPesos.format(r._precioNum)}</td>
                      <td data-label="Cobrador">{r._cb || "-"}</td>
                      <td data-label="Fecha de Pago">{r.fechaPago || "-"}</td>
                      <td data-label="Periodo pago">{r.Mes_Pagado || "-"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="contable-no-data">No hay registros para ese filtro/búsqueda.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </main>
      </div>

      {/* MODAL GRÁFICOS */}
      <ContableChartsModal
        open={mostrarModalGraficos}
        onClose={() => setMostrarModalGraficos(false)}
        datosMeses={datosMeses}
        datosEmpresas={datosEmpresas}
        mesSeleccionado={periodoSeleccionado}  // (se usa como período seleccionado)
        medioSeleccionado={cobradorSeleccionado}
        totalSocios={totalSocios}
        anioSeleccionado={anioSeleccionado}
        condonados={condonados}                 // ⬅️ NUEVO
      />
    </div>
  );
}
