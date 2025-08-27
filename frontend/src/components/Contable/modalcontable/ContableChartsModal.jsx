// src/components/Contable/modalcontable/ContableChartsModal.jsx
import React, { useMemo, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faChartPie } from "@fortawesome/free-solid-svg-icons";

import {
  Chart as ChartJS,
  LineElement,
  BarElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
  ArcElement,
  Filler,
} from "chart.js";
import { Line, Pie } from "react-chartjs-2";
import "./ContableChartsModal.css";

ChartJS.register(
  LineElement,
  BarElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
  ArcElement,
  Filler
);

/**
 * ✔️ Si NO hay período seleccionado, la línea muestra TODOS los períodos canónicos
 *    desde el inicio del año HASTA el período que contiene el mes actual (incluido).
 * ✔️ La suma SIEMPRE es por FECHA DE PAGO.
 */
export default function ContableChartsModal({
  open,
  onClose,
  datosMeses = [],
  datosEmpresas = [],
  mesSeleccionado = "Selecciona un periodo",
  medioSeleccionado = "todos",
  totalSocios = 0,
}) {
  // ===== utils =====
  const norm = (s) => (s || "").toString().trim().toLowerCase();

  const extractMonthsFromPeriodLabel = (label) => {
    const nums = (label || "").match(/\d{1,2}/g) || [];
    const months = nums
      .map((n) => parseInt(n, 10))
      .filter((n) => !Number.isNaN(n) && n >= 1 && n <= 12);
    return Array.from(new Set(months));
  };

  const periodoRank = (label) => {
    const nums = (label || "").match(/\d{1,2}/g);
    if (!nums || nums.length === 0) return 999;
    const ints = nums.map((n) => parseInt(n, 10)).filter((n) => !Number.isNaN(n));
    return ints.length ? Math.min(...ints) : 999;
  };

  const getMonthFromPago = (p) => {
    const f =
      p?.fechaPago ??
      p?.fecha_pago ??
      p?.Fecha_Pago ??
      p?.FECHA_PAGO ??
      null;
    if (!f || typeof f !== "string" || f.length < 7) return null;
    const mm = parseInt(f.substring(5, 7), 10);
    return Number.isNaN(mm) ? null : mm;
  };

  const getIdSocio = (p) => {
    const raw =
      p?.ID_Socio ??
      p?.id_socio ??
      p?.idSocio ??
      p?.idsocio ??
      p?.idSocios ??
      p?.IdSocio ??
      null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : raw ?? null;
  };

  const nombreCobrador = (p) =>
    p?.Cobrador ||
    p?.Nombre_Cobrador ||
    p?.nombre_cobrador ||
    p?.cobrador ||
    p?.Cobrador_Nombre ||
    "";

  useEffect(() => {
    if (!open) return;
    const onEsc = (e) => {
      if (e.key === "Escape" || e.key === "Esc" || e.keyCode === 27) {
        e.preventDefault();
        onClose?.();
      }
    };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  // ===== Períodos canónicos del año (para ejes/orden) =====
  const periodosCanonicos = useMemo(
    () => [
      "PERÍODO 1 Y 2",
      "PERÍODO 3 Y 4",
      "PERÍODO 5 Y 6",
      "PERÍODO 7 Y 8",
      "PERÍODO 9 Y 10",
      "PERÍODO 11 Y 12",
    ],
    []
  );

  // ⚠️ Importante: NO mutar el array fuente
  const periodosOrdenados = useMemo(
    () => periodosCanonicos.slice().sort((a, b) => periodoRank(a) - periodoRank(b)),
    [periodosCanonicos]
  );

  // Todos los pagos (solo socios) unificados (sin importar bloque)
  const todosLosPagos = useMemo(() => {
    const out = [];
    for (const b of datosMeses || []) if (Array.isArray(b?.pagos)) out.push(...b.pagos);
    return out;
  }, [datosMeses]);

  // Filtro por cobrador (si aplica)
  const pagosFiltradosPorCobrador = useMemo(() => {
    if (medioSeleccionado === "todos") return todosLosPagos;
    return (todosLosPagos || []).filter((p) => norm(nombreCobrador(p)) === norm(medioSeleccionado));
  }, [todosLosPagos, medioSeleccionado]);

  // ===== helper: sumar por período usando FECHA DE PAGO =====
  const sumaPeriodoPorFecha = (labelPeriodo) => {
    const meses = extractMonthsFromPeriodLabel(labelPeriodo);
    if (!meses.length) return 0;

    const lista = pagosFiltradosPorCobrador.filter((p) => {
      const m = getMonthFromPago(p);
      return m !== null && meses.includes(m);
    });
    return lista.reduce((acc, p) => acc + (parseFloat(p?.Precio) || 0), 0);
  };

  // ===== construir labels de la LÍNEA según selección / período actual =====
  const currentMonth = new Date().getMonth() + 1; // 1..12

  // Períodos hasta el actual (incluye el que contiene el mes actual)
  const periodosHastaActual = useMemo(() => {
    const list = periodosOrdenados.filter((per) => {
      const meses = extractMonthsFromPeriodLabel(per);
      if (!meses.length) return false;
      const minMes = Math.min(...meses);
      return minMes <= currentMonth;
    });
    // Fallback defensivo por si algo quedara vacío
    return list.length ? list : periodosOrdenados.slice(0, 1);
  }, [periodosOrdenados, currentMonth]);

  // ¿Hay selección válida?
  const haySeleccion =
    mesSeleccionado &&
    mesSeleccionado !== "Selecciona un periodo" &&
    periodosOrdenados.some((l) => norm(l) === norm(mesSeleccionado));

  // ✔️ Sin selección: todos hasta el actual (incluido)
  // ✔️ Con selección: seleccionado y su anterior
  const lineLabels = useMemo(() => {
    if (haySeleccion) {
      const idxSel = periodosOrdenados.findIndex((l) => norm(l) === norm(mesSeleccionado));
      const prev = idxSel > 0 ? periodosOrdenados[idxSel - 1] : null;
      return prev ? [prev, periodosOrdenados[idxSel]] : [periodosOrdenados[idxSel]];
    }
    return periodosHastaActual;
  }, [haySeleccion, mesSeleccionado, periodosOrdenados, periodosHastaActual]);

  // Serie para esos labels (por fecha de pago)
  // 🔧 FIX: incluir pagosFiltradosPorCobrador en dependencias para evitar valores 0 por cierre obsoleto
  const serieSocios = useMemo(
    () => lineLabels.map((per) => sumaPeriodoPorFecha(per)),
    [lineLabels, pagosFiltradosPorCobrador]
  );

  const maxSocios = useMemo(() => Math.max(0, ...serieSocios), [serieSocios]);

  /* ========= LINE CHART ========= */
  const lineData = {
    labels: lineLabels,
    datasets: [
      {
        label: "Recaudación",
        data: serieSocios,
        borderColor: "#0ea5e9",
        backgroundColor: "rgba(14,165,233,0.12)",
        fill: true,
        tension: 0.35,
        pointRadius: serieSocios.map((v) => (v === maxSocios && v > 0 ? 6 : 3)),
        pointHoverRadius: 7,
      },
    ],
  };

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "top" },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const val = ctx.parsed.y || 0;
            return `Recaudación: $${val.toLocaleString("es-AR")}`;
          },
        },
      },
    },
    scales: {
      x: { ticks: { autoSkip: false } },
      y: {
        beginAtZero: true,
        ticks: { callback: (v) => "$" + Number(v).toLocaleString("es-AR") },
      },
    },
  };

  // ===== Texto de variaciones bajo la línea =====
  const variacionesTexto = useMemo(() => {
    const arr = [];
    for (let i = 1; i < lineLabels.length; i++) {
      const prevLabel = lineLabels[i - 1];
      const currLabel = lineLabels[i];
      const prevVal = serieSocios[i - 1] || 0;
      const currVal = serieSocios[i] || 0;
      const diff = currVal - prevVal;
      const pct = prevVal === 0 ? 0 : (diff / prevVal) * 100;
      const signo = diff > 0 ? "aumentó" : diff < 0 ? "cayó" : "se mantuvo";
      arr.push(
        `De ${prevLabel} a ${currLabel} ${signo} $${Math.abs(diff).toLocaleString(
          "es-AR"
        )} (${(diff >= 0 ? "+" : "")}${pct.toFixed(1)}%).`
      );
    }
    return arr;
  }, [lineLabels, serieSocios]);

  /* ========= PIE CHART (Pagaron vs No pagaron por FECHA de pago) ========= */
  const periodoEfectivo = useMemo(() => {
    if (haySeleccion) return mesSeleccionado;
    if (periodosHastaActual.length > 0) return periodosHastaActual[periodosHastaActual.length - 1];
    return periodosOrdenados[periodosOrdenados.length - 1] || undefined;
  }, [haySeleccion, mesSeleccionado, periodosHastaActual, periodosOrdenados]);

  // Socios únicos que pagaron en los meses del período efectivo (fecha de pago)
  const pagaronEnPeriodo = useMemo(() => {
    if (!periodoEfectivo) return 0;
    const meses = extractMonthsFromPeriodLabel(periodoEfectivo);
    if (!meses.length) return 0;

    const pagos = pagosFiltradosPorCobrador.filter((p) => {
      const m = getMonthFromPago(p);
      return m !== null && meses.includes(m);
    });

    const setSocios = new Set(
      pagos
        .map((p) => getIdSocio(p))
        .filter((id) => id !== null && id !== undefined && id !== "")
    );
    return setSocios.size;
  }, [periodoEfectivo, pagosFiltradosPorCobrador]);

  // Universo total para el pie
  const universoTotal =
    totalSocios > 0
      ? totalSocios
      : (() => {
          const s = new Set();
          for (const p of todosLosPagos || []) {
            const id = getIdSocio(p);
            if (id !== null && id !== undefined && id !== "") s.add(id);
          }
          return s.size;
        })();

  const noPagaron = Math.max(universoTotal - pagaronEnPeriodo, 0);

  // Mínimo visual (solo visual; tooltips muestran valores reales)
  const realPie = [pagaronEnPeriodo, noPagaron];
  const MIN_PCT = 0.02;
  let displayPie = realPie.slice();
  const totalReal = realPie[0] + realPie[1];
  if (totalReal > 0) {
    const pct0 = realPie[0] / totalReal;
    const pct1 = realPie[1] / totalReal;
    if (realPie[0] > 0 && pct0 < MIN_PCT) {
      displayPie[0] = Math.max(realPie[0], Math.ceil(totalReal * MIN_PCT));
      displayPie[1] = totalReal - displayPie[0];
    } else if (realPie[1] > 0 && pct1 < MIN_PCT) {
      displayPie[1] = Math.max(realPie[1], Math.ceil(totalReal * MIN_PCT));
      displayPie[0] = totalReal - displayPie[1];
    }
  }

  const pieData = {
    labels: ["Pagaron", "No pagaron"],
    datasets: [
      {
        data: displayPie,
        backgroundColor: ["#22c55e", "#ef4444"],
        borderColor: "#ffffff",
        borderWidth: 1,
        spacing: 0,
        cutout: "0%",
        rotation: -90,
        hoverOffset: 6,
      },
    ],
  };

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "bottom" },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const idx = ctx.dataIndex;
            const realVal = realPie[idx] || 0;
            const total = realPie[0] + realPie[1];
            const pct = total === 0 ? 0 : (realVal / total) * 100;
            return `${ctx.label}: ${realVal.toLocaleString("es-AR")} (${pct.toFixed(1)}%)`;
          },
        },
      },
    },
  };

  if (!open) return null;

  return (
    <div className="contable-modal-overlay" role="dialog" aria-modal="true">
      <div className="contable-modal">
        <div className="contable-modal-header">
          <h3>
            <FontAwesomeIcon icon={faChartPie} /> Gráficos de Recaudación
            {medioSeleccionado !== "todos" ? ` · ${medioSeleccionado}` : ""}
          </h3>
          <button className="contable-modal-close" onClick={onClose} aria-label="Cerrar">
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <div className="contable-modal-body">
          {/* ===== LÍNEAS ===== */}
          <div className="contable-chart-card">
            <h4>
              {haySeleccion
                ? "Comparativa de períodos (seleccionado vs anterior)"
                : "Evolución por período (hasta el período actual)"}
            </h4>

            <div className="contable-chart-wrapper">
              <Line data={lineData} options={lineOptions} />
            </div>

            {variacionesTexto.length > 0 && (
              <div className="contable-chart-footnote" style={{ marginTop: 8 }}>
                {variacionesTexto.map((t, i) => (
                  <div key={i}>• {t}</div>
                ))}
              </div>
            )}

            <small className="contable-chart-footnote">
              {haySeleccion
                ? "Se comparan únicamente el período seleccionado y su anterior. La suma usa la fecha de pago."
                : "Se muestran los períodos desde el inicio del año hasta el período actual. La suma usa la fecha de pago."}
            </small>
          </div>

          {/* ===== PIE ===== */}
          <div className="contable-chart-card">
            <h4>
              Pagos en {periodoEfectivo || "—"} · {Number(universoTotal).toLocaleString("es-AR")} socios
            </h4>
            <div className="contable-chart-wrapper contable-chart-wrapper--pie">
              <Pie data={pieData} options={pieOptions} />
            </div>

            <div className="contable-pie-totals">
              <div className="contable-pie-totals__item socios">
                <span className="label">Pagaron:</span>
                <span className="value">{Number(realPie[0]).toLocaleString("es-AR")}</span>
              </div>
              <div className="contable-pie-totals__item empresas">
                <span className="label">No pagaron:</span>
                <span className="value">{Number(realPie[1]).toLocaleString("es-AR")}</span>
              </div>
              <div className="contable-pie-totals__item total">
                <span className="label">Total socios:</span>
                <span className="value">{Number(realPie[0] + realPie[1]).toLocaleString("es-AR")}</span>
              </div>
            </div>

            <small className="contable-chart-footnote">
              El circular usa la <b>fecha de pago</b> para contar socios que pagaron en el período
              (incluye <b>CONTADO ANUAL</b> si su fecha cae dentro de los meses del período).
              Se aplica un <i>mínimo visual</i> para que siempre se vean ambas franjas; los valores
              reales se muestran en cifras y tooltips.
            </small>
          </div>
        </div>
      </div>
    </div>
  );
}
