// src/components/Contable/DashboardContable.jsx
import React, { useState, useEffect, useMemo, useRef } from "react";
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
} from "@fortawesome/free-solid-svg-icons";

import ContableChartsModal from "./modalcontable/ContableChartsModal";

export default function DashboardContable() {
  const navigate = useNavigate();

  // ===== Filtros =====
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState("Selecciona un periodo");
  const [cobradorSeleccionado, setCobradorSeleccionado] = useState("todos");

  // ===== Datos base =====
  const [periodosOpts, setPeriodosOpts] = useState([]);      // [{value:"PERÍODO 7 Y 8", months:[7,8]}]
  const [datosMeses, setDatosMeses] = useState([]);          // bloques por período con pagos
  const [datosEmpresas, setDatosEmpresas] = useState([]);    // (no usado)
  const [cobradores, setCobradores] = useState([]);
  const [totalSocios, setTotalSocios] = useState(0);

  // ===== UI =====
  const [error, setError] = useState(null);
  const [mostrarModalGraficos, setMostrarModalGraficos] = useState(false);

  // Loading visual de tabla (aparece INSTANTÁNEO)
  const [isLoadingTable, setIsLoadingTable] = useState(false);
  const computeRAF1 = useRef(0);
  const computeRAF2 = useRef(0);

  // ===== Utilidades =====
  const nfPesos = useMemo(() => new Intl.NumberFormat("es-AR"), []);
  const collEs = useMemo(() => new Intl.Collator("es", { sensitivity: "base" }), []);
  const fetchJSON = async (url, signal) => {
    const sep = url.includes("?") ? "&" : "?";
    const res = await fetch(`${url}${sep}ts=${Date.now()}`, { method: "GET", signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  };

  const ok = (obj) => obj && (obj.success === true || obj.exito === true);
  const arr = (obj) =>
    Array.isArray(obj?.data) ? obj.data :
    (Array.isArray(obj?.datos) ? obj.datos : []);

  // --- Helpers ---
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

  // ==== Carga inicial (abort + cache) ====
  useEffect(() => {
    const ctrl = new AbortController();

    const cache = sessionStorage.getItem("contable_cache_v3");
    if (cache) {
      try {
        const parsed = JSON.parse(cache);
        setDatosMeses(parsed.datosMeses || []);
        setDatosEmpresas(parsed.datosEmpresas || []);
        setTotalSocios(parsed.totalSocios || 0);
        setPeriodosOpts(parsed.periodosOpts || []);
        setCobradores(parsed.cobradores || []);
      } catch {}
    }

    (async () => {
      try {
        setError(null);
        const [rawContable, rawEmp, rawListas] = await Promise.all([
          fetchJSON(`${BASE_URL}/api.php?action=contable`, ctrl.signal),
          fetchJSON(`${BASE_URL}/api.php?action=contable_emp`, ctrl.signal).catch(() => ({ exito:true, datos:[] })),
          fetchJSON(`${BASE_URL}/api.php?action=listas`, ctrl.signal).catch(() => null),
        ]);

        const contable = ok(rawContable) ? arr(rawContable) : (Array.isArray(rawContable) ? rawContable : []);
        const empresas = ok(rawEmp) ? arr(rawEmp) : (Array.isArray(rawEmp) ? rawEmp : []);
        if (!Array.isArray(contable)) throw new Error("Formato inválido en datos contables (socios).");
        if (!Array.isArray(empresas)) throw new Error("Formato inválido en datos contables (empresas).");

        setDatosMeses(contable);
        setDatosEmpresas(empresas);

        const totalSoc = Number(rawContable?.total_socios ?? rawContable?.meta?.total_socios ?? 0) || 0;
        setTotalSocios(totalSoc);

        let periodosSrv = [];
        let cobradoresSrv = [];
        if (rawListas && ok(rawListas) && rawListas.listas) {
          // ===== Periodos: EXCLUIMOS el "CONTADO ANUAL" del SELECT (pero IGUAL se contabiliza por fecha en los gráficos)
          if (Array.isArray(rawListas.listas.periodos)) {
            periodosSrv = rawListas.listas.periodos
              .filter((p) => {
                const id = typeof p === "object" && p ? String(p.id ?? "") : "";
                const nombre = typeof p === "string" ? p : (p?.nombre || "");
                if (id === "7") return false;            // excluir id_periodo 7 del combo
                if (isAnualLabel(nombre)) return false;  // excluir "CONTADO ANUAL" del combo
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

        // Fallback si el backend no devolvió periodos
        if (periodosSrv.length === 0) {
          periodosSrv = Array.from({ length: 12 }, (_, i) => `PERÍODO ${i + 1}`);
        }

        const opts = periodosSrv.map((label) => ({
          value: label,
          months: extractMonthsFromPeriodLabel(label),
        }));
        setPeriodosOpts(opts);
        setCobradores(cobradoresSrv);

        sessionStorage.setItem(
          "contable_cache_v3",
          JSON.stringify({ datosMeses: contable, datosEmpresas: empresas, totalSocios: totalSoc, periodosOpts: opts, cobradores: cobradoresSrv })
        );
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Error en carga inicial:", err);
          setError("Error al cargar datos. Verifique la conexión o intente más tarde.");
        }
      }
    })();

    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== Precomputación sólo cuando cambian datos =====
  // 1) Aplanar y enriquecer cada pago
  const pagosFlatEnriched = useMemo(() => {
    if (!Array.isArray(datosMeses) || datosMeses.length === 0) return [];
    const out = [];
    for (let i = 0; i < datosMeses.length; i++) {
      const bloque = datosMeses[i];
      if (Array.isArray(bloque?.pagos) && bloque.pagos.length) {
        for (let j = 0; j < bloque.pagos.length; j++) {
          const p = bloque.pagos[j];
          const _cb = String(getNombreCobrador(p)).trim();
          const _month = getMonthFromDate(p?.fechaPago); // 1..12 o null
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

  // 2) Comparator rápido (usa Intl.Collator)
  const cmpPago = useMemo(() => {
    return (a, b) => {
      const n = collEs.compare(a._nombreClave, b._nombreClave);
      if (n !== 0) return n;
      if (a._periodoRank !== b._periodoRank) return a._periodoRank - b._periodoRank;
      return a._fechaTs - b._fechaTs;
    };
  }, [collEs]);

  // 3) Buckets por mes ya ORDENADOS una sola vez
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

  // ===== Estado derivado (se calcula bajo rAF para que el spinner pinte antes)
  const [registrosFiltrados, setRegistrosFiltrados] = useState([]);
  const [totalRecaudado, setTotalRecaudado] = useState(0);
  const [cobradoresUnicos, setCobradoresUnicos] = useState(0);

  // Merge k-way de arrays ya ordenados
  const mergeSorted = (arrays, comparator) => {
    // min-heap manual simple (K pequeño: <=12)
    const heads = [];
    for (let i = 0; i < arrays.length; i++) {
      if (arrays[i] && arrays[i].length) {
        heads.push({ i, idx: 0, val: arrays[i][0] });
      }
    }
    // heapify
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
        top.idx = nextIdx;
        top.val = arr[nextIdx];
        siftDown(0);
      } else {
        const last = heads.pop();
        if (heads.length) {
          heads[0] = last;
          siftDown(0);
        }
      }
    }
    return out;
  };

  // Computa derivados con rAF doble (pinta spinner primero)
  const computeDerived = (periodLabel, cobrador) => {
    if (!periodLabel || periodLabel === "Selecciona un periodo") {
      setRegistrosFiltrados([]);
      setTotalRecaudado(0);
      setCobradoresUnicos(0);
      return;
    }
    const opt = periodosOpts.find((o) => o.value === periodLabel);
    const meses = opt?.months?.length ? opt.months : extractMonthsFromPeriodLabel(periodLabel);
    if (!meses || meses.length === 0) {
      setRegistrosFiltrados([]);
      setTotalRecaudado(0);
      setCobradoresUnicos(0);
      return;
    }

    // 1) unir manteniedo orden
    const arrays = [];
    for (let k = 0; k < meses.length; k++) {
      const m = meses[k];
      if (m >= 1 && m <= 12 && pagosPorMesSorted[m]?.length) arrays.push(pagosPorMesSorted[m]);
    }
    const merged = arrays.length === 0 ? [] : (arrays.length === 1 ? arrays[0].slice() : mergeSorted(arrays, cmpPago));

    // 2) filtrar cobrador si aplica + acumular
    let total = 0;
    const setCb = new Set();
    let outList;
    if (cobrador !== "todos") {
      outList = [];
      for (let i = 0; i < merged.length; i++) {
        const p = merged[i];
        if (p._cb === cobrador) {
          outList.push(p);
          total += p._precioNum;
          if (p._cb) setCb.add(p._cb);
        }
      }
    } else {
      outList = merged;
      for (let i = 0; i < merged.length; i++) {
        const p = merged[i];
        total += p._precioNum;
        if (p._cb) setCb.add(p._cb);
      }
    }

    setRegistrosFiltrados(outList);
    setTotalRecaudado(total);
    setCobradoresUnicos(setCb.size);
  };

  // Recalcular cuando cambian filtros — pero dejar que el spinner pinte primero
  useEffect(() => {
    if (!pagosPorMesSorted.some((arr) => arr.length)) {
      setIsLoadingTable(false);
      computeDerived(periodoSeleccionado, cobradorSeleccionado);
      return;
    }

    setIsLoadingTable(true);
    cancelAnimationFrame(computeRAF1.current);
    cancelAnimationFrame(computeRAF2.current);
    computeRAF1.current = requestAnimationFrame(() => {
      computeRAF2.current = requestAnimationFrame(() => {
        computeDerived(periodoSeleccionado, cobradorSeleccionado);
        setIsLoadingTable(false);
      });
    });

    return () => {
      cancelAnimationFrame(computeRAF1.current);
      cancelAnimationFrame(computeRAF2.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodoSeleccionado, cobradorSeleccionado, pagosPorMesSorted, cmpPago]);

  // ==== Handlers ====
  const volver = () => navigate(-1);
  const handlePeriodoChange = (e) => setPeriodoSeleccionado(e.target.value);
  const handleCobradorChange = (e) => setCobradorSeleccionado(e.target.value);
  const abrirModalGraficos = () => setMostrarModalGraficos(true);
  const cerrarModalGraficos = () => setMostrarModalGraficos(false);
  const calcularTotalRegistros = () => registrosFiltrados.length;

  return (
    <div className="dashboard-contable-fullscreen">
      <div className="contable-fullscreen-container">
        {error && (
          <div className="contable-warning">
            <FontAwesomeIcon icon={faExclamationTriangle} />
            <span>{error}</span>
            <button onClick={() => setError(null)} className="contable-close-error">
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>
        )}

        <div className="contable-header">
          <h1 className="contable-title">
            <FontAwesomeIcon icon={faDollarSign} /> Resumen de pagos
          </h1>
          <button className="contable-back-button" onClick={volver}>
            ← Volver
          </button>
        </div>

        {/* ==== Tarjetas resumen ==== */}
        <div className="contable-summary-cards">
          <div className="contable-summary-card total-card">
            <div className="contable-card-icon">
              <FontAwesomeIcon icon={faDollarSign} />
            </div>
            <div className="contable-card-content">
              <h3>Total recaudado</h3>
              <p>${nfPesos.format(totalRecaudado)}</p>
              <small className="contable-card-subtext">
                {periodoSeleccionado !== "Selecciona un periodo"
                  ? `${periodoSeleccionado}${cobradorSeleccionado !== "todos" ? ` · ${cobradorSeleccionado}` : ""}`
                  : "Seleccione un periodo"}
              </small>
            </div>
          </div>

          <div className="contable-summary-card">
            <div className="contable-card-icon">
              <FontAwesomeIcon icon={faUsers} />
            </div>
            <div className="contable-card-content">
              <h3>Cobradores (únicos)</h3>
              <p>{cobradoresUnicos}</p>
              <small className="contable-card-subtext">
                {periodoSeleccionado !== "Selecciona un periodo" ? `${periodoSeleccionado}` : "Seleccione un periodo"}
              </small>
            </div>
          </div>

          <div className="contable-summary-card">
            <div className="contable-card-icon">
              <FontAwesomeIcon icon={faListAlt} />
            </div>
            <div className="contable-card-content">
              <h3>Total registros</h3>
              <p>{calcularTotalRegistros()}</p>
              <small className="contable-card-subtext">
                {periodoSeleccionado !== "Selecciona un periodo" ? `${periodoSeleccionado}` : "Seleccione un periodo"}
              </small>
            </div>
          </div>
        </div>

        {/* ==== Tabla de pagos ==== */}
        <div className="contable-categories-section">
          <div className="contable-section-header">
            <h2>
              <FontAwesomeIcon icon={faTable} /> Resumen de pagos
              <small className="contable-subtitle">
                {periodoSeleccionado !== "Selecciona un periodo" ? ` · ${periodoSeleccionado}` : ""}
              </small>
            </h2>

            <div className="contable-selectors-container">
              {/* Período */}
              <div className="contable-month-selector">
                <FontAwesomeIcon icon={faCalendarAlt} />
                <select
                  value={periodoSeleccionado}
                  onChange={handlePeriodoChange}
                  className="contable-month-select"
                  title="Filtrar por período (se aplica por fecha de pago)"
                >
                  <option value="Selecciona un periodo">Selecciona un periodo</option>
                  {periodosOpts.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.value}
                    </option>
                  ))}
                </select>
              </div>

              {/* Cobrador */}
              <div className="contable-payment-selector full-row-mobile">
                <FontAwesomeIcon icon={faCreditCard} />
                <select
                  value={cobradorSeleccionado}
                  onChange={handleCobradorChange}
                  className="contable-payment-select"
                  title="Filtrar por cobrador"
                >
                  <option value="todos">Todos los cobradores</option>
                  {cobradores.map((cb, idx) => (
                    <option key={idx} value={cb}>
                      {cb}
                    </option>
                  ))}
                </select>
              </div>

              <button
                className="contable-charts-button"
                type="button"
                onClick={abrirModalGraficos}
                title="Ver gráficos"
              >
                <FontAwesomeIcon icon={faChartPie} />
                Ver Gráficos
              </button>
            </div>
          </div>

          <div className={`contable-categories-scroll-container ${isLoadingTable ? "is-loading" : ""}`}>
            <div className="contable-detail-table-container">
              {/* Overlay de carga (aparece al instante) */}
              {isLoadingTable && (
                <div className="contable-table-loading" aria-live="polite" aria-busy="true">
                  <div className="contable-spinner" />
                </div>
              )}

              <table className="contable-detail-table" aria-busy={isLoadingTable ? "true" : "false"}>
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
                  {registrosFiltrados.length > 0 ? (
                    registrosFiltrados.map((r, i) => (
                      <tr key={i}>
                        <td data-label="Socio">
                          {`${r.Apellido || ""}${r.Apellido ? ", " : ""}${r.Nombre || ""}`}
                        </td>
                        <td data-label="Monto">
                          ${nfPesos.format(r._precioNum)}
                        </td>
                        <td data-label="Cobrador">
                          {r._cb || "-"}
                        </td>
                        <td data-label="Fecha de Pago">{r.fechaPago || "-"}</td>
                        <td data-label="Periodo pago">{r.Mes_Pagado || "-"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="contable-no-data">
                        {periodoSeleccionado === "Selecciona un periodo"
                          ? "Seleccione un periodo para ver los pagos"
                          : "No hay registros para ese periodo (según fecha de pago)"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* ==== MODAL GRÁFICOS ==== */}
      <ContableChartsModal
        open={mostrarModalGraficos}
        onClose={cerrarModalGraficos}
        datosMeses={datosMeses}
        datosEmpresas={datosEmpresas}
        mesSeleccionado={periodoSeleccionado}
        medioSeleccionado={cobradorSeleccionado}
        totalSocios={totalSocios}
      />
    </div>
  );
}
