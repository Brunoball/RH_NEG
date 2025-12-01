// src/components/Contable/DashboardContable.jsx
import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useTransition,
  useCallback,
  useDeferredValue,
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
  faTable,
  faChartPie,
  faFileExcel,
  faSearch,
  faArrowLeft,
  faSpinner,
  faLayerGroup,
  faUsers,
  faFilePdf,
} from "@fortawesome/free-solid-svg-icons";
import * as XLSX from "xlsx";

// PDFs externalizados
import { exportDetSocPDF } from "./pdf/ExportDetSocPDF";
import { exportCobranzaPDF } from "./pdf/ExportCobranzaPDF";

import ContableChartsModal from "./modalcontable/ContableChartsModal";
import Toast from "../Global/Toast";

/* Tablas */
import DetalleTable from "./tables/DetalleTable";
import CobMesTable from "./tables/CobMesTable";
import DetSocTable from "./tables/DetSocTable";

/* ===== Constantes / helpers ===== */
const MESES_NOMBRES = Object.freeze([
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
]);
const mesUC = (mNum) => MESES_NOMBRES[mNum - 1].toUpperCase();
const labelMes = (m) => (m && m !== "Todos los meses" ? ` · ${mesUC(parseInt(m, 10))}` : "");
const SKELETON_ROWS = 8;
const getTxt = (o, k) => (typeof o?.[k] === "string" ? o[k].trim() : "");

/* nombres / campos normalizados */
const getNombreSocio = (p) => {
  const combinado =
    getTxt(p, "Socio") ||
    getTxt(p, "socio") ||
    getTxt(p, "Nombre_Completo") ||
    getTxt(p, "nombre_completo");
  if (combinado) return combinado;

  const ape =
    getTxt(p, "Apellido") ||
    getTxt(p, "apellido") ||
    getTxt(p, "Apellidos") ||
    getTxt(p, "apellidos") ||
    getTxt(p, "Apellido_Socio") ||
    getTxt(p, "apellido_socio");

  const nom =
    getTxt(p, "Nombre") ||
    getTxt(p, "nombre") ||
    getTxt(p, "Nombres") ||
    getTxt(p, "nombres") ||
    getTxt(p, "Nombre_Socio") ||
    getTxt(p, "nombre_socio");

  if (ape && nom) return `${ape} ${nom}`.replace(/\s+/g, " ").trim();
  return ape || nom || "";
};

const getNombreCobrador = (p) =>
  p?.Cobrador ||
  p?.Nombre_Cobrador ||
  p?.nombre_cobrador ||
  p?.cobrador ||
  p?.Cobrador_Nombre ||
  "";

const getCategoriaTxt = (p) =>
  getTxt(p, "Nombre_Categoria") ||
  getTxt(p, "nombre_categoria") ||
  getTxt(p, "Categoria") ||
  getTxt(p, "categoria") ||
  "";

const getMedioPago = (p) =>
  p?.Medio_Pago || p?.medio_pago || p?.Medio || p?.medio || p?.MedioPago || "";

const getMonthFromDate = (d) => {
  if (!d || typeof d !== "string" || d.length < 7) return null;
  const mm = parseInt(d.substring(5, 7), 10);
  return Number.isNaN(mm) ? null : mm;
};

const isAnualLabel = (s) => String(s || "").toUpperCase().includes("ANUAL");

const extractMonthsFromPeriodLabel = (label) => {
  if (!label) return [];
  const nums = String(label).match(/\d{1,2}/g) || [];
  const months = nums
    .map((n) => parseInt(n, 10))
    .filter((n) => !Number.isNaN(n) && n >= 1 && n <= 12);
  return Array.from(new Set(months));
};

// Encontrar período que contiene un mes específico
const findPeriodoForMes = (periodosOpts, mesNum) => {
  if (!mesNum) return null;
  return periodosOpts.find((opt) => opt.months && opt.months.includes(mesNum))?.value || null;
};

const ok = (obj) => obj && (obj.success === true || obj.exito === true);

const arr = (obj) =>
  Array.isArray(obj?.data) ? obj.data : Array.isArray(obj?.datos) ? obj.datos : [];

