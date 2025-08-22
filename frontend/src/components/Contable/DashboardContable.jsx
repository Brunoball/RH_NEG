import React, { useState, useEffect, useMemo } from "react";
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
  const [periodosOpts, setPeriodosOpts] = useState([]); // [{value:"PERÍODO 1 Y 2", months:[1,2]}]
  const [datosMeses, setDatosMeses] = useState([]);     // bloques por período con pagos
  const [datosEmpresas, setDatosEmpresas] = useState([]); // (no usado, pero lo conservamos)
  const [cobradores, setCobradores] = useState([]);
  const [totalSocios, setTotalSocios] = useState(0);     // <<--- NUEVO

  // ===== Derivados =====
  const [totalRecaudado, setTotalRecaudado] = useState(0);
  const [registrosFiltrados, setRegistrosFiltrados] = useState([]);
  const [cobradoresUnicos, setCobradoresUnicos] = useState(0);

  // ===== UI =====
  const [error, setError] = useState(null);
  const [mostrarModalGraficos, setMostrarModalGraficos] = useState(false);

  const fetchJSON = async (url) => {
    const sep = url.includes("?") ? "&" : "?";
    const res = await fetch(`${url}${sep}ts=${Date.now()}`, { method: "GET" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  };

  const ok = (obj) => obj && (obj.success === true || obj.exito === true);
  const arr = (obj) =>
    Array.isArray(obj?.data) ? obj.data :
    (Array.isArray(obj?.datos) ? obj.datos : []);

  // ==== Carga inicial ====
  useEffect(() => {
    sessionStorage.removeItem("datos_contables");

    (async () => {
      try {
        setError(null);

        const [rawContable, rawEmp, rawListas] = await Promise.all([
          fetchJSON(`${BASE_URL}/api.php?action=contable`),
          fetchJSON(`${BASE_URL}/api.php?action=contable_emp`).catch(() => ({ exito:true, datos:[] })),
          fetchJSON(`${BASE_URL}/api.php?action=listas`).catch(() => null),
        ]);

        // contable / empresas
        const contable = ok(rawContable) ? arr(rawContable) : (Array.isArray(rawContable) ? rawContable : []);
        const empresas = ok(rawEmp) ? arr(rawEmp) : (Array.isArray(rawEmp) ? rawEmp : []);
        if (!Array.isArray(contable)) throw new Error("Formato inválido en datos contables (socios).");
        if (!Array.isArray(empresas)) throw new Error("Formato inválido en datos contables (empresas).");

        setDatosMeses(contable);
        setDatosEmpresas(empresas);

        // ⮕ leer total de socios del backend (nuevo campo)
        const totalSoc =
          Number(rawContable?.total_socios ?? rawContable?.meta?.total_socios ?? 0) || 0;
        setTotalSocios(totalSoc);

        // periodos & cobradores
        let periodosSrv = [];
        let cobradoresSrv = [];

        if (rawListas && ok(rawListas) && rawListas.listas) {
          if (Array.isArray(rawListas.listas.periodos)) {
            periodosSrv = rawListas.listas.periodos
              .map((p) => (p?.nombre || "").toString().trim())
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

        const opts = periodosSrv.map((label) => ({
          value: label,
          months: extractMonthsFromPeriodLabel(label),
        }));
        setPeriodosOpts(opts);

        setCobradores(cobradoresSrv);
      } catch (err) {
        console.error("Error en carga inicial:", err);
        setError("Error al cargar datos. Verifique la conexión o intente más tarde.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Parsear números de un label de período ("PERÍODO 1 Y 2" -> [1,2])
  function extractMonthsFromPeriodLabel(label) {
    if (!label) return [];
    const nums = String(label).match(/\d{1,2}/g) || [];
    const months = nums.map((n) => parseInt(n, 10)).filter((n) => !Number.isNaN(n) && n >= 1 && n <= 12);
    return Array.from(new Set(months));
  }

  // --- Mes (1..12) desde "YYYY-MM-DD"
  const getMonthFromDate = (yyyy_mm_dd) => {
    if (!yyyy_mm_dd || typeof yyyy_mm_dd !== "string" || yyyy_mm_dd.length < 7) return null;
    const mm = parseInt(yyyy_mm_dd.substring(5, 7), 10);
    return Number.isNaN(mm) ? null : mm;
  };

  const getNombreCobrador = (p) =>
    p?.Cobrador || p?.Nombre_Cobrador || p?.nombre_cobrador || p?.cobrador || p?.Cobrador_Nombre || "";

  const nombreClave = (p) => `${(p?.Apellido || "").trim()} ${(p?.Nombre || "").trim()}`.trim();
  const periodoRank = (label) => {
    const nums = (label || "").match(/\d{1,2}/g);
    if (!nums || nums.length === 0) return 999;
    const ints = nums.map((n) => parseInt(n, 10)).filter((n) => !Number.isNaN(n));
    return ints.length ? Math.min(...ints) : 999;
  };
  const fechaRank = (fecha) => {
    const t = Date.parse(fecha);
    return Number.isNaN(t) ? Number.MAX_SAFE_INTEGER : t;
  };

  // ==== Recalcular (filtra por FECHA de pago y por cobrador) ====
  useEffect(() => {
    if (!periodoSeleccionado || periodoSeleccionado === "Selecciona un periodo") {
      setTotalRecaudado(0);
      setRegistrosFiltrados([]);
      setCobradoresUnicos(0);
      return;
    }

    try {
      const opt = periodosOpts.find((o) => o.value === periodoSeleccionado);
      const mesesObjetivo = opt?.months?.length ? opt.months : extractMonthsFromPeriodLabel(periodoSeleccionado);
      if (!mesesObjetivo || mesesObjetivo.length === 0) {
        setTotalRecaudado(0);
        setRegistrosFiltrados([]);
        setCobradoresUnicos(0);
        return;
      }

      const todos = [];
      for (const bloque of datosMeses) {
        if (Array.isArray(bloque?.pagos)) todos.push(...bloque.pagos);
      }

      let pagos = todos.filter((p) => {
        const m = getMonthFromDate(p?.fechaPago);
        return m !== null && mesesObjetivo.includes(m);
      });

      if (cobradorSeleccionado !== "todos") {
        pagos = pagos.filter((p) => String(getNombreCobrador(p)).trim() === cobradorSeleccionado);
      }

      pagos.sort((a, b) => {
        const nA = nombreClave(a);
        const nB = nombreClave(b);
        const byNombre = nA.localeCompare(nB, "es", { sensitivity: "base" });
        if (byNombre !== 0) return byNombre;

        const prA = periodoRank(a?.Mes_Pagado);
        const prB = periodoRank(b?.Mes_Pagado);
        if (prA !== prB) return prA - prB;

        return fechaRank(a?.fechaPago) - fechaRank(b?.fechaPago);
      });

      const total = pagos.reduce((acc, p) => acc + (parseFloat(p?.Precio) || 0), 0);
      setTotalRecaudado(total);
      setRegistrosFiltrados(pagos);

      const setCb = new Set(pagos.map((p) => String(getNombreCobrador(p)).trim()).filter(Boolean));
      setCobradoresUnicos(setCb.size);
    } catch (err) {
      console.error("Error al filtrar por período/fechaPago:", err);
      setError("Error al procesar los pagos filtrados.");
      setTotalRecaudado(0);
      setRegistrosFiltrados([]);
      setCobradoresUnicos(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodoSeleccionado, cobradorSeleccionado, datosMeses, periodosOpts]);

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
              <p>${totalRecaudado.toLocaleString("es-AR")}</p>
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

          <div className="contable-categories-scroll-container">
            <div className="contable-detail-table-container">
              <table className="contable-detail-table">
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
                    registrosFiltrados.map((registro, index) => (
                      <tr key={index}>
                        <td data-label="Socio">
                          {`${registro.Apellido || ""}${registro.Apellido ? ", " : ""}${registro.Nombre || ""}`}
                        </td>
                        <td data-label="Monto">
                          ${(registro.Precio || 0).toLocaleString("es-AR")}
                        </td>
                        <td data-label="Cobrador">
                          {(registro.Cobrador ||
                            registro.Nombre_Cobrador ||
                            registro.nombre_cobrador ||
                            registro.cobrador ||
                            registro.Cobrador_Nombre ||
                            "-")}
                        </td>
                        <td data-label="Fecha de Pago">{registro.fechaPago || "-"}</td>
                        <td data-label="Periodo pago">{registro.Mes_Pagado || "-"}</td>
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
        mesSeleccionado={periodoSeleccionado}          // etiqueta de período
        medioSeleccionado={cobradorSeleccionado}
        totalSocios={totalSocios}                      // <<--- NUEVO
      />
    </div>
  );
}
