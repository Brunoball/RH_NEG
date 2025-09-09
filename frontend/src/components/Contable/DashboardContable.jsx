// src/components/Contable/DashboardContable.jsx
import React, {
  useState, useEffect, useMemo, useRef, useTransition, useCallback, useDeferredValue, memo
} from "react";
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
  faArrowLeft,
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
const SKELETON_ROWS = 8;

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

// Cobrador
const getNombreCobrador = (p) =>
  p?.Cobrador || p?.Nombre_Cobrador || p?.nombre_cobrador || p?.cobrador || p?.Cobrador_Nombre || "";

// Categoría
const getCategoriaTxt = (p) =>
  getTxt(p, "Nombre_Categoria") ||
  getTxt(p, "nombre_categoria") ||
  getTxt(p, "Categoria") ||
  getTxt(p, "categoria") ||
  "";

// Fecha → mes num
const getMonthFromDate = (yyyy_mm_dd) => {
  if (!yyyy_mm_dd || typeof yyyy_mm_dd !== "string" || yyyy_mm_dd.length < 7) return null;
  const mm = parseInt(yyyy_mm_dd.substring(5, 7), 10);
  return Number.isNaN(mm) ? null : mm;
};

const isAnualLabel = (s) => String(s || "").toUpperCase().includes("ANUAL");
const extractMonthsFromPeriodLabel = (label) => {
  if (!label) return [];
  const nums = String(label).match(/\d{1,2}/g) || [];
  const months = nums.map((n) => parseInt(n, 10)).filter((n) => !Number.isNaN(n) && n >= 1 && n <= 12);
  return Array.from(new Set(months));
};

const ok  = (obj) => obj && (obj.success === true || obj.exito === true);
const arr = (obj) => Array.isArray(obj?.data) ? obj.data : (Array.isArray(obj?.datos) ? obj.datos : []);

/* ====== Fila memoizada (evita re-renders de miles de filas) ====== */
const GridRow = memo(function GridRow({ r, i, nfPesos }) {
  const montoFmt = Number.isFinite(r._precioNum) ? nfPesos.format(r._precioNum) : "0";
  return (
    <div className="gridtable-row row-appear" role="row" style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}>
      <div className="gridtable-cell" role="cell" data-label="Apellido y Nombre">
        {r._nombreCompleto}
      </div>
      <div className="gridtable-cell" role="cell" data-label="Categoría (Monto)">
        {(r._categoriaTxt || "-") + " (" + montoFmt + ")"}
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
  );
});

/* ====== Normalizador e indexador por AÑO (se ejecuta una sola vez por año) ====== */
function buildYearIndexes(rawContable, rawListas) {
  // Periodos y cobradores (limpios)
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
  const periodosOpts = periodosSrv.map((label) => ({ value: label, months: extractMonthsFromPeriodLabel(label) }));

  // Enriquecer pagos una sola vez, y pre-ordenar
  const datosMeses = arr(rawContable);
  const pagosAll = [];
  for (let i = 0; i < datosMeses.length; i++) {
    const b = datosMeses[i];
    if (Array.isArray(b?.pagos) && b.pagos.length) {
      for (let j = 0; j < b.pagos.length; j++) {
        const p = b.pagos[j];
        const _cb         = String(getNombreCobrador(p)).trim();
        const _month      = getMonthFromDate(p?.fechaPago);
        const _precioNum  = parseFloat(p?.Precio) || 0;
        const _nombre     = getNombreSocio(p);
        const _categoria  = getCategoriaTxt(p);
        const _ts         = p?.fechaPago ? (new Date(p.fechaPago).getTime() || 0) : 0; // rápido en filtros
        pagosAll.push({ ...p, _cb, _month, _precioNum, _nombreCompleto: _nombre, _categoriaTxt: _categoria, _ts });
      }
    }
  }

  // Orden global descendente por fecha
  const byTsDesc = (a, b) => b._ts - a._ts;
  const pagosAllSorted = pagosAll.sort(byTsDesc);

  // Índices por mes (ya ordenados)
  const pagosByMonth = Array.from({ length: 13 }, () => []);
  for (let k = 0; k < pagosAllSorted.length; k++) {
    const p = pagosAllSorted[k];
    if (p._month >= 1 && p._month <= 12) pagosByMonth[p._month].push(p);
  }

  // Map por período → arreglo ya combinado y ordenado
  const periodMergedMap = new Map();
  for (const opt of periodosOpts) {
    const months = (opt?.months && opt.months.length) ? opt.months : extractMonthsFromPeriodLabel(opt?.value);
    if (!months || !months.length) continue;
    if (months.length === 1) {
      periodMergedMap.set(opt.value, pagosByMonth[months[0]] || []);
    } else {
      // Merge manteniendo orden por fecha descendente sin resortear (k-way merge)
      const arrays = months
        .filter((m) => m >= 1 && m <= 12 && pagosByMonth[m]?.length)
        .map((m) => pagosByMonth[m]);
      if (!arrays.length) { periodMergedMap.set(opt.value, []); continue; }
      if (arrays.length === 1) { periodMergedMap.set(opt.value, arrays[0]); continue; }

      // k-way merge por _ts desc
      const idxs = arrays.map(() => 0);
      const merged = [];
      while (true) {
        let pick = -1, bestTs = -1;
        for (let i = 0; i < arrays.length; i++) {
          const arrI = arrays[i]; const pos = idxs[i];
          if (pos < arrI.length) {
            const ts = arrI[pos]._ts;
            if (ts > bestTs) { bestTs = ts; pick = i; }
          }
        }
        if (pick === -1) break;
        merged.push(arrays[pick][idxs[pick]++]);
      }
      periodMergedMap.set(opt.value, merged);
    }
  }

  // Totales
  let totalSocios = Number(rawContable?.total_socios ?? 0) || 0;
  const condonados = Array.isArray(rawContable?.condonados) ? rawContable.condonados : [];

  const aniosDisponibles = Array.isArray(rawContable.anios)
    ? rawContable.anios.map((n) => parseInt(n, 10)).filter(Boolean)
    : [];
  const anioSrv = parseInt(rawContable.anio_aplicado ?? 0, 10);
  const anioInicial = anioSrv > 0 ? anioSrv : (aniosDisponibles.length ? Math.max(...aniosDisponibles) : "");

  return {
    periodosOpts,
    cobradores: cobradoresSrv,
    pagosAllSorted,
    pagosByMonth,
    periodMergedMap,
    totalSocios,
    condonados,
    aniosDisponibles,
    anioInicial
  };
}