/* ====== Normalizador por año ====== */
function buildYearIndexes(rawContable, rawListas) {
  let periodosSrv = [];
  let cobradoresSrv = [];

  if (rawListas && ok(rawListas) && rawListas.listas) {
    if (Array.isArray(rawListas.listas.periodos)) {
      periodosSrv = rawListas.listas.periodos
        .filter((p) => {
          const id = typeof p === "object" && p ? String(p.id ?? "") : "";
          const nombre = typeof p === "string" ? p : p?.nombre || "";
          if (id === "7") return false;
          if (isAnualLabel(nombre)) return false;
          return true;
        })
        .map((p) => (typeof p === "string" ? p : p?.nombre || ""))
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

  const periodosOpts = periodosSrv.map((label) => ({
    value: label,
    months: extractMonthsFromPeriodLabel(label),
  }));

  const datosMeses = arr(rawContable);
  const pagosAll = [];

  for (let i = 0; i < datosMeses.length; i++) {
    const b = datosMeses[i];
    if (Array.isArray(b?.pagos) && b.pagos.length) {
      for (let j = 0; j < b.pagos.length; j++) {
        const p = b.pagos[j];
        const _cb = String(getNombreCobrador(p)).trim();
        const _month = getMonthFromDate(p?.fechaPago);
        const _precioNum = parseFloat(p?.Precio) || 0;
        const _nombre = getNombreSocio(p);
        const _categoria = getCategoriaTxt(p);
        const _medio = String(getMedioPago(p) || "").trim() || "(Sin medio)";
        const _ts = p?.fechaPago ? new Date(p.fechaPago).getTime() || 0 : 0;

        pagosAll.push({
          ...p,
          _cb,
          _month,
          _precioNum,
          _nombreCompleto: _nombre,
          _categoriaTxt: _categoria,
          _medioPago: _medio,
          _ts,
        });
      }
    }
  }

  const pagosAllSorted = pagosAll.sort((a, b) => b._ts - a._ts);

  const pagosByMonth = Array.from({ length: 13 }, () => []);
  for (let k = 0; k < pagosAllSorted.length; k++) {
    const p = pagosAllSorted[k];
    if (p._month >= 1 && p._month <= 12) pagosByMonth[p._month].push(p);
  }

  const periodMergedMap = new Map();

  for (const opt of periodosOpts) {
    const months =
      opt?.months && opt.months.length ? opt.months : extractMonthsFromPeriodLabel(opt?.value);
    if (!months || !months.length) continue;

    if (months.length === 1) {
      periodMergedMap.set(opt.value, pagosByMonth[months[0]] || []);
    } else {
      const arrays = months
        .filter((m) => m >= 1 && m <= 12 && pagosByMonth[m]?.length)
        .map((m) => pagosByMonth[m]);

      if (!arrays.length) {
        periodMergedMap.set(opt.value, []);
        continue;
      }

      if (arrays.length === 1) {
        periodMergedMap.set(opt.value, arrays[0]);
        continue;
      }

      const idxs = arrays.map(() => 0);
      const merged = [];

      while (true) {
        let pick = -1;
        let bestTs = -1;
        for (let i = 0; i < arrays.length; i++) {
          const arrI = arrays[i];
          const pos = idxs[i];
          if (pos < arrI.length) {
            const ts = arrI[pos]._ts;
            if (ts > bestTs) {
              bestTs = ts;
              pick = i;
            }
          }
        }
        if (pick === -1) break;
        merged.push(arrays[pick][idxs[pick]++]);
      }

      periodMergedMap.set(opt.value, merged);
    }
  }

  const totalSocios = Number(rawContable?.total_socios ?? 0) || 0;
  const condonados = Array.isArray(rawContable?.condonados) ? rawContable.condonados : [];
  const aniosDisponibles = Array.isArray(rawContable.anios)
    ? rawContable.anios.map((n) => parseInt(n, 10)).filter(Boolean)
    : [];
  const anioSrv = parseInt(rawContable.anio_aplicado ?? 0, 10);
  const anioInicial =
    anioSrv > 0 ? anioSrv : aniosDisponibles.length ? Math.max(...aniosDisponibles) : "";

  return {
    periodosOpts,
    cobradores: cobradoresSrv,
    pagosAllSorted,
    pagosByMonth,
    periodMergedMap,
    totalSocios,
    condonados,
    aniosDisponibles,
    anioInicial,
  };
}

/**
 * A partir de la respuesta de obtener_monto_objetivo.php
 * arma los mapas que usa CobMesTable:
 *
 * - esperadosPorMes               { mes -> monto esperado TOTAL }
 * - esperadosPorMesPorCobrador    { cobrador -> { mes -> monto } }
 * - sociosPorMesPorCobrador       { cobrador -> { mes -> socios esperados } }
 * - esperadosPorMesPorCobradorEstado { cobrador -> { ESTADO -> { mes -> monto } } }
 * - sociosPorMesPorCobradorEstado { cobrador -> { ESTADO -> { mes -> socios esperados } } }
 */
const buildEsperadosMaps = (objetivo) => {
  const esperadosPorMes = {};
  const esperadosPorMesPorCobrador = {};
  const sociosPorMesPorCobrador = {};

  const esperadosPorMesPorCobradorEstado = {};
  const sociosPorMesPorCobradorEstado = {};

  // ===== 1) Totales por cobrador y MES (sin estado) =====
  const listaPM = objetivo?.esperado_por_cobrador_por_mes || [];
  for (const row of listaPM) {
    const cobradorNombre = String(row.nombre || "").trim();
    const porMes = row?.por_mes || {};
    const sociosCont = Number(row?.socios_contados || 0);

    for (const [mesStr, montoVal] of Object.entries(porMes)) {
      const mes = Number(mesStr);
      const monto = Number(montoVal || 0);

      // Global (todos los cobradores)
      esperadosPorMes[mes] = (esperadosPorMes[mes] || 0) + monto;

      // Por cobrador
      if (!esperadosPorMesPorCobrador[cobradorNombre]) {
        esperadosPorMesPorCobrador[cobradorNombre] = {};
      }
      esperadosPorMesPorCobrador[cobradorNombre][mes] =
        (esperadosPorMesPorCobrador[cobradorNombre][mes] || 0) + monto;

      // Socios: usamos socios_contados del cobrador
      if (!sociosPorMesPorCobrador[cobradorNombre]) {
        sociosPorMesPorCobrador[cobradorNombre] = {};
      }
      sociosPorMesPorCobrador[cobradorNombre][mes] =
        (sociosPorMesPorCobrador[cobradorNombre][mes] || 0) + sociosCont;
    }
  }

  // ===== 2) Totales por cobrador, MES y ESTADO (ACTIVO / PASIVO) =====
  const listaPME = objetivo?.esperado_por_cobrador_por_mes_estado || [];
  for (const row of listaPME) {
    const cobradorNombre = String(row.nombre || "").trim();
    const estado = String(row?.estado || "").toUpperCase().trim();
    if (estado !== "ACTIVO" && estado !== "PASIVO") continue;

    const porMes = row?.por_mes || {};
    const sociosCont = Number(row?.socios_contados || 0);

    for (const [mesStr, montoVal] of Object.entries(porMes)) {
      const mes = Number(mesStr);
      const monto = Number(montoVal || 0);

      // Inicializar estructuras si no existen
      if (!esperadosPorMesPorCobradorEstado[cobradorNombre]) {
        esperadosPorMesPorCobradorEstado[cobradorNombre] = {};
      }
      if (!esperadosPorMesPorCobradorEstado[cobradorNombre][estado]) {
        esperadosPorMesPorCobradorEstado[cobradorNombre][estado] = {};
      }

      if (!sociosPorMesPorCobradorEstado[cobradorNombre]) {
        sociosPorMesPorCobradorEstado[cobradorNombre] = {};
      }
      if (!sociosPorMesPorCobradorEstado[cobradorNombre][estado]) {
        sociosPorMesPorCobradorEstado[cobradorNombre][estado] = {};
      }

      // Monto esperado por COBRADOR + ESTADO + MES
      esperadosPorMesPorCobradorEstado[cobradorNombre][estado][mes] =
        (esperadosPorMesPorCobradorEstado[cobradorNombre][estado][mes] || 0) + monto;

      // Socios esperados por COBRADOR + ESTADO + MES
      sociosPorMesPorCobradorEstado[cobradorNombre][estado][mes] =
        (sociosPorMesPorCobradorEstado[cobradorNombre][estado][mes] || 0) + sociosCont;
    }
  }

  return {
    esperadosPorMes,
    esperadosPorMesPorCobrador,
    sociosPorMesPorCobrador,
    esperadosPorMesPorCobradorEstado,
    sociosPorMesPorCobradorEstado,
  };
};

/* ====== Skeleton rows ====== */
function renderSkeletonRows() {
  return Array.from({ length: SKELETON_ROWS }).map((_, idx) => (
    <div
      className="gridtable-row skeleton-row"
      role="row"
      key={`sk-${idx}`}
      aria-hidden="true"
    >
      <div className="gridtable-cell">
        <span className="skeleton-bar w-80" />
      </div>
      <div className="gridtable-cell">
        <span className="skeleton-bar w-40" />
      </div>
      <div className="gridtable-cell">
        <span className="skeleton-bar w-60" />
      </div>
      <div className="gridtable-cell">
        <span className="skeleton-bar w-50" />
      </div>
      <div className="gridtable-cell">
        <span className="skeleton-bar w-70" />
      </div>
    </div>
  ));
}

/* ===================== Componente ===================== */
export default function DashboardContable() {
  const navigate = useNavigate();

  // filtros
  const [anioSeleccionado, setAnioSeleccionado] = useState("");
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState("Selecciona un periodo");
  const [mesSeleccionado, setMesSeleccionado] = useState("Todos los meses"); // mes sin selección inicial
  const [cobradorSeleccionado, setCobradorSeleccionado] = useState("todos");
  const [searchText, setSearchText] = useState("");
  const searchDeferred = useDeferredValue(searchText);

  // vistas
  const [mainView, setMainView] = useState("detalle");

  // toasts
  const [showNoDataToast, setShowNoDataToast] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [toastError, setToastError] = useState(null);

  // datos base
  const [aniosDisponibles, setAniosDisponibles] = useState([]);
  const [periodosOpts, setPeriodosOpts] = useState([]);
  const [cobradores, setCobradores] = useState([]);
  const [totalSocios, setTotalSocios] = useState(0);
  const [condonados, setCondonados] = useState([]);
  const [datosMeses, setDatosMeses] = useState([]);
  const [datosEmpresas, setDatosEmpresas] = useState([]);

  const [error, setError] = useState(null);
  const [mostrarModalGraficos, setMostrarModalGraficos] = useState(false);
  const [isPending, startTransition] = useTransition();

  // estados de carga
  const [loadingYears, setLoadingYears] = useState(true);
  const [loadingPagos, setLoadingPagos] = useState(false);
  const [loadingEsperado, setLoadingEsperado] = useState(false);
  const [isLoadingTable, setIsLoadingTable] = useState(false);

  // Detalle Cobranza
  const [esperadosPorMes, setEsperadosPorMes] = useState({});
  const [esperadosPorMesPorCobrador, setEsperadosPorMesPorCobrador] = useState({});
  const [sociosPorMesPorCobrador, setSociosPorMesPorCobrador] = useState({});
  const [esperadosPorMesPorCobradorEstado, setEsperadosPorMesPorCobradorEstado] = useState({});
  const [sociosPorMesPorCobradorEstado, setSociosPorMesPorCobradorEstado] = useState({});
  const [loadingResumen, setLoadingResumen] = useState(false);

  // Detalle Socios
  const [loadingDetSoc, setLoadingDetSoc] = useState(false);
  const [detSocRows, setDetSocRows] = useState([]);
  const [detSocTotales, setDetSocTotales] = useState({
    ACTIVO: 0,
    PASIVO: 0,
  });

  // RAF & cache
  const computeRAF1 = useRef(0);
  const computeRAF2 = useRef(0);

  const yearCacheRef = useRef(Object.create(null));
  const curPagosAllSortedRef = useRef([]);
  const curPagosByMonthRef = useRef([]);
  const curPeriodMergedMapRef = useRef(new Map());

  // bandera de inicialización de filtros (primera vez)
  const didInitRef = useRef(false);

  const nfPesos = useMemo(() => new Intl.NumberFormat("es-AR"), []);

  const fetchJSON = useCallback(async (url, signal) => {
    const sep = url.includes("?") ? "&" : "?";
    const res = await fetch(`${url}${sep}ts=${Date.now()}`, { method: "GET", signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }, []);

  const [derived, setDerived] = useState({
    registros: [],
    total: 0,
    cobradoresUnicos: 0,
    esperado: 0,
    diferencia: 0,
  });

  /* ===== recomputeSync (usa refs actuales) ===== */
  const recomputeSync = useCallback((periodLabel, monthSel, cobrador) => {
    const all = curPagosAllSortedRef.current || [];
    const byMonth = curPagosByMonthRef.current || [];
    const byPeriod = curPeriodMergedMapRef.current || new Map();

    const monthNum =
      monthSel && monthSel !== "Todos los meses" ? parseInt(monthSel, 10) : 0;

    let base;

    if ((!periodLabel || periodLabel === "Selecciona un periodo") && !monthNum) {
      base = all;
    } else if ((periodLabel === "Selecciona un periodo" || !periodLabel) && monthNum) {
      base = byMonth[monthNum] || [];
    } else {
      base = byPeriod.get(periodLabel) || [];
      if (monthNum) {
        base = base.filter((p) => p._month === monthNum);
      }
    }

    if (cobrador !== "todos") {
      base = base.filter((p) => p._cb === cobrador);
    }

    let total = 0;
    const setCb = new Set();

    for (let i = 0; i < base.length; i++) {
      total += base[i]._precioNum;
      if (base[i]._cb) setCb.add(base[i]._cb);
    }

    return {
      registros: base,
      total,
      cobradoresUnicos: setCb.size,
    };
  }, []);

  /* ===== helper mesesDisponibles ===== */
  const mesesDisponibles = useMemo(() => {
    if (!anioSeleccionado) return [];
    if (!periodoSeleccionado || periodoSeleccionado === "Selecciona un periodo") {
      return Array.from({ length: 12 }, (_, i) => i + 1);
    }
    const opt = periodosOpts.find((o) => o.value === periodoSeleccionado);
    const ms =
      opt?.months?.length ? opt.months : extractMonthsFromPeriodLabel(periodoSeleccionado);
    return ms && ms.length ? ms : [];
  }, [anioSeleccionado, periodoSeleccionado, periodosOpts]);

  // usar NOMBRE del cobrador como key
  const fetchEsperadoMes = useCallback(
    async (mes) => {
      const u = new URL(`${BASE_URL}/api.php`);
      u.searchParams.set("action", "obtener_monto_objetivo");
      u.searchParams.set("anio", String(anioSeleccionado));
      u.searchParams.set("mes", String(mes));
      u.searchParams.set("todos_cobradores", "1");

      const res = await fetch(u.toString() + `&ts=${Date.now()}`);
      const data = await res.json().catch(() => ({}));

      // Usar la nueva función buildEsperadosMaps
      const mapsEsperados = buildEsperadosMaps(data);

      return {
        totalMes: mapsEsperados.esperadosPorMes[mes] || 0,
        porCobrador: Object.fromEntries(
          Object.entries(mapsEsperados.esperadosPorMesPorCobrador).map(([cobrador, meses]) => [
            cobrador,
            meses[mes] || 0,
          ])
        ),
        sociosPorCobrador: Object.fromEntries(
          Object.entries(mapsEsperados.sociosPorMesPorCobrador).map(([cobrador, meses]) => [
            cobrador,
            meses[mes] || 0,
          ])
        ),
        mapsEsperados, // Devolvemos todos los maps para uso posterior
      };
    },
    [anioSeleccionado]
  );

  const mesesParaResumen = useMemo(() => {
    if (!anioSeleccionado) return [];
    if (mesSeleccionado !== "Todos los meses") {
      return [parseInt(mesSeleccionado, 10)];
    }
    if (periodoSeleccionado && periodoSeleccionado !== "Selecciona un periodo") {
      const opt = periodosOpts.find((o) => o.value === periodoSeleccionado);
      const ms =
        opt?.months?.length ? opt.months : extractMonthsFromPeriodLabel(periodoSeleccionado);
      return ms && ms.length ? ms.slice().sort((a, b) => a - b) : [];
    }
    return Array.from({ length: 12 }, (_, i) => i + 1);
  }, [anioSeleccionado, mesSeleccionado, periodoSeleccionado, periodosOpts]);

  const recomputeResumen = useCallback(async () => {
    if (!anioSeleccionado || mesesParaResumen.length === 0) {
      setEsperadosPorMes({});
      setEsperadosPorMesPorCobrador({});
      setSociosPorMesPorCobrador({});
      setEsperadosPorMesPorCobradorEstado({});
      setSociosPorMesPorCobradorEstado({});
      return;
    }
    try {
      setLoadingResumen(true);
      const pairs = await Promise.all(
        mesesParaResumen.map((m) => fetchEsperadoMes(m).then((val) => [m, val]))
      );

      const obj = {};
      const porCobrador = {};
      const sociosCobradorGlobal = {};
      const porCobradorEstado = {};
      const sociosCobradorEstadoGlobal = {};

      for (const [
        m,
        { totalMes, porCobrador: mapCobrador, sociosPorCobrador, mapsEsperados },
      ] of pairs) {
        obj[m] = totalMes;

        // montos por cobrador
        for (const nombreKey of Object.keys(mapCobrador)) {
          if (!porCobrador[nombreKey]) porCobrador[nombreKey] = {};
          porCobrador[nombreKey][m] =
            (porCobrador[nombreKey][m] ?? 0) + mapCobrador[nombreKey];
        }

        // socios por cobrador
        for (const nombreKey of Object.keys(sociosPorCobrador)) {
          if (!sociosCobradorGlobal[nombreKey]) sociosCobradorGlobal[nombreKey] = {};
          sociosCobradorGlobal[nombreKey][m] =
            (sociosCobradorGlobal[nombreKey][m] ?? 0) + sociosPorCobrador[nombreKey];
        }

        // Por cobrador y estado
        for (const [cobrador, estados] of Object.entries(
          mapsEsperados.esperadosPorMesPorCobradorEstado || {}
        )) {
          for (const [estado, meses] of Object.entries(estados)) {
            const monto = meses[m] || 0;
            const socios =
              mapsEsperados.sociosPorMesPorCobradorEstado?.[cobrador]?.[estado]?.[m] || 0;

            if (!porCobradorEstado[cobrador]) porCobradorEstado[cobrador] = {};
            if (!porCobradorEstado[cobrador][estado]) porCobradorEstado[cobrador][estado] = {};
            porCobradorEstado[cobrador][estado][m] =
              (porCobradorEstado[cobrador][estado][m] || 0) + monto;

            if (!sociosCobradorEstadoGlobal[cobrador]) sociosCobradorEstadoGlobal[cobrador] = {};
            if (!sociosCobradorEstadoGlobal[cobrador][estado])
              sociosCobradorEstadoGlobal[cobrador][estado] = {};
            sociosCobradorEstadoGlobal[cobrador][estado][m] =
              (sociosCobradorEstadoGlobal[cobrador][estado][m] || 0) + socios;
          }
        }
      }

      setEsperadosPorMes(obj);
      setEsperadosPorMesPorCobrador(porCobrador);
      setSociosPorMesPorCobrador(sociosCobradorGlobal);
      setEsperadosPorMesPorCobradorEstado(porCobradorEstado);
      setSociosPorMesPorCobradorEstado(sociosCobradorEstadoGlobal);
    } catch (e) {
      console.error("Detalle de Cobranza: error obteniendo esperados por mes/cobrador", e);
      setEsperadosPorMes({});
      setEsperadosPorMesPorCobrador({});
      setSociosPorMesPorCobrador({});
      setEsperadosPorMesPorCobradorEstado({});
      setSociosPorMesPorCobradorEstado({});
    } finally {
      setLoadingResumen(false);
    }
  }, [anioSeleccionado, mesesParaResumen, fetchEsperadoMes]);

  const buildDetSocURL = useCallback(() => {
    if (!anioSeleccionado) return null;
    const u = new URL(`${BASE_URL}/api.php`);
    u.searchParams.set("action", "contar_socios_por_cat_estado");
    u.searchParams.set("anio", String(anioSeleccionado));

    if (mesSeleccionado && mesSeleccionado !== "Todos los meses") {
      const n = parseInt(mesSeleccionado, 10);
      if (Number.isFinite(n)) {
        u.searchParams.set("mes", String(n));
      }
    } else if (periodoSeleccionado && periodoSeleccionado !== "Selecciona un periodo") {
      u.searchParams.set("periodo", periodoSeleccionado);
    }

    if (cobradorSeleccionado && cobradorSeleccionado !== "todos") {
      u.searchParams.set("cobrador", cobradorSeleccionado);
    }

    return u.toString();
  }, [anioSeleccionado, mesSeleccionado, periodoSeleccionado, cobradorSeleccionado]);

  const fetchDetSoc = useCallback(async () => {
    const url = buildDetSocURL();
    if (!url) {
      setDetSocRows([]);
      setDetSocTotales({
        ACTIVO: 0,
        PASIVO: 0,
      });
      return;
    }
    try {
      setLoadingDetSoc(true);
      const res = await fetch(url + `&ts=${Date.now()}`);
      const data = await res.json().catch(() => ({}));
      if (data && (data.exito === true || data.success === true)) {
        const filas = Array.isArray(data.filas) ? data.filas : [];
        const tot = { ACTIVO: 0, PASIVO: 0 };
        for (const f of filas) {
          if (f.servicio === "ACTIVO") tot.ACTIVO += Number(f.cantidad || 0);
          if (f.servicio === "PASIVO") tot.PASIVO += Number(f.cantidad || 0);
        }
        setDetSocRows(filas);
        setDetSocTotales(tot);
      } else {
        setDetSocRows([]);
        setDetSocTotales({ ACTIVO: 0, PASIVO: 0 });
      }
    } catch (e) {
      console.error("contar_socios_por_cat_estado error:", e);
      setDetSocRows([]);
      setDetSocTotales({ ACTIVO: 0, PASIVO: 0 });
    } finally {
      setLoadingDetSoc(false);
    }
  }, [buildDetSocURL]);

  const buildEsperadoURL = useCallback(() => {
    if (!anioSeleccionado) return null;
    const u = new URL(`${BASE_URL}/api.php`);
    u.searchParams.set("action", "obtener_monto_objetivo");
    u.searchParams.set("anio", String(anioSeleccionado));

    if (mesSeleccionado && mesSeleccionado !== "Todos los meses") {
      const n = parseInt(mesSeleccionado, 10);
      if (Number.isFinite(n)) {
        u.searchParams.set("mes", String(n));
      }
    } else if (periodoSeleccionado && periodoSeleccionado !== "Selecciona un periodo") {
      u.searchParams.set("periodo", periodoSeleccionado);
    }

    if (cobradorSeleccionado && cobradorSeleccionado !== "todos") {
      u.searchParams.set("cobrador", cobradorSeleccionado);
    }

    return u.toString();
  }, [anioSeleccionado, mesSeleccionado, periodoSeleccionado, cobradorSeleccionado]);

  /* ===== carga inicial años + listas ===== */
  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        setError(null);
        setLoadingYears(true);

        const rawListas = await fetchJSON(
          `${BASE_URL}/api.php?action=listas`,
          ctrl.signal
        ).catch(() => null);

        const meta = await fetchJSON(
          `${BASE_URL}/api.php?action=contable&meta=years`,
          ctrl.signal
        );

        if (!ok(meta)) throw new Error("Respuesta inválida (years)");

        const years = Array.isArray(meta?.anios) ? meta.anios : [];
        const totalSoc = Number(meta?.total_socios ?? 0) || 0;

        setAniosDisponibles(years);
        setTotalSocios(totalSoc);

        const lastYear = years.length ? Math.max(...years) : "";
        setAnioSeleccionado(lastYear || "");

        let periodosSrv = [];
        let cobradoresSrv = [];

        if (rawListas && rawListas?.listas) {
          if (Array.isArray(rawListas.listas.periodos)) {
            periodosSrv = rawListas.listas.periodos
              .filter((p) => {
                const id = typeof p === "object" && p ? String(p.id ?? "") : "";
                const nombre = typeof p === "string" ? p : p?.nombre || "";
                if (id === "7") return false;
                if (String(nombre || "").toUpperCase().includes("ANUAL")) return false;
                return true;
              })
              .map((p) => (typeof p === "string" ? p : p?.nombre || ""))
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

        if (!periodosSrv.length) {
          periodosSrv = Array.from({ length: 12 }, (_, i) => `PERÍODO ${i + 1}`);
        }

        const periodosOptsLocal = periodosSrv.map((label) => ({
          value: label,
          months: extractMonthsFromPeriodLabel(label),
        }));

        setPeriodosOpts(periodosOptsLocal);
        setCobradores(cobradoresSrv);

        // ===== INICIALIZACIÓN SOLO LA PRIMERA VEZ =====
        if (!didInitRef.current && lastYear) {
          const hoy = new Date();
          const yNow = hoy.getFullYear();
          const mNow = hoy.getMonth() + 1; // 1..12

          if (Number(lastYear) === yNow) {
            const periodoActual = findPeriodoForMes(periodosOptsLocal, mNow);
            if (periodoActual) {
              setPeriodoSeleccionado(periodoActual);
            } else {
              setPeriodoSeleccionado("Selecciona un periodo");
            }
            setMesSeleccionado("Todos los meses");
          } else {
            setPeriodoSeleccionado("Selecciona un periodo");
            setMesSeleccionado("Todos los meses");
          }

          didInitRef.current = true;
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Error en carga inicial (years):", err);
          setError("Error al cargar los años disponibles.");
        }
      } finally {
        setLoadingYears(false);
      }
    })();

    return () => ctrl.abort();
  }, [fetchJSON]);

  const needsYearData = useMemo(() => Boolean(anioSeleccionado), [anioSeleccionado]);

  useEffect(() => {
    if (mesSeleccionado !== "Todos los meses") {
      const n = parseInt(mesSeleccionado, 10);
      if (!mesesDisponibles.includes(n)) {
        setMesSeleccionado("Todos los meses");
      }
    }
  }, [mesesDisponibles, mesSeleccionado]);

  /* ===== cargar pagos del año ===== */
  useEffect(() => {
    if (!needsYearData) return;
    const ctrl = new AbortController();

    (async () => {
      try {
        const key = String(anioSeleccionado);

        // 🔹 Si ya está en caché, lo usamos
        if (yearCacheRef.current[key]) {
          const { built, datosMeses } = yearCacheRef.current[key];

          setTotalSocios(built.totalSocios);
          setCondonados(built.condonados);
          setDatosMeses(datosMeses);

          curPagosAllSortedRef.current = built.pagosAllSorted;
          curPagosByMonthRef.current = built.pagosByMonth;
          curPeriodMergedMapRef.current = built.periodMergedMap;

          const d = recomputeSync(
            periodoSeleccionado,
            mesSeleccionado,
            cobradorSeleccionado
          );
          setDerived((prev) => ({
            ...prev,
            ...d,
          }));
          setIsLoadingTable(false);

          await recomputeResumen();
          await fetchDetSoc();
          return;
        }

        // 🔹 Si no está en caché, lo pedimos al backend
        setLoadingPagos(true);
        setIsLoadingTable(true);

        const raw = await fetchJSON(
          `${BASE_URL}/api.php?action=contable&anio=${encodeURIComponent(
            anioSeleccionado
          )}`,
          ctrl.signal
        );

        if (!ok(raw)) throw new Error("Formato inválido en datos contables del año");

        const built = buildYearIndexes(raw, {
          exito: true,
          listas: {
            periodos: periodosOpts.map((o) => o.value),
            cobradores: cobradores.map((n) => ({ nombre: n })),
          },
        });

        yearCacheRef.current[key] = {
          built,
          datosMeses: arr(raw),
        };

        setTotalSocios(built.totalSocios);
        setCondonados(built.condonados);
        setDatosMeses(yearCacheRef.current[key].datosMeses);

        curPagosAllSortedRef.current = built.pagosAllSorted;
        curPagosByMonthRef.current = built.pagosByMonth;
        curPeriodMergedMapRef.current = built.periodMergedMap;

        const d = recomputeSync(
          periodoSeleccionado,
          mesSeleccionado,
          cobradorSeleccionado
        );
        setDerived((prev) => ({
          ...prev,
          ...d,
        }));

        await recomputeResumen();
        await fetchDetSoc();
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Error al cargar pagos del año:", err);
          setToastError("No se pudieron obtener los pagos del año seleccionado.");
          setDerived({
            registros: [],
            total: 0,
            cobradoresUnicos: 0,
            esperado: 0,
            diferencia: 0,
          });
        }
      } finally {
        setLoadingPagos(false);
        setIsLoadingTable(false);
      }
    })();

    return () => ctrl.abort();
  }, [
    needsYearData,
    anioSeleccionado,
    fetchJSON,
    periodosOpts,
    cobradores,
    periodoSeleccionado,
    mesSeleccionado,
    cobradorSeleccionado,
    recomputeSync,
    recomputeResumen,
    fetchDetSoc,
  ]);

  /* ===== efecto: esperado total ===== */
  useEffect(() => {
    const url = buildEsperadoURL();
    if (!url) return;

    const ctrl = new AbortController();

    (async () => {
      try {
        setLoadingEsperado(true);
        const res = await fetch(url + `&ts=${Date.now()}`, { signal: ctrl.signal });
        const data = await res.json().catch(() => ({}));
        if (data && (data.exito === true || data.success === true)) {
          const esperado = Number(data.total_esperado || 0);
          setDerived((prev) => ({
            ...prev,
            esperado,
            diferencia: esperado - (prev.total || 0),
          }));
        } else {
          setDerived((prev) => ({ ...prev, esperado: 0, diferencia: 0 }));
        }
      } catch (e) {
        if (e.name !== "AbortError") {
          console.error("Error obtener_monto_objetivo:", e);
          setDerived((prev) => ({ ...prev, esperado: 0, diferencia: 0 }));
        }
      } finally {
        setLoadingEsperado(false);
      }
    })();

    return () => ctrl.abort();
  }, [buildEsperadoURL]);

  /* ===== efecto: recompute + resumen + det/soc ===== */
  useEffect(() => {
    const haveData = (curPagosAllSortedRef.current?.length || 0) > 0;
    setIsLoadingTable(!haveData);

    cancelAnimationFrame(computeRAF1.current);
    cancelAnimationFrame(computeRAF2.current);

    computeRAF1.current = requestAnimationFrame(() => {
      startTransition(() => {
        const d = recomputeSync(
          periodoSeleccionado,
          mesSeleccionado,
          cobradorSeleccionado
        );
        computeRAF2.current = requestAnimationFrame(() => {
          setDerived((prev) => {
            const diff = prev.esperado - d.total;
            return { ...prev, ...d, diferencia: diff };
          });
          if (haveData) setIsLoadingTable(false);
        });
      });
    });

    recomputeResumen();
    fetchDetSoc();

    return () => {
      cancelAnimationFrame(computeRAF1.current);
      cancelAnimationFrame(computeRAF2.current);
    };
  }, [
    periodoSeleccionado,
    mesSeleccionado,
    cobradorSeleccionado,
    startTransition,
    recomputeResumen,
    fetchDetSoc,
  ]);

  /* ===== periodos visibles ===== */
  const periodosVisibles = useMemo(() => {
    if (!anioSeleccionado) return [];

    if (mesSeleccionado && mesSeleccionado !== "Todos los meses") {
      const mesNum = parseInt(mesSeleccionado, 10);
      const periodoForMes = findPeriodoForMes(periodosOpts, mesNum);
      if (periodoForMes) {
        return periodosOpts.filter((p) => p.value === periodoForMes);
      }
      return [];
    }

    if (!periodoSeleccionado || periodoSeleccionado === "Selecciona un periodo")
      return periodosOpts;
    return periodosOpts.filter((p) => p.value === periodoSeleccionado);
  }, [periodosOpts, periodoSeleccionado, mesSeleccionado, anioSeleccionado]);

  /* ===== handlers UI ===== */
  const volver = useCallback(() => navigate(-1), [navigate]);

  const handlePeriodoChange = useCallback((e) => {
    setPeriodoSeleccionado(e.target.value);
    if (e.target.value !== "Selecciona un periodo") {
      setMesSeleccionado("Todos los meses");
    }
  }, []);

  const handleMesChange = useCallback(
    (e) => {
      const nuevoMes = e.target.value;
      setMesSeleccionado(nuevoMes);

      if (nuevoMes !== "Todos los meses") {
        const mesNum = parseInt(nuevoMes, 10);
        const periodoForMes = findPeriodoForMes(periodosOpts, mesNum);
        if (periodoForMes) setPeriodoSeleccionado(periodoForMes);
      }
    },
    [periodosOpts]
  );

  const handleCobradorChange = useCallback((e) => {
    setCobradorSeleccionado(e.target.value);
  }, []);

  const handleYearChange = useCallback((e) => {
    setAnioSeleccionado(e.target.value);
    setPeriodoSeleccionado("Selecciona un periodo");
    setMesSeleccionado("Todos los meses");
    setCobradorSeleccionado("todos");

    curPagosAllSortedRef.current = [];
    curPagosByMonthRef.current = [];
    curPeriodMergedMapRef.current = new Map();

    setDerived({
      registros: [],
      total: 0,
      cobradoresUnicos: 0,
      esperado: 0,
      diferencia: 0,
    });
    setEsperadosPorMes({});
    setEsperadosPorMesPorCobrador({});
    setSociosPorMesPorCobrador({});
    setEsperadosPorMesPorCobradorEstado({});
    setSociosPorMesPorCobradorEstado({});
    setDetSocRows([]);
    setDetSocTotales({ ACTIVO: 0, PASIVO: 0 });
  }, []);

  const handleSearch = useCallback((e) => {
    setSearchText(e.target.value);
  }, []);

  /* ===== Buscador ===== */
  const registrosFiltradosPorBusqueda = useMemo(() => {
    const q = (searchDeferred || "").trim().toLowerCase();
    if (!q) return derived.registros || [];

    const regs = derived.registros || [];
    const out = [];

    for (let i = 0; i < regs.length; i++) {
      const r = regs[i];
      if (
        (r._nombreCompleto || "").toLowerCase().includes(q) ||
        (r._cb || "").toLowerCase().includes(q) ||
        (r.Mes_Pagado || "").toLowerCase().includes(q) ||
        (r.fechaPago || "").toLowerCase().includes(q) ||
        String(r._precioNum || "").toLowerCase().includes(q) ||
        (r._categoriaTxt || "").toLowerCase().includes(q) ||
        (r._medioPago || "").toLowerCase().includes(q)
      ) {
        out.push(r);
      }
    }
    return out;
  }, [derived.registros, searchDeferred]);

  /* ===== util fecha / textos ===== */
  const hoyStr = () => {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yy = d.getFullYear();
    return `${dd}/${mm}/${yy}`;
  };

  const periodoLinea = () => {
    if (mesSeleccionado !== "Todos los meses") {
      return `Periodo ${parseInt(mesSeleccionado, 10)}  ${anioSeleccionado || ""}`;
    }
    if (periodoSeleccionado && periodoSeleccionado !== "Selecciona un periodo") {
      return `${periodoSeleccionado}  ${anioSeleccionado || ""}`;
    }
    return `Año ${anioSeleccionado || ""}`;
  };

  /* ===== EXPORTAR EXCEL ===== */
  const exportarExcel = useCallback(() => {
    if (mainView === "detalle") {
      const rows = registrosFiltradosPorBusqueda || [];
      if (!rows.length) {
        setShowNoDataToast(true);
        return;
      }

      const data = rows.map((r) => ({
        SOCIO: r._nombreCompleto,
        CATEGORÍA: r._categoriaTxt || "",
        MONTO: Number(r._precioNum || 0),
        COBRADOR: r._cb || "",
        "MEDIO PAGO": r._medioPago || "",
        "FECHA DE PAGO": r.fechaPago || "",
        "PERÍODO PAGO": r.Mes_Pagado || "",
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(data, {
        header: [
          "SOCIO",
          "CATEGORÍA",
          "MONTO",
          "COBRADOR",
          "MEDIO PAGO",
          "FECHA DE PAGO",
          "PERÍODO PAGO",
        ],
      });

      ws["!cols"] = [
        { wch: 32 },
        { wch: 14 },
        { wch: 10 },
        { wch: 20 },
        { wch: 16 },
        { wch: 14 },
        { wch: 18 },
      ];

      XLSX.utils.book_append_sheet(wb, ws, "Detalle");

      const parts = ["detalle"];
      if (anioSeleccionado) parts.push(anioSeleccionado);
      if (periodoSeleccionado && periodoSeleccionado !== "Selecciona un periodo") {
        parts.push(periodoSeleccionado.replace(/\s+/g, "_"));
      }
      if (mesSeleccionado && mesSeleccionado !== "Todos los meses") {
        parts.push(mesUC(parseInt(mesSeleccionado, 10)));
      }

      XLSX.writeFile(wb, `resumen_pagos_${parts.join("_")}.xlsx`);
      setShowSuccessToast(true);
      return;
    }

    if (mainView === "detsoc") {
      if (!detSocRows.length) {
        setShowNoDataToast(true);
        return;
      }

      const baseRows = detSocRows.map((r) => ({
        SERVICIO: r.servicio,
        CATEGORÍA: r.categoria,
        CANTIDAD: r.cantidad,
      }));

      const rowsConTotales = [
        ...baseRows,
        { SERVICIO: "TOTAL ACTIVO", CATEGORÍA: "—", CANTIDAD: detSocTotales.ACTIVO },
        { SERVICIO: "TOTAL PASIVO", CATEGORÍA: "—", CANTIDAD: detSocTotales.PASIVO },
      ];

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rowsConTotales, {
        header: ["SERVICIO", "CATEGORÍA", "CANTIDAD"],
      });
      ws["!cols"] = [{ wch: 16 }, { wch: 12 }, { wch: 10 }];

      XLSX.utils.book_append_sheet(wb, ws, "Detalle_Socios");

      const parts = ["det_soc"];
      if (anioSeleccionado) parts.push(anioSeleccionado);
      if (periodoSeleccionado && periodoSeleccionado !== "Selecciona un periodo") {
        parts.push(periodoSeleccionado.replace(/\s+/g, "_"));
      }
      if (mesSeleccionado && mesSeleccionado !== "Todos los meses") {
        parts.push(mesUC(parseInt(mesSeleccionado, 10)));
      }
      if (cobradorSeleccionado && cobradorSeleccionado !== "todos") {
        parts.push(cobradorSeleccionado.replace(/\s+/g, "_"));
      }

      XLSX.writeFile(wb, `det_soc_${parts.join("_")}.xlsx`);
      setShowSuccessToast(true);
      return;
    }

    // Detalle de Cobranza (Excel)
    if (periodosVisibles.length === 0) {
      setShowNoDataToast(true);
      return;
    }

    const rows = [];
    let totalEsperadoAnual = 0;
    let totalRecaudadoAnual = 0;

    for (const p of periodosVisibles) {
      const label = p.value;
      const months = p.months || extractMonthsFromPeriodLabel(label);

      let recaudado = 0;
      let esperado = 0;

      if (mesSeleccionado && mesSeleccionado !== "Todos los meses") {
        const mesNum = parseInt(mesSeleccionado, 10);
        let pagosMes = curPagosByMonthRef.current[mesNum] || [];
        if (cobradorSeleccionado !== "todos") {
          pagosMes = pagosMes.filter(
            (pg) =>
              pg._cb === cobradorSeleccionado ||
              (pg.id_cobrador ?? pg._cb) === cobradorSeleccionado
          );
        }
        recaudado = pagosMes.reduce((acc, pg) => acc + (pg._precioNum || 0), 0);

        // Esperado:
        if (cobradorSeleccionado === "todos") {
          esperado = Number(esperadosPorMes[mesNum] || 0);
        } else {
          esperado = Number(
            esperadosPorMesPorCobrador?.[cobradorSeleccionado]?.[mesNum] || 0
          );
        }
      } else {
        for (const m of months) {
          let pagosMes = curPagosByMonthRef.current[m] || [];
          if (cobradorSeleccionado !== "todos") {
            pagosMes = pagosMes.filter(
              (pg) =>
                pg._cb === cobradorSeleccionado ||
                (pg.id_cobrador ?? pg._cb) === cobradorSeleccionado
            );
          }
          recaudado += pagosMes.reduce((acc, pg) => acc + (pg._precioNum || 0), 0);

          if (cobradorSeleccionado === "todos") {
            esperado += Number(esperadosPorMes[m] || 0);
          } else {
            esperado += Number(
              esperadosPorMesPorCobrador?.[cobradorSeleccionado]?.[m] || 0
            );
          }
        }
      }

      const diferencia = esperado - recaudado;
      totalEsperadoAnual += esperado;
      totalRecaudadoAnual += recaudado;

      rows.push({
        PERÍODO: label,
        ESPERADO: esperado,
        RECAUDADO: recaudado,
        "DIFERENCIA (ESP-REC)": diferencia,
      });
    }

    rows.push({
      PERÍODO: "TOTAL AÑO",
      ESPERADO: totalEsperadoAnual,
      RECAUDADO: totalRecaudadoAnual,
      "DIFERENCIA (ESP-REC)": totalEsperadoAnual - totalRecaudadoAnual,
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows, {
      header: ["PERÍODO", "ESPERADO", "RECAUDADO", "DIFERENCIA (ESP-REC)"],
    });
    ws["!cols"] = [{ wch: 26 }, { wch: 14 }, { wch: 14 }, { wch: 20 }];

    XLSX.utils.book_append_sheet(wb, ws, "Detalle_Cobranza");

    const parts = ["cobranza"];
    if (anioSeleccionado) parts.push(anioSeleccionado);
    if (periodoSeleccionado && periodoSeleccionado !== "Selecciona un periodo") {
      parts.push(periodoSeleccionado.replace(/\s+/g, "_"));
    }
    if (cobradorSeleccionado && cobradorSeleccionado !== "todos") {
      parts.push(cobradorSeleccionado.replace(/\s+/g, "_"));
    }

    XLSX.writeFile(wb, `resumen_pagos_${parts.join("_")}.xlsx`);
    setShowSuccessToast(true);
  }, [
    mainView,
    registrosFiltradosPorBusqueda,
    periodosVisibles,
    esperadosPorMes,
    esperadosPorMesPorCobrador,
    cobradorSeleccionado,
    anioSeleccionado,
    periodoSeleccionado,
    mesSeleccionado,
    detSocRows,
    detSocTotales,
  ]);

  /* ===== EXPORTAR PDF ===== */
  /* ===== EXPORTAR PDF ===== */
  const exportarPDF = useCallback(() => {
    // 1) Vista DETALLE: no hay PDF
    if (mainView === "detalle") {
      setShowNoDataToast(true);
      return;
    }

    // 2) Vista DETALLE DE SOCIOS
    if (mainView === "detsoc") {
      if (!detSocRows.length) {
        setShowNoDataToast(true);
        return;
      }
      exportDetSocPDF({
        rows: detSocRows,
        totales: detSocTotales,
        fecha: hoyStr(),
        lineaPeriodo: periodoLinea(),
        anio: anioSeleccionado,
        periodo: periodoSeleccionado,
        mes: mesSeleccionado,
        cobrador: cobradorSeleccionado,
      });
      setShowSuccessToast(true);
      return;
    }

    // 3) Vista DETALLE DE COBRANZA - Exportar tabla COMPLETA
    if (periodosVisibles.length === 0) {
      setShowNoDataToast(true);
      return;
    }

    // Exportar tabla completa con jerarquía
    exportCobranzaPDF({
      rows: [], // No se usa directamente
      periodosVisibles,
      esperadosPorMes,
      esperadosPorMesPorCobrador,
      sociosPorMesPorCobrador,
      getPagosByMonth: (m) => curPagosByMonthRef.current[m] || [],
      cobradorSeleccionado,
      mesSeleccionado,
      nfPesos,
      esperadosPorMesPorCobradorEstado,
      sociosPorMesPorCobradorEstado,
      fecha: hoyStr(),
      lineaPeriodo: periodoLinea(),
      anio: anioSeleccionado,
      periodo: periodoSeleccionado,
      cobrador: cobradorSeleccionado,
    });
    
    setShowSuccessToast(true);
  }, [
    mainView,
    detSocRows,
    detSocTotales,
    periodosVisibles,
    esperadosPorMes,
    esperadosPorMesPorCobrador,
    sociosPorMesPorCobrador,
    esperadosPorMesPorCobradorEstado,
    sociosPorMesPorCobradorEstado,
    anioSeleccionado,
    periodoSeleccionado,
    mesSeleccionado,
    cobradorSeleccionado,
    nfPesos,
  ]);

  const haveData = (curPagosAllSortedRef.current?.length || 0) > 0;
  const showSkeleton = loadingPagos || (isLoadingTable && !haveData);

  /* ====== Cards resumen ====== */
  const CardsResumen = () => {
    const box = {
      wrap: {
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0,1fr))",
        gap: "12px",
        margin: "12px 10px 6px",
      },
      card: {
        border: "1px dashed rgba(0,0,0,.12)",
        borderRadius: "12px",
        padding: "14px 16px",
        background: "#fff",
      },
      title: {
        fontSize: 13,
        fontWeight: 600,
        color: "#334155",
      },
      num: {
        fontSize: 22,
        fontWeight: 800,
        marginTop: 4,
      },
      foot: {
        fontSize: 11,
        color: "#6b7280",
        marginTop: 2,
      },
    };

    if (mainView === "cobmes") {
      const esperado = Number(derived.esperado || 0);
      const recaudado = Number(derived.total || 0);
      const diferencia = Number(esperado - recaudado); // esperado – recaudado

      // siempre sin signo, solo color (verde = superávit, rojo = faltante)
      const diffTxt = `$${nfPesos.format(Math.abs(diferencia))}`;
      const colorTexto = diferencia > 0 ? "#dc2626" : "#16a34a"; // rojo si falta, verde si sobra

      return (
        <div style={box.wrap} aria-label="Resumen global (montos)">
          <div style={box.card}>
            <div style={box.title}>Total recaudado</div>
            <div style={box.num}>${nfPesos.format(recaudado)}</div>
            <div style={box.foot}>{anioSeleccionado ? `Año ${anioSeleccionado}` : ""}</div>
          </div>
          <div style={box.card}>
            <div style={box.title}>
              Total esperado{" "}
              {loadingEsperado && (
                <FontAwesomeIcon icon={faSpinner} spin style={{ marginLeft: 6 }} />
              )}
            </div>
            <div style={box.num}>${nfPesos.format(esperado)}</div>
            <div style={box.foot}>{anioSeleccionado ? `Año ${anioSeleccionado}` : ""}</div>
          </div>
          <div style={{ ...box.card, borderColor: colorTexto }}>
            <div style={{ ...box.title, color: colorTexto }}>
              Faltante / Superávit (esperado – recaudado)
            </div>
            <div style={{ ...box.num, color: colorTexto }}>
              {diffTxt}
            </div>
            <div style={box.foot}>= Comparación con filtros aplicados</div>
          </div>
        </div>
      );
    }

    // Detalle de Socios
    const totalAct = Number(detSocTotales.ACTIVO || 0);
    const totalPas = Number(detSocTotales.PASIVO || 0);
    const totalGen = totalAct + totalPas;

    return (
      <div style={box.wrap} aria-label="Resumen de socios">
        <div style={box.card}>
          <div style={box.title}>Total ACTIVO</div>
          <div style={box.num}>{totalAct}</div>
          <div style={box.foot}>{anioSeleccionado ? `Año ${anioSeleccionado}` : ""}</div>
        </div>
        <div style={box.card}>
          <div style={box.title}>Total PASIVO</div>
          <div style={box.num}>{totalPas}</div>
          <div style={box.foot}>{anioSeleccionado ? `Año ${anioSeleccionado}` : ""}</div>
        </div>
        <div style={{ ...box.card, borderColor: "rgba(59,130,246,.35)" }}>
          <div style={{ ...box.title, color: "#2563eb" }}>TOTAL GENERAL</div>
          <div style={box.num}>{totalGen}</div>
          <div style={box.foot}>= Activo + Pasivo</div>
        </div>
      </div>
    );
  };

  /* ===== Render ===== */
  return (
    <div className="contable-viewport">
      {/* HEADER */}
      <header className="contable-topbar">
        <h1 className="contable-topbar-title">
          <FontAwesomeIcon icon={faDollarSign} /> Resumen de pagos
        </h1>

        <button
          className="contable-back-button"
          onClick={volver}
          aria-label="Volver"
        >
          <FontAwesomeIcon icon={faArrowLeft} />
          &nbsp; Volver
        </button>
      </header>

      {/* LAYOUT */}
      <div className="contable-grid">
        {/* SIDEBAR */}
        <aside className="contable-sidebar">
          {/* Errores generales */}
          {error &&
            error !== "No se pudieron obtener los pagos del año seleccionado." && (
              <div className="contable-warning">
                <FontAwesomeIcon icon={faExclamationTriangle} />
                <span>{error}</span>
                <button
                  onClick={() => setError(null)}
                  className="contable-close-error"
                  aria-label="Cerrar error"
                >
                  <FontAwesomeIcon icon={faTimes} />
                </button>
              </div>
            )}

          <h3 className="side-block-title" style={{ marginTop: 0 }}>
            <FontAwesomeIcon icon={faCalendarAlt} /> Filtros
          </h3>

          <section className="side-block">
            {/* Año */}
            <label className="side-field">
              <span>
                Año{" "}
                {loadingYears && (
                  <FontAwesomeIcon icon={faSpinner} spin title="Cargando..." style={{ marginLeft: 6 }} />
                )}
              </span>
              <select
                value={anioSeleccionado || ""}
                onChange={handleYearChange}
                disabled={loadingYears || aniosDisponibles.length === 0}
              >
                {loadingYears ? (
                  <option>Cargando…</option>
                ) : aniosDisponibles.length === 0 ? (
                  <option value="">Sin pagos</option>
                ) : (
                  aniosDisponibles.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))
                )}
              </select>
            </label>

            {/* Período */}
            <label className="side-field">
              <span>
                Período{" "}
                {loadingPagos && needsYearData && (
                  <FontAwesomeIcon
                    icon={faSpinner}
                    spin
                    title="Cargando pagos…"
                    style={{ marginLeft: 6 }}
                  />
                )}
              </span>
              <select
                value={periodoSeleccionado}
                onChange={handlePeriodoChange}
                disabled={!anioSeleccionado || loadingYears}
                title={!anioSeleccionado ? "Seleccione un año" : undefined}
              >
                <option value="Selecciona un periodo">Selecciona un periodo</option>
                {periodosOpts.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.value}
                  </option>
                ))}
              </select>
            </label>

            {/* Mes */}
            <label className="side-field">
              <span>
                Mes{" "}
                {loadingPagos && needsYearData && (
                  <FontAwesomeIcon
                    icon={faSpinner}
                    spin
                    title="Cargando pagos…"
                    style={{ marginLeft: 6 }}
                  />
                )}
              </span>
              <select
                value={mesSeleccionado}
                onChange={handleMesChange}
                disabled={!anioSeleccionado || loadingYears}
                title={!anioSeleccionado ? "Seleccione un año" : undefined}
              >
                <option>Todos los meses</option>
                {mesesDisponibles.map((m) => (
                  <option key={m} value={m}>
                    {mesUC(m)}
                  </option>
                ))}
              </select>
            </label>

            {/* Cobrador */}
            <label className="side-field">
              <span>Cobrador</span>
              <select
                value={cobradorSeleccionado}
                onChange={handleCobradorChange}
                disabled={!anioSeleccionado || loadingYears}
              >
                <option value="todos">Todos</option>
                {cobradores.map((cb, idx) => (
                  <option key={idx} value={cb}>
                    {cb}
                  </option>
                ))}
              </select>
            </label>

            {/* Acciones */}
            <div className="side-actions">
              <button
                className="btn-dark grafics"
                type="button"
                onClick={() => setMostrarModalGraficos(true)}
                disabled={!anioSeleccionado || loadingYears}
                title="Ver gráficos"
              >
                <FontAwesomeIcon icon={faChartPie} /> Gráficos
              </button>

              <button
                className="btn-dark excel"
                type="button"
                onClick={exportarExcel}
                disabled={!anioSeleccionado || loadingYears}
                title="Exportar Excel"
              >
                <FontAwesomeIcon icon={faFileExcel} /> Excel
              </button>

              <button
                className="btn-dark pdf"
                type="button"
                onClick={exportarPDF}
                disabled={!anioSeleccionado || loadingYears || mainView === "detalle"}
                aria-disabled={!anioSeleccionado || loadingYears || mainView === "detalle"}
                title={
                  mainView === "detalle"
                    ? "Disponible en Detalle de Socios o Detalle de Cobranza"
                    : mainView === "detsoc"
                    ? "Exportar PDF Detalle de Socios"
                    : "Exportar PDF Detalle de Cobranza"
                }
              >
                <FontAwesomeIcon icon={faFilePdf} /> PDF
              </button>
            </div>
          </section>
        </aside>

        {/* MAIN */}
        <main className="contable-main">
          {/* Tabs */}
          <div className="main-switch" role="tablist" aria-label="Cambiar vista principal">
            <div className="switch-left">
              <button
                type="button"
                role="tab"
                aria-selected={mainView === "detalle"}
                className={`segmented ${mainView === "detalle" ? "is-active" : ""}`}
                onClick={() => setMainView("detalle")}
              >
                <FontAwesomeIcon icon={faTable} /> Detalle
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={mainView === "detsoc"}
                className={`segmented ${mainView === "detsoc" ? "is-active" : ""}`}
                onClick={() => setMainView("detsoc")}
              >
                <FontAwesomeIcon icon={faUsers} /> Detalle de Socios
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={mainView === "cobmes"}
                className={`segmented ${mainView === "cobmes" ? "is-active" : ""}`}
                onClick={() => setMainView("cobmes")}
              >
                <FontAwesomeIcon icon={faLayerGroup} /> Detalle de Cobranza
              </button>
            </div>

            <div className="switch-right">
              {mainView === "detalle" && (
                <div className="searchbox">
                  <FontAwesomeIcon icon={faSearch} />
                  <input
                    type="text"
                    placeholder="Buscar por socio, categoría, cobrador, medio, período, fecha o monto…"
                    value={searchText}
                    onChange={handleSearch}
                    disabled={!anioSeleccionado || loadingYears}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Cards resumen */}
          {(mainView === "cobmes" || mainView === "detsoc") && <CardsResumen />}

          {/* Tablas */}
          {mainView === "detalle" && (
            <DetalleTable
              showSkeleton={showSkeleton || isPending}
              renderSkeletonRows={renderSkeletonRows}
              needsYearData={needsYearData}
              registrosFiltradosPorBusqueda={registrosFiltradosPorBusqueda}
              nfPesos={nfPesos}
            />
          )}

          {mainView === "cobmes" && (
            <CobMesTable
              loadingResumen={loadingResumen}
              periodosVisibles={periodosVisibles}
              esperadosPorMes={esperadosPorMes}
              esperadosPorMesPorCobrador={esperadosPorMesPorCobrador}
              sociosPorMesPorCobrador={sociosPorMesPorCobrador}
              esperadosPorMesPorCobradorEstado={esperadosPorMesPorCobradorEstado}
              sociosPorMesPorCobradorEstado={sociosPorMesPorCobradorEstado}
              getPagosByMonth={(m) => curPagosByMonthRef.current[m] || []}
              cobradorSeleccionado={cobradorSeleccionado}
              mesSeleccionado={mesSeleccionado}
              nfPesos={nfPesos}
            />
          )}

          {mainView === "detsoc" && (
            <DetSocTable
              anioSeleccionado={anioSeleccionado}
              loadingDetSoc={loadingDetSoc}
              detSocRows={detSocRows}
              detSocTotales={detSocTotales}
            />
          )}
        </main>
      </div>

      {/* MODAL GRÁFICOS */}
      <ContableChartsModal
        open={mostrarModalGraficos}
        onClose={() => setMostrarModalGraficos(false)}
        datosMeses={datosMeses}
        datosEmpresas={datosEmpresas}
        mesSeleccionado={mesSeleccionado}
        medioSeleccionado={cobradorSeleccionado}
        totalSocios={totalSocios}
        anioSeleccionado={anioSeleccionado}
        condonados={condonados}
      />

      {/* TOASTS */}
      {showNoDataToast && (
        <Toast
          tipo="advertencia"
          mensaje="No hay datos para exportar con los filtros actuales."
          duracion={2500}
          onClose={() => setShowNoDataToast(false)}
        />
      )}

      {showSuccessToast && (
        <Toast
          tipo="exito"
          mensaje="Exportación realizada con éxito."
          duracion={2200}
          onClose={() => setShowSuccessToast(false)}
        />
      )}

      {toastError && (
        <Toast
          tipo="advertencia"
          mensaje={toastError}
          duracion={2600}
          onClose={() => setToastError(null)}
        />
      )}
    </div>
  );
}