/* ===================== Componente ===================== */
export default function DashboardContable() {
  const navigate = useNavigate();

  // ===== Filtros =====
  const [anioSeleccionado, setAnioSeleccionado] = useState("");
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState("Selecciona un periodo");
  const [mesSeleccionado, setMesSeleccionado] = useState("Todos los meses");
  const [cobradorSeleccionado, setCobradorSeleccionado] = useState("todos");
  const [searchText, setSearchText] = useState("");
  const searchDeferred = useDeferredValue(searchText);

  // ===== Datos base =====
  const [aniosDisponibles, setAniosDisponibles] = useState([]);
  const [periodosOpts, setPeriodosOpts] = useState([]);
  const [cobradores, setCobradores] = useState([]);
  const [totalSocios, setTotalSocios] = useState(0);
  const [condonados, setCondonados] = useState([]);
  const [datosMeses, setDatosMeses] = useState([]);     // para modal (mantenemos compatibilidad)
  const [datosEmpresas, setDatosEmpresas] = useState([]); // reservado
  const [isLoadingTable, setIsLoadingTable] = useState(false);
  const [error, setError] = useState(null);
  const [mostrarModalGraficos, setMostrarModalGraficos] = useState(false);
  const [sidebarView, setSidebarView] = useState("filtros");
  const [isPending, startTransition] = useTransition();
  const computeRAF1 = useRef(0);
  const computeRAF2 = useRef(0);

  // Índices cacheados por año (evita recalcular si el usuario cambia entre años y vuelve)
  const yearCacheRef = useRef(Object.create(null));

  // Arrays indexados actuales (según año seleccionado)
  const curPagosAllSortedRef = useRef([]);
  const curPagosByMonthRef = useRef([]);
  const curPeriodMergedMapRef = useRef(new Map());

  // Utils
  const nfPesos = useMemo(() => new Intl.NumberFormat("es-AR"), []);
  const fetchJSON = useCallback(async (url, signal) => {
    const sep = url.includes("?") ? "&" : "?";
    const res = await fetch(`${url}${sep}ts=${Date.now()}`, { method: "GET", signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }, []);

  // ========= Carga inicial (listas + contable "por defecto") =========
  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        setError(null);

        // Hacemos fetch en paralelo
        const [rawListas, rawContable] = await Promise.all([
          fetchJSON(`${BASE_URL}/api.php?action=listas`, ctrl.signal).catch(() => null),
          fetchJSON(`${BASE_URL}/api.php?action=contable`, ctrl.signal),
        ]);

        if (!ok(rawContable)) throw new Error("Respuesta inválida del servidor contable");

        // Construimos índices y cacheamos por año
        const built = buildYearIndexes(rawContable, rawListas);
        const anioKey = String(built.anioInicial || "");
        yearCacheRef.current[anioKey] = {
          built,
          datosMeses: arr(rawContable), // para modal
        };

        // Popular estado solo una vez (evita parpadeo)
        setPeriodosOpts(built.periodosOpts);
        setCobradores(built.cobradores);
        setAniosDisponibles(built.aniosDisponibles);
        setAnioSeleccionado(built.anioInicial || "");
        setTotalSocios(built.totalSocios);
        setCondonados(built.condonados);
        setDatosMeses(yearCacheRef.current[anioKey].datosMeses);

        // Poner índices actuales
        curPagosAllSortedRef.current = built.pagosAllSorted;
        curPagosByMonthRef.current = built.pagosByMonth;
        curPeriodMergedMapRef.current = built.periodMergedMap;
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Error en carga inicial:", err);
          setError("Error al cargar datos. Verifique la conexión o intente más tarde.");
        }
      }
    })();
    return () => ctrl.abort();
  }, [fetchJSON]);

  // ========= Cuando cambia el año =========
  useEffect(() => {
    if (!anioSeleccionado) return;
    const ctrl = new AbortController();
    (async () => {
      try {
        const key = String(anioSeleccionado);
        // Si ya lo tengo, uso cache instantáneo (cero flicker)
        if (yearCacheRef.current[key]) {
          const { built, datosMeses } = yearCacheRef.current[key];
          setAniosDisponibles((prev) => (prev?.length ? prev : built.aniosDisponibles));
          setTotalSocios(built.totalSocios);
          setCondonados(built.condonados);
          setDatosMeses(datosMeses);

          curPagosAllSortedRef.current = built.pagosAllSorted;
          curPagosByMonthRef.current = built.pagosByMonth;
          curPeriodMergedMapRef.current = built.periodMergedMap;

          // levantamos skeleton apenas y soltamos rápido
          setIsLoadingTable(true);
          requestAnimationFrame(() => requestAnimationFrame(() => setIsLoadingTable(false)));
          return;
        }

        // No está cacheado → fetch + build
        const raw = await fetchJSON(`${BASE_URL}/api.php?action=contable&anio=${encodeURIComponent(anioSeleccionado)}`, ctrl.signal);
        if (!ok(raw)) throw new Error("Formato inválido en datos contables del año");

        const rawListas = await fetchJSON(`${BASE_URL}/api.php?action=listas`, ctrl.signal).catch(() => null);
        const built = buildYearIndexes(raw, rawListas);

        // Cachear y aplicar
        yearCacheRef.current[key] = { built, datosMeses: arr(raw) };

        // Solo seteamos si cambia (evita renders)
        setAniosDisponibles((prev) => JSON.stringify(prev) !== JSON.stringify(built.aniosDisponibles) ? built.aniosDisponibles : prev);
        setTotalSocios(built.totalSocios);
        setCondonados(built.condonados);
        setDatosMeses(yearCacheRef.current[key].datosMeses);

        curPagosAllSortedRef.current = built.pagosAllSorted;
        curPagosByMonthRef.current = built.pagosByMonth;
        curPeriodMergedMapRef.current = built.periodMergedMap;

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

  // ======= Derivados rápidos (sin resortear) =======
  const [derived, setDerived] = useState({ registros: [], total: 0, cobradoresUnicos: 0 });

  const recomputeFast = useCallback((periodLabel, monthSel, cobrador) => {
    const all = curPagosAllSortedRef.current;
    const byMonth = curPagosByMonthRef.current;
    const byPeriod = curPeriodMergedMapRef.current;

    const monthNum = monthSel && monthSel !== "Todos los meses" ? parseInt(monthSel, 10) : 0;
    let base;

    if ((!periodLabel || periodLabel === "Selecciona un periodo") && !monthNum) {
      base = all; // ya está ordenado por _ts desc
    } else if ((periodLabel === "Selecciona un periodo" || !periodLabel) && monthNum) {
      base = byMonth[monthNum] || [];
    } else {
      base = byPeriod.get(periodLabel) || [];
      if (monthNum) base = base.filter((p) => p._month === monthNum); // raro pero compatible con tu UI
    }

    if (cobrador !== "todos") base = base.filter((p) => p._cb === cobrador);

    let total = 0;
    const setCb = new Set();
    for (let i = 0; i < base.length; i++) {
      total += base[i]._precioNum;
      if (base[i]._cb) setCb.add(base[i]._cb);
    }
    return { registros: base, total, cobradoresUnicos: setCb.size };
  }, []);

  useEffect(() => {
    // si aun no hay datos indexados, cortar skeletons
    if (!curPagosAllSortedRef.current || curPagosAllSortedRef.current.length === 0) {
      setDerived({ registros: [], total: 0, cobradoresUnicos: 0 });
      setIsLoadingTable(false);
      return;
    }
    setIsLoadingTable(true);
    cancelAnimationFrame(computeRAF1.current);
    cancelAnimationFrame(computeRAF2.current);
    computeRAF1.current = requestAnimationFrame(() => {
      startTransition(() => {
        const d = recomputeFast(periodoSeleccionado, mesSeleccionado, cobradorSeleccionado);
        computeRAF2.current = requestAnimationFrame(() => {
          setDerived(d);
          setTimeout(() => setIsLoadingTable(false), 45);
        });
      });
    });
    return () => {
      cancelAnimationFrame(computeRAF1.current);
      cancelAnimationFrame(computeRAF2.current);
    };
  }, [periodoSeleccionado, mesSeleccionado, cobradorSeleccionado, recomputeFast, startTransition]);

  // ===== Handlers =====
  const volver = useCallback(() => navigate(-1), [navigate]);
  const handlePeriodoChange  = useCallback((e) => setPeriodoSeleccionado(e.target.value), []);
  const handleMesChange      = useCallback((e) => setMesSeleccionado(e.target.value), []);
  const handleCobradorChange = useCallback((e) => setCobradorSeleccionado(e.target.value), []);
  const handleYearChange     = useCallback((e) => setAnioSeleccionado(e.target.value), []);
  const handleSearch         = useCallback((e) => setSearchText(e.target.value), []);

  // Buscador (sobre visibles) — incluye CATEGORÍA — con valor diferido
  const registrosFiltradosPorBusqueda = useMemo(() => {
    const q = (searchDeferred || "").trim().toLowerCase();
    if (!q) return derived.registros;
    const out = [];
    const regs = derived.registros || [];
    for (let i = 0; i < regs.length; i++) {
      const r = regs[i];
      if (
        (r._nombreCompleto || "").toLowerCase().includes(q) ||
        (r._cb || "").toLowerCase().includes(q) ||
        (r.Mes_Pagado || "").toLowerCase().includes(q) ||
        (r.fechaPago || "").toLowerCase().includes(q) ||
        String(r._precioNum || "").toLowerCase().includes(q) ||
        (r._categoriaTxt || "").toLowerCase().includes(q)
      ) out.push(r);
    }
    return out;
  }, [derived.registros, searchDeferred]);

  // Exportar Excel
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

  // ===== Skeleton helpers =====
  const renderSkeletonRows = () =>
    Array.from({ length: SKELETON_ROWS }).map((_, idx) => (
      <div className="gridtable-row skeleton-row" role="row" key={`sk-${idx}`} aria-hidden="true">
        <div className="gridtable-cell"><span className="skeleton-bar w-80" /></div>
        <div className="gridtable-cell"><span className="skeleton-bar w-40" /></div>
        <div className="gridtable-cell"><span className="skeleton-bar w-60" /></div>
        <div className="gridtable-cell"><span className="skeleton-bar w-50" /></div>
        <div className="gridtable-cell"><span className="skeleton-bar w-70" /></div>
      </div>
    ));

  return (
    <div className="contable-viewport">
      {/* HEADER SUPERIOR */}
      <header className="contable-topbar">
        <h1 className="contable-topbar-title">
          <FontAwesomeIcon icon={faDollarSign} /> Resumen de pagos
        </h1>

        <button className="contable-back-button" onClick={volver} aria-label="Volver">
          <FontAwesomeIcon icon={faArrowLeft} />&nbsp; Volver
        </button>
      </header>

      {/* LAYOUT DOS COLUMNAS */}
      <div className="contable-grid">
        {/* PANEL IZQUIERDO */}
        <aside className="contable-sidebar">
          {error && (
            <div className="contable-warning">
              <FontAwesomeIcon icon={faExclamationTriangle} />
              <span>{error}</span>
              <button onClick={() => setError(null)} className="contable-close-error" aria-label="Cerrar error">
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
                onChange={handleSearch}
                disabled={!anioSeleccionado}
              />
            </div>
          </div>

          {/* GRID TABLE */}
          <div className={`contable-tablewrap ${(isLoadingTable || isPending) ? "is-loading" : ""}`}>
            <div className="gridtable" role="table" aria-rowcount={registrosFiltradosPorBusqueda.length || 0}>
              {/* Encabezado */}
              <div className="gridtable-header" role="row">
                <div className="gridtable-cell" role="columnheader">Apellido y Nombre</div>
                <div className="gridtable-cell" role="columnheader">Categoría</div>
                <div className="gridtable-cell" role="columnheader">Cobrador</div>
                <div className="gridtable-cell" role="columnheader">Fecha de Pago</div>
                <div className="gridtable-cell" role="columnheader">Periodo pago</div>
              </div>

              {/* Skeletons mientras carga */}
              {(isLoadingTable || isPending) ? (
                renderSkeletonRows()
              ) : (
                <>
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
                      <GridRow key={r._ts ? `${r._ts}-${i}` : i} r={r} i={i} nfPesos={nfPesos} />
                    ))
                  )}
                </>
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
