// ✅ REEMPLAZAR COMPLETO
// src/components/Socios/Socios.jsx
import React, {
  useEffect,
  useState,
  useMemo,
  useRef,
  useCallback,
  useTransition,
  useDeferredValue,
} from "react";
import ReactDOM from "react-dom";
import { useNavigate, useLocation } from "react-router-dom";
import { FixedSizeList as List, areEqual } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";
import BASE_URL from "../../config/config";
import {
  FaInfoCircle,
  FaEdit,
  FaTrash,
  FaUserMinus,
  FaArrowLeft,
  FaUserPlus,
  FaFileExcel,
  FaUserSlash,
  FaSearch,
  FaTimes,
  FaUsers,
  FaFilter,
  FaChevronDown,
  FaCalendarAlt,
  FaPhoneAlt,
} from "react-icons/fa";
import "./Socios.css";
import "./modales/ModalCumple18Socio.css";
import ModalEliminarSocio from "./modales/ModalEliminarSocio";
import ModalInfoSocio from "./modales/ModalInfoSocio";
import ModalDarBajaSocio from "./modales/ModalDarBajaSocio";
import ModalRegistrarContactoSocio from "./modales/ModalRegistrarContactoSocio";
import ModalHistorialContactoSocio from "./modales/ModalHistorialContactoSocio";
import ModalCumple18Socio from "./modales/ModalCumple18Socio";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import Toast from "../Global/Toast";
import "../Global/roots.css";

/* ============================
   CONSTANTES / PERFORMANCE
============================ */
const MIN_SPINNER_MS = 0;
const MAX_CASCADE = 14;
const CASCADE_DISABLE_ABOVE = 200;
const NAME_DEBOUNCE_MS = 20;
const ITEM_SIZE = 44; // desktop

// Alturas responsivas para móvil
const MOBILE_ITEM_SIZE = 230;
const MOBILE_ITEM_SIZE_SELECTED = 270;
function useResponsiveItemSize(hasSelected) {
  const [size, setSize] = useState(ITEM_SIZE);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const update = () => {
      if (mq.matches) {
        setSize(hasSelected ? MOBILE_ITEM_SIZE_SELECTED : MOBILE_ITEM_SIZE);
      } else {
        setSize(ITEM_SIZE);
      }
    };
    update();
    mq.addEventListener?.("change", update);
    mq.addListener?.(update);
    return () => {
      mq.removeEventListener?.("change", update);
      mq.removeListener?.(update);
    };
  }, [hasSelected]);
  return size;
}

/* ============================
   STORAGE KEYS
============================ */
const SS_KEYS = {
  SEL_ID: "socios_last_sel_id",
  SCROLL: "socios_last_scroll",
  TS: "socios_last_ts",
  FILTERS: "socios_last_filters",
};
const LS_FILTERS = "filtros_socios_v5";
const LS_CUMPLE_18_CERRADOS = "socios_cumple_18_23_cerrados_v2";


/* ============================
   HELPERS
============================ */
const buildAddress = (domicilio, numero) => {
  const calle = String(domicilio ?? "").trim();
  const num = String(numero ?? "").trim();
  if (!calle && !num) return "";
  if (calle && num && calle.includes(num)) return calle;
  return `${calle} ${num}`.trim();
};
const getFirstLetter = (name) => {
  const s = String(name ?? "").trim();
  return s ? s[0].toUpperCase() : "";
};
const parseDateToTs = (d) => {
  if (!d) return null;
  const parts = String(d).slice(0, 10).split("-");
  if (parts.length === 3) {
    const [yy, mm, dd] = parts.map(Number);
    const ts = new Date(yy, mm - 1, dd).getTime();
    return Number.isFinite(ts) ? ts : null;
  }
  const ts = new Date(d).getTime();
  return Number.isFinite(ts) ? ts : null;
};

const getLocalToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const readJsonLocalStorage = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const writeJsonLocalStorage = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
};

const isDateInCurrentYear = (value) => {
  const s = String(value ?? "").slice(0, 10);
  if (!s) return false;
  const [yy] = s.split("-");
  return Number(yy) === new Date().getFullYear();
};

const getEdadActual = (nacimiento, today = getLocalToday()) => {
  const s = String(nacimiento ?? "").slice(0, 10);
  if (!s) return null;

  const [yy, mm, dd] = s.split("-").map(Number);
  if (!yy || !mm || !dd) return null;

  let edad = today.getFullYear() - yy;
  const yaCumplioEsteAnio =
    today.getMonth() + 1 > mm ||
    (today.getMonth() + 1 === mm && today.getDate() >= dd);

  if (!yaCumplioEsteAnio) edad -= 1;

  return Number.isFinite(edad) ? edad : null;
};

const getCumple18Info = (nacimiento, today = getLocalToday()) => {
  const s = String(nacimiento ?? "").slice(0, 10);
  if (!s) return null;

  const [yy, mm, dd] = s.split("-").map(Number);
  if (!yy || !mm || !dd) return null;

  const edad = getEdadActual(s, today);
  if (edad == null || edad < 18 || edad > 23) return null;

  const cumpleEsteAnio = new Date(today.getFullYear(), mm - 1, dd);
  const proximoCumple = new Date(
    today.getFullYear() + (cumpleEsteAnio.getTime() < today.getTime() ? 1 : 0),
    mm - 1,
    dd
  );

  const nacimientoLabel = formatDateDisplay(s);
  const proximoCumpleIso = proximoCumple.toISOString().slice(0, 10);

  return {
    anio: today.getFullYear(),
    edad,
    rango: "18-23",
    fechaNacimiento: s,
    fechaNacimientoLabel: nacimientoLabel,
    proximoCumple: proximoCumpleIso,
    proximoCumpleLabel: formatDateDisplay(proximoCumpleIso),
  };
};

const getCumple18DismissKey = (socio, info) =>
  `${info?.anio || new Date().getFullYear()}:${info?.rango || "18-23"}:${socio?.id_socio || socio?._idStr || ""}`;

const getDeudaMesesFromSocio = (s) => {
  const raw =
    s.deuda_meses ??
    s.meses_deuda ??
    s.deuda_periodos ??
    s.periodos_deuda ??
    s.meses_adeudados ??
    0;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n;
};

const getEstadoPago = (deudaMeses) => {
  const d = Number(deudaMeses);
  if (!Number.isFinite(d) || d <= 0) return "al-dia";
  if (d <= 2) return "debe-1-2";
  return "debe-3+";
};

const normalizeDeudaPagoFilter = (value) =>
  String(value ?? "TODOS")
    .trim()
    .toUpperCase();

const socioCumpleFiltroDeudaPago = (socio, filtro) => {
  const valor = normalizeDeudaPagoFilter(filtro);
  if (!valor || valor === "TODOS") return true;

  const estado = String(socio?._estadoPago ?? "").trim();

  if (valor === "AL_DIA") return estado === "al-dia";
  if (valor === "DEBE_1_2") return estado === "debe-1-2";
  if (valor === "DEBE_3_MAS") return estado === "debe-3+";

  return true;
};

const getLabelDeudaPago = (value) => {
  const normalizado = normalizeDeudaPagoFilter(value);

  if (normalizado === "AL_DIA") return "Al día";
  if (normalizado === "DEBE_1_2") return "Debe 1 o 2 meses";
  if (normalizado === "DEBE_3_MAS") return "Debe 3 meses o más";

  return "Todos";
};

const CONTACTO_ESTADO_LABELS = {
  SIN_GESTION: "Sin gestión",
  CONTACTADO: "Contactado",
  PENDIENTE: "Pendiente",
  NO_CONTACTADO: "No contactó",
};

const normalizeContactoEstado = (value) => {
  const v = String(value ?? "")
    .trim()
    .toUpperCase();

  if (!v) return "SIN_GESTION";
  if (v === "VOLVER_A_LLAMAR") return "PENDIENTE";
  if (v === "TELEFONO_INVALIDO") return "NO_CONTACTADO";
  if (v === "CONTACTADO" || v === "PENDIENTE" || v === "NO_CONTACTADO" || v === "SIN_GESTION") {
    return v;
  }

  return "SIN_GESTION";
};

const formatDateDisplay = (value) => {
  const s = String(value ?? "").trim();
  if (!s) return "";
  const [yy, mm, dd] = s.split("-");
  if (yy && mm && dd) return `${dd}/${mm}/${yy}`;
  return s;
};

const getDaysDiffFromToday = (dateStr) => {
  const ts = parseDateToTs(dateStr);
  if (ts == null) return null;
  const today = new Date();
  const todayTs = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.floor((todayTs - ts) / (1000 * 60 * 60 * 24));
};

const buildContactoResumen = (fecha, estado) => {
  const fechaTxt = formatDateDisplay(fecha);
  const estadoNorm = normalizeContactoEstado(estado);
  const estadoTxt = CONTACTO_ESTADO_LABELS[estadoNorm] || "Sin gestión";

  if (fechaTxt) return `${fechaTxt} · ${estadoTxt}`;
  if (estadoNorm !== "SIN_GESTION") return estadoTxt;
  return "Sin gestión registrada";
};

const getContactoMeta = (fecha, estado) => {
  const estadoNorm = normalizeContactoEstado(estado);

  if ((!fecha || !String(fecha).trim()) && estadoNorm === "SIN_GESTION") {
    return {
      tone: "sin-gestion",
      background: "",
      border: "",
      text: "Sin gestión registrada",
      badge: "Sin gestión",
    };
  }

  if (estadoNorm === "CONTACTADO") {
    return {
      tone: "contactado",
      background: "#edf8f1",
      border: "#27ae60",
      text: "Contactado",
      badge: "Contactado",
    };
  }

  if (estadoNorm === "PENDIENTE") {
    return {
      tone: "pendiente",
      background: "#fff4e8",
      border: "#f2994a",
      text: "Pendiente",
      badge: "Pendiente",
    };
  }

  if (estadoNorm === "NO_CONTACTADO") {
    return {
      tone: "no-contactado",
      background: "#fdeeee",
      border: "#eb5757",
      text: "No contactó",
      badge: "No contactó",
    };
  }

  return {
    tone: "sin-gestion",
    background: "",
    border: "",
    text: "Sin gestión registrada",
    badge: "Sin gestión",
  };
};

const CONTACTO_FILTER_OPTIONS = [
  { id: "CONTACTADO", label: "Contactados" },
  { id: "PENDIENTE", label: "Pendientes" },
  { id: "NO_CONTACTADO", label: "No contactados" },
  { id: "SIN_GESTION", label: "Sin gestión" },
];

const normalizeContactoFiltro = (value) =>
  String(value ?? "TODOS")
    .trim()
    .toUpperCase();

const socioCumpleFiltroContacto = (socio, filtro) => {
  const valor = normalizeContactoFiltro(filtro);
  if (!valor || valor === "TODOS") return true;

  const estado = normalizeContactoEstado(socio?._ultimoContactoEstado);
  return estado === valor;
};

const getLabelContactoFiltro = (value) => {
  const normalizado = normalizeContactoFiltro(value);
  const found = CONTACTO_FILTER_OPTIONS.find((op) => op.id === normalizado);
  return found?.label || "Todos";
};

/* ============================
   BARRA SUPERIOR
============================ */
const BarraSuperior = React.memo(
  ({
    cargando,
    busquedaInput,
    setBusquedaInput,
    busquedaId,
    letraSeleccionada,
    categoriaSeleccionada,
    estadoSeleccionado,
    deudaPagoSeleccionado,
    contactoSeleccionado,
    fechaDesde,
    fechaHasta,
    setFiltros,
    filtrosRef,
    mostrarFiltros,
    setMostrarFiltros,
    categorias,
    estados,
    startTransition,
  }) => {
    const [mostrarSubmenuAlfabetico, setMostrarSubmenuAlfabetico] =
      useState(false);
    const [mostrarSubmenuCategoria, setMostrarSubmenuCategoria] =
      useState(false);
    const [mostrarSubmenuEstado, setMostrarSubmenuEstado] =
      useState(false);
    const [mostrarSubmenuDeudaPago, setMostrarSubmenuDeudaPago] =
      useState(false);
    const [mostrarSubmenuContacto, setMostrarSubmenuContacto] = useState(false);
    const [mostrarSubmenuFecha, setMostrarSubmenuFecha] = useState(false);

    const toggleSubmenu = useCallback((cual) => {
      setMostrarSubmenuAlfabetico(cual === "alfabetico" ? (v) => !v : false);
      setMostrarSubmenuCategoria(cual === "categoria" ? (v) => !v : false);
      setMostrarSubmenuEstado(cual === "estado" ? (v) => !v : false);
      setMostrarSubmenuDeudaPago(cual === "deudaPago" ? (v) => !v : false);
      setMostrarSubmenuContacto(cual === "contacto" ? (v) => !v : false);
      setMostrarSubmenuFecha(cual === "fecha" ? (v) => !v : false);
    }, []);

    const handleLetraClick = useCallback(
      (letra) => {
        startTransition(() => {
          setFiltros((prev) => ({
            ...prev,
            letraSeleccionada: letra,
            showAll: false,
          }));
        });
        setMostrarSubmenuAlfabetico(false);
        setMostrarFiltros(false);
      },
      [setFiltros, setMostrarFiltros, startTransition]
    );

    const handleCategoriaClick = useCallback(
      (value) => {
        startTransition(() => {
          setFiltros((prev) => ({
            ...prev,
            categoriaSeleccionada: value,
            showAll: false,
          }));
        });
        setMostrarSubmenuCategoria(false);
        setMostrarFiltros(false);
      },
      [setFiltros, setMostrarFiltros, startTransition]
    );

    const handleEstadoClick = useCallback(
      (value) => {
        startTransition(() => {
          setFiltros((prev) => ({
            ...prev,
            estadoSeleccionado: value,
            showAll: false,
          }));
        });
        setMostrarSubmenuEstado(false);
        setMostrarFiltros(false);
      },
      [setFiltros, setMostrarFiltros, startTransition]
    );

    const handleDeudaPagoClick = useCallback(
      (value) => {
        startTransition(() => {
          setFiltros((prev) => ({
            ...prev,
            deudaPagoSeleccionado: value,
            showAll: false,
          }));
        });
        setMostrarSubmenuDeudaPago(false);
        setMostrarFiltros(false);
      },
      [setFiltros, setMostrarFiltros, startTransition]
    );

    const handleContactoClick = useCallback(
      (value) => {
        startTransition(() => {
          setFiltros((prev) => ({
            ...prev,
            contactoSeleccionado: value,
            showAll: false,
          }));
        });
        setMostrarSubmenuContacto(false);
        setMostrarFiltros(false);
      },
      [setFiltros, setMostrarFiltros, startTransition]
    );

    const handleMostrarTodos = useCallback(() => {
      startTransition(() => {
        setFiltros((prev) => ({
          ...prev,
          busqueda: "",
          busquedaId: "",
          letraSeleccionada: "TODOS",
          categoriaSeleccionada: "OPCIONES",
          estadoSeleccionado: "TODOS",
          deudaPagoSeleccionado: "TODOS",
          contactoSeleccionado: "TODOS",
          fechaDesde: "",
          fechaHasta: "",
          showAll: true,
        }));
        setBusquedaInput("");
      });
      setMostrarSubmenuAlfabetico(false);
      setMostrarSubmenuCategoria(false);
      setMostrarSubmenuEstado(false);
      setMostrarSubmenuDeudaPago(false);
      setMostrarSubmenuContacto(false);
      setMostrarSubmenuFecha(false);
      setMostrarFiltros(false);
    }, [setFiltros, setMostrarFiltros, setBusquedaInput, startTransition]);

    const openPickerOnEvent = useCallback((e) => {
      try {
        e.target.showPicker?.();
      } catch {}
    }, []);

    return (
      <div className="soc-barra-superior">
        <div className="soc-titulo-container">
          <h2 className="soc-titulo">Gestión de Socios</h2>
        </div>

        <div className="soc-buscadores-container">
          {/* Buscador por nombre */}
          <div className="soc-buscador-container">
            <input
              type="text"
              placeholder="Buscar por nombre..."
              value={busquedaInput}
              onChange={(e) => setBusquedaInput(e.target.value)}
              className="soc-buscador"
              disabled={cargando}
            />
            <div className="soc-buscador-iconos">
              {busquedaInput ? (
                <FaTimes
                  className="soc-buscador-icono"
                  onClick={() => {
                    setBusquedaInput("");
                    startTransition(() => {
                      setFiltros((prev) => ({ ...prev, busqueda: "" }));
                    });
                  }}
                />
              ) : (
                <FaSearch className="soc-buscador-icono" />
              )}
            </div>
          </div>

          {/* Buscador por ID */}
          <div className="soc-buscador-container soc-buscador-id-container">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="ID"
              value={busquedaId}
              onChange={(e) => {
                const onlyNums = e.target.value.replace(/\D/g, "");
                startTransition(() => {
                  setFiltros((prev) => ({
                    ...prev,
                    busquedaId: onlyNums,
                    showAll: false,
                  }));
                });
              }}
              className="soc-buscador soc-buscador-id"
              disabled={cargando}
              title="Buscar por ID (match exacto)"
              maxLength={10}
            />
            {busquedaId ? (
              <FaTimes
                className="soc-buscador-icono"
                onClick={() => {
                  startTransition(() => {
                    setFiltros((prev) => ({
                      ...prev,
                      busquedaId: "",
                      showAll: false,
                    }));
                  });
                }}
              />
            ) : (
              <FaSearch className="soc-buscador-icono" />
            )}
          </div>
        </div>

        {/* Filtros */}
        <div className="soc-filtros-container" ref={filtrosRef}>
          <button
            className="soc-boton-filtros soc-boton-filtros--emp"
            onClick={(e) => {
              e.stopPropagation();
              setMostrarFiltros(!mostrarFiltros);
              if (!mostrarFiltros) {
                setMostrarSubmenuAlfabetico(false);
                setMostrarSubmenuCategoria(false);
                setMostrarSubmenuEstado(false);
                setMostrarSubmenuDeudaPago(false);
                setMostrarSubmenuContacto(false);
                setMostrarSubmenuFecha(false);
              }
            }}
            disabled={cargando}
          >
            <FaFilter className="soc-icono-boton" />
            <span>Aplicar Filtros</span>
            <FaChevronDown
              className={`soc-chevron-icon ${mostrarFiltros ? "soc-rotate" : ""}`}
            />
          </button>

          {mostrarFiltros && (
            <div
              className="soc-menu-filtros soc-menu-filtros--emp"
              onClick={(e) => e.stopPropagation()}
            >
              {/* LETRAS */}
              <div
                className="soc-filtros-menu-item"
                onClick={() => toggleSubmenu("alfabetico")}
              >
                <span>Filtrar de la A a la Z</span>
                <FaChevronDown
                  className={`soc-chevron-icon ${
                    mostrarSubmenuAlfabetico ? "soc-rotate" : ""
                  }`}
                />
              </div>
              {mostrarSubmenuAlfabetico && (
                <div className="soc-filtros-submenu">
                  <div className="soc-alfabeto-filtros">
                    {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((letra) => (
                      <button
                        key={letra}
                        className={`soc-letra-filtro ${
                          letraSeleccionada === letra ? "active" : ""
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLetraClick(letra);
                        }}
                        title={`Filtrar por ${letra}`}
                      >
                        {letra}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* CATEGORÍAS */}
              <div
                className="soc-filtros-menu-item"
                onClick={() => toggleSubmenu("categoria")}
              >
                <span>Tipo de sangre</span>
                <FaChevronDown
                  className={`soc-chevron-icon ${
                    mostrarSubmenuCategoria ? "soc-rotate" : ""
                  }`}
                />
              </div>
              {mostrarSubmenuCategoria && (
                <div className="soc-filtros-submenu">
                  <div className="soc-submenu-lista">
                    {categorias.map((cat) => {
                      const active =
                        String(categoriaSeleccionada) === String(cat.id);
                      return (
                        <div
                          key={cat.id}
                          className={`soc-filtros-submenu-item ${
                            active ? "active" : ""
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCategoriaClick(String(cat.id));
                          }}
                          title={`Filtrar por ${cat.descripcion}`}
                        >
                          {cat.descripcion}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ESTADO */}
              <div
                className="soc-filtros-menu-item"
                onClick={() => toggleSubmenu("estado")}
              >
                <span>Estado</span>
                <FaChevronDown
                  className={`soc-chevron-icon ${
                    mostrarSubmenuEstado ? "soc-rotate" : ""
                  }`}
                />
              </div>
              {mostrarSubmenuEstado && (
                <div className="soc-filtros-submenu">
                  <div className="soc-submenu-lista">
                    {estados.map((estado) => {
                      const estadoId = String(estado.id ?? estado.id_estado ?? "");
                      const estadoLabel = String(
                        estado.descripcion ?? estado.nombre ?? estadoId
                      );
                      const active = String(estadoSeleccionado) === estadoId;

                      return (
                        <div
                          key={estadoId}
                          className={`soc-filtros-submenu-item ${
                            active ? "active" : ""
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEstadoClick(estadoId);
                          }}
                          title={`Filtrar por ${estadoLabel}`}
                        >
                          {estadoLabel}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* DEUDAS / PAGOS */}
              <div
                className="soc-filtros-menu-item"
                onClick={() => toggleSubmenu("deudaPago")}
              >
                <span>Deudas / pagos</span>
                <FaChevronDown
                  className={`soc-chevron-icon ${
                    mostrarSubmenuDeudaPago ? "soc-rotate" : ""
                  }`}
                />
              </div>
              {mostrarSubmenuDeudaPago && (
                <div className="soc-filtros-submenu">
                  <div className="soc-submenu-lista">
                    {[
                      { id: "AL_DIA", label: "Al día" },
                      { id: "DEBE_1_2", label: "Debe 1 o 2 meses" },
                      { id: "DEBE_3_MAS", label: "Debe 3 meses o más" },
                    ].map((opcion) => {
                      const active =
                        normalizeDeudaPagoFilter(deudaPagoSeleccionado) === opcion.id;

                      return (
                        <div
                          key={opcion.id}
                          className={`soc-filtros-submenu-item ${
                            active ? "active" : ""
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeudaPagoClick(opcion.id);
                          }}
                          title={`Filtrar por ${opcion.label}`}
                        >
                          {opcion.label}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ÚLTIMO CONTACTO */}
              <div
                className="soc-filtros-menu-item"
                onClick={() => toggleSubmenu("contacto")}
              >
                <span>Último contacto</span>
                <FaChevronDown
                  className={`soc-chevron-icon ${
                    mostrarSubmenuContacto ? "soc-rotate" : ""
                  }`}
                />
              </div>
              {mostrarSubmenuContacto && (
                <div className="soc-filtros-submenu">
                  <div className="soc-submenu-lista">
                    {CONTACTO_FILTER_OPTIONS.map((opcion) => {
                      const active =
                        normalizeContactoFiltro(contactoSeleccionado) === opcion.id;

                      return (
                        <div
                          key={opcion.id}
                          className={`soc-filtros-submenu-item ${
                            active ? "active" : ""
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleContactoClick(opcion.id);
                          }}
                          title={`Filtrar por ${opcion.label}`}
                        >
                          {opcion.label}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* FECHA DE INGRESO */}
              <div
                className="soc-filtros-menu-item"
                onClick={() => toggleSubmenu("fecha")}
              >
                <span>Fecha de ingreso</span>
                <FaChevronDown
                  className={`soc-chevron-icon ${
                    mostrarSubmenuFecha ? "soc-rotate" : ""
                  }`}
                />
              </div>
              {mostrarSubmenuFecha && (
                <div className="soc-filtros-submenu">
                  <div className="soc-fecha-rango">
                    <div className="soc-fecha-field">
                      <FaCalendarAlt className="soc-fecha-icon" />
                      <label>Desde</label>
                      <input
                        type="date"
                        value={fechaDesde || ""}
                        onClick={openPickerOnEvent}
                        onFocus={openPickerOnEvent}
                        onChange={(e) => {
                          const val = e.target.value;
                          startTransition(() => {
                            setFiltros((prev) => ({
                              ...prev,
                              fechaDesde: val,
                              showAll: false,
                            }));
                          });
                        }}
                      />
                    </div>
                    <div className="soc-fecha-field">
                      <FaCalendarAlt className="soc-fecha-icon" />
                      <label>Hasta</label>
                      <input
                        type="date"
                        value={fechaHasta || ""}
                        onClick={openPickerOnEvent}
                        onFocus={openPickerOnEvent}
                        onChange={(e) => {
                          const val = e.target.value;
                          startTransition(() => {
                            setFiltros((prev) => ({
                              ...prev,
                              fechaHasta: val,
                              showAll: false,
                            }));
                          });
                        }}
                      />
                    </div>
                    <div className="soc-fecha-actions">
                      <button
                        className="soc-fecha-btn limpiar"
                        onClick={() => {
                          startTransition(() => {
                            setFiltros((prev) => ({
                              ...prev,
                              fechaDesde: "",
                              fechaHasta: "",
                              showAll: false,
                            }));
                          });
                        }}
                      >
                        Limpiar
                      </button>
                      <button
                        className="soc-fecha-btn aplicar"
                        onClick={() => {
                          setMostrarSubmenuFecha(false);
                          setMostrarFiltros(false);
                        }}
                      >
                        Aplicar
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div
                className="soc-filtros-menu-item soc-filtros-menu-item__mostrar-todas"
                onClick={(e) => {
                  e.stopPropagation();
                  handleMostrarTodos();
                }}
              >
                <span>Mostrar Todos</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
);

/* ============================
           COMPONENTE
============================ */
const Socios = () => {
  const [socios, setSocios] = useState([]);

  const usuario = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("usuario"));
    } catch {
      return null;
    }
  }, []);
  const rol = (usuario?.rol || "vista").toLowerCase();
  const isAdmin = rol === "admin";

  const [categorias, setCategorias] = useState([]);
  const [cobradores, setCobradores] = useState([]);
  const [estados, setEstados] = useState([]);

  const [cargando, setCargando] = useState(false);
  const [socioSeleccionado, setSocioSeleccionado] = useState(null);
  const [mostrarModalEliminar, setMostrarModalEliminar] = useState(false);
  const [socioAEliminar, setSocioAEliminar] = useState(null);
  const [mostrarModalInfo, setMostrarModalInfo] = useState(false);
  const [socioInfo, setSocioInfo] = useState(null);
  const [mostrarModalDarBaja, setMostrarModalDarBaja] = useState(false);
  const [socioDarBaja, setSocioDarBaja] = useState(null);
  const [mostrarModalContacto, setMostrarModalContacto] = useState(false);
  const [socioContacto, setSocioContacto] = useState(null);
  const [guardandoContacto, setGuardandoContacto] = useState(false);
  const [mostrarModalHistorialContacto, setMostrarModalHistorialContacto] = useState(false);
  const [socioHistorialContacto, setSocioHistorialContacto] = useState(null);
  const [historialContactos, setHistorialContactos] = useState([]);
  const [cargandoHistorialContactos, setCargandoHistorialContactos] = useState(false);
  const [cumple18Pendientes, setCumple18Pendientes] = useState([]);
  const [socioCumple18EnfocadoId, setSocioCumple18EnfocadoId] = useState(null);
  const [mostrarFiltros, setMostrarFiltros] = useState(false);

  const cumple18Actual = cumple18Pendientes[0] || null;
  const socioCumple18Alerta = cumple18Actual?.socio || null;
  const cumple18InfoAlerta = cumple18Actual?.info || null;

  const [animacionActiva, setAnimacionActiva] = useState(false);
  const [tablaVersion, setTablaVersion] = useState(0);
  const [needsRefresh, setNeedsRefresh] = useState(false);

  const filtrosRef = useRef(null);
  const listRef = useRef(null);
  const lastScrollOffsetRef = useRef(0);

  const [initialScrollOffset, setInitialScrollOffset] = useState(() => {
    try {
      const raw = sessionStorage.getItem(SS_KEYS.SCROLL);
      const n = Number(raw || "0");
      return Number.isFinite(n) && n >= 0 ? n : 0;
    } catch {
      return 0;
    }
  });

  const navigate = useNavigate();
  const location = useLocation();
  const [isPending, startTransition] = useTransition();

  const [toast, setToast] = useState({
    mostrar: false,
    tipo: "",
    mensaje: "",
  });

  const [filtros, setFiltros] = useState(() => {
    try {
      const saved = localStorage.getItem(LS_FILTERS);
      return saved
        ? JSON.parse(saved)
        : {
            busqueda: "",
            busquedaId: "",
            letraSeleccionada: "TODOS",
            categoriaSeleccionada: "OPCIONES",
            estadoSeleccionado: "TODOS",
            deudaPagoSeleccionado: "TODOS",
            contactoSeleccionado: "TODOS",
            fechaDesde: "",
            fechaHasta: "",
            showAll: false,
          };
    } catch {
      return {
        busqueda: "",
        busquedaId: "",
        letraSeleccionada: "TODOS",
        categoriaSeleccionada: "OPCIONES",
        estadoSeleccionado: "TODOS",
        deudaPagoSeleccionado: "TODOS",
        contactoSeleccionado: "TODOS",
        fechaDesde: "",
        fechaHasta: "",
        showAll: false,
      };
    }
  });
  const {
    busqueda,
    busquedaId,
    letraSeleccionada,
    categoriaSeleccionada,
    estadoSeleccionado,
    deudaPagoSeleccionado,
    contactoSeleccionado,
    fechaDesde,
    fechaHasta,
    showAll,
  } = filtros;

  const [busquedaInput, setBusquedaInput] = useState(filtros.busqueda || "");
  const deferredBusqueda = useDeferredValue(busquedaInput);

  useEffect(() => {
    const t = setTimeout(() => {
      startTransition(() => {
        setFiltros((prev) => ({
          ...prev,
          busqueda: busquedaInput || "",
          showAll:
            busquedaInput && busquedaInput.trim().length > 0
              ? false
              : prev.showAll,
        }));
      });
    }, NAME_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [busquedaInput, startTransition]);

  useEffect(() => {
    try {
      sessionStorage.setItem(SS_KEYS.FILTERS, JSON.stringify(filtros));
      localStorage.setItem(LS_FILTERS, JSON.stringify(filtros));
    } catch {}
  }, [filtros]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SS_KEYS.FILTERS);
      if (raw) {
        const parsed = JSON.parse(raw);
        setFiltros((prev) => ({ ...prev, ...parsed }));
        setBusquedaInput(parsed.busqueda || "");
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mostrarToast = useCallback((mensaje, tipo = "exito") => {
    setToast({ mostrar: true, tipo, mensaje });
  }, []);

  const idxById = useMemo(() => {
    const m = new Map();
    for (const s of socios) m.set(String(s._idStr), s);
    return m;
  }, [socios]);

  const activeFilters = useMemo(
    () => ({
      byId: !!busquedaId,
      bySearch: !!(deferredBusqueda && deferredBusqueda.trim()),
      byLetter: letraSeleccionada && letraSeleccionada !== "TODOS",
      byCategory:
        categoriaSeleccionada && categoriaSeleccionada !== "OPCIONES",
      byState: estadoSeleccionado && estadoSeleccionado !== "TODOS",
      byDebtPayment:
        deudaPagoSeleccionado &&
        normalizeDeudaPagoFilter(deudaPagoSeleccionado) !== "TODOS",
      byContact:
        contactoSeleccionado &&
        normalizeContactoFiltro(contactoSeleccionado) !== "TODOS",
      byDate: !!(fechaDesde || fechaHasta),
    }),
    [
      busquedaId,
      deferredBusqueda,
      letraSeleccionada,
      categoriaSeleccionada,
      estadoSeleccionado,
      deudaPagoSeleccionado,
      contactoSeleccionado,
      fechaDesde,
      fechaHasta,
    ]
  );

  const activeFiltersCount = useMemo(
    () => Object.values(activeFilters).filter(Boolean).length,
    [activeFilters]
  );

  const sociosFiltrados = useMemo(() => {
    let arr = socios.filter((s) => s._isActive);

    if (showAll) return arr;

    if (activeFilters.byId) {
      const found = idxById.get(String(busquedaId));
      arr = found && found._isActive ? [found] : [];
      if (arr.length === 0) return arr;
    }

    if (activeFilters.byLetter) {
      arr = arr.filter((s) => s._first === letraSeleccionada);
    }

    if (activeFilters.byCategory) {
      arr = arr.filter(
        (s) => String(s.id_categoria) === String(categoriaSeleccionada)
      );
    }

    if (activeFilters.byState) {
      arr = arr.filter(
        (s) => String(s.id_estado) === String(estadoSeleccionado)
      );
    }

    if (activeFilters.byDebtPayment) {
      arr = arr.filter((s) =>
        socioCumpleFiltroDeudaPago(s, deudaPagoSeleccionado)
      );
    }

    if (activeFilters.byContact) {
      arr = arr.filter((s) =>
        socioCumpleFiltroContacto(s, contactoSeleccionado)
      );
    }

    if (activeFilters.bySearch) {
      const q = deferredBusqueda.toLowerCase();
      arr = arr.filter((s) => s._name.includes(q));
    }

    if (activeFilters.byDate) {
      const tsDesde = parseDateToTs(fechaDesde);
      const tsHastaRaw = parseDateToTs(fechaHasta);
      const tsHasta =
        tsHastaRaw != null ? tsHastaRaw + 24 * 60 * 60 * 1000 : null;
      arr = arr.filter((s) => {
        const t = s._ingresoTs;
        if (t == null) return false;
        if (tsDesde != null && t < tsDesde) return false;
        if (tsHasta != null && t >= tsHasta) return false;
        return true;
      });
    }

    if (activeFiltersCount === 0) return [];
    return arr;
  }, [
    socios,
    idxById,
    activeFilters,
    activeFiltersCount,
    busquedaId,
    letraSeleccionada,
    categoriaSeleccionada,
    estadoSeleccionado,
    deudaPagoSeleccionado,
    contactoSeleccionado,
    deferredBusqueda,
    showAll,
    fechaDesde,
    fechaHasta,
  ]);

  const allowCascade = sociosFiltrados.length <= CASCADE_DISABLE_ABOVE;
  const triggerCascade = useCallback(
    (duration = 360) => {
      if (!allowCascade) return;
      setAnimacionActiva(true);
      setTablaVersion((v) => v + 1);
      const t = setTimeout(() => setAnimacionActiva(false), duration);
      return () => clearTimeout(t);
    },
    [allowCascade]
  );

  const lastCountRef = useRef(0);
  useEffect(() => {
    if (lastCountRef.current !== sociosFiltrados.length) {
      lastCountRef.current = sociosFiltrados.length;
      requestAnimationFrame(() => triggerCascade(320));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sociosFiltrados.length]);

  useEffect(() => {
    const handleClickOutsideFiltros = (event) => {
      if (filtrosRef.current && !filtrosRef.current.contains(event.target)) {
        setMostrarFiltros(false);
      }
    };
    const handleClickOutsideTable = (event) => {
      if (!event.target.closest(".soc-tabla-fila")) {
        setSocioSeleccionado(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutsideFiltros);
    document.addEventListener("click", handleClickOutsideTable);
    return () => {
      document.removeEventListener("mousedown", handleClickOutsideFiltros);
      document.removeEventListener("click", handleClickOutsideTable);
    };
  }, []);

  const restorePendingRef = useRef(false);
  const restoredOnceRef = useRef(false);

  const applyScrollSmart = useCallback((idx, offset) => {
    let tries = 0;
    const maxTries = 8;

    const tick = () => {
      tries++;
      const list = listRef.current;
      if (!list) {
        if (tries < maxTries) requestAnimationFrame(tick);
        return;
      }

      if (Number.isFinite(idx) && idx >= 0) {
        try {
          list.scrollToItem(idx, "smart");
          return;
        } catch {}
      }

      if (Number.isFinite(offset) && offset >= 0) {
        try {
          list.scrollTo(offset);
          return;
        } catch {}
      }
    };

    requestAnimationFrame(tick);
  }, []);

  const goEditar = useCallback(
    (socio) => {
      try {
        const currentOffset = Number(lastScrollOffsetRef.current || 0);

        sessionStorage.setItem(SS_KEYS.SEL_ID, String(socio.id_socio));
        sessionStorage.setItem(SS_KEYS.SCROLL, String(currentOffset));
        sessionStorage.setItem(SS_KEYS.TS, String(Date.now()));
        sessionStorage.setItem(SS_KEYS.FILTERS, JSON.stringify(filtros));
        sessionStorage.setItem(
          `socio_prefetch_${socio.id_socio}`,
          JSON.stringify(socio)
        );
      } catch {}

      navigate(`/socios/editar/${socio.id_socio}`, {
        state: { refresh: true, socio },
      });
    },
    [navigate, filtros]
  );

  const locationRef = useRef(location);
  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  useEffect(() => {
    const state = locationRef.current.state;
    if (state && state.refresh) {
      setNeedsRefresh(true);
      restorePendingRef.current = true;
      restoredOnceRef.current = false;

      navigate(locationRef.current.pathname, {
        replace: true,
        state: {},
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAbortRef = useRef({ socios: null, listas: null });

  const cargarDatos = useCallback(async () => {
    const t0 = performance.now();
    try {
      setCargando(true);

      fetchAbortRef.current.socios?.abort?.();
      fetchAbortRef.current.listas?.abort?.();

      const ctrlSoc = new AbortController();
      fetchAbortRef.current.socios = ctrlSoc;

      const rSoc = await fetch(`${BASE_URL}/api.php?action=socios`, {
        signal: ctrlSoc.signal,
        cache: "no-store",
      });
      const data = await rSoc.json();

      let mapEstadosPagos = new Map();
      try {
        const rPag = await fetch(
          `${BASE_URL}/api.php?action=estado_pagos_socios`,
          {
            signal: ctrlSoc.signal,
            cache: "no-store",
          }
        );
        const dataPag = await rPag.json();

        if (dataPag?.exito && Array.isArray(dataPag.estados)) {
          for (const row of dataPag.estados) {
            const id = String(row.id_socio);
            const deuda = Number(row.deuda_periodos ?? row.deuda_meses ?? 0);
            const estado = String(row.estado_pago ?? "").toUpperCase();
            mapEstadosPagos.set(id, { deuda, estado });
          }
        }
      } catch (err) {
        console.error("Error obteniendo estado_pagos_socios", err);
      }

      if (data?.exito) {
        const enriched = (data.socios || []).map((s) => {
          const _idStr = String(s?.id_socio ?? s?.id ?? "").trim();
          const _name = String(s?.nombre ?? "").toLowerCase();
          const _first = getFirstLetter(s?.nombre);
          const _dom = buildAddress(s?.domicilio, s?.numero);
          const _isActive = Number(s?.activo) === 1;
          const _estadoNum = Number(s?.id_estado ?? 0);
          const ingresoStr = s?.ingreso ? String(s.ingreso) : "";
          const _ingresoTs = parseDateToTs(ingresoStr);

          let _deudaMeses = 0;
          let _estadoPago = "al-dia";

          const info = mapEstadosPagos.get(String(s.id_socio));
          if (info) {
            _deudaMeses = Number(info.deuda) || 0;

            if (info.estado === "DEBE_1_2") _estadoPago = "debe-1-2";
            else if (info.estado === "DEBE_3_MAS") _estadoPago = "debe-3+";
            else _estadoPago = "al-dia";
          } else {
            const d = getDeudaMesesFromSocio(s);
            _deudaMeses = d;
            _estadoPago = getEstadoPago(d);
          }

          const _ultimoContactoFechaReal = s?.ultimo_contacto_fecha
            ? String(s.ultimo_contacto_fecha).slice(0, 10)
            : "";

          const _contactoEsDelAnioActual = isDateInCurrentYear(_ultimoContactoFechaReal);
          const _ultimoContactoFecha = _contactoEsDelAnioActual ? _ultimoContactoFechaReal : "";
          const _ultimoContactoEstado = _contactoEsDelAnioActual
            ? normalizeContactoEstado(s?.ultimo_contacto_estado)
            : "SIN_GESTION";
          const _ultimoContactoNota = _contactoEsDelAnioActual
            ? String(s?.ultimo_contacto ?? "").trim()
            : "";
          const _contactoMeta = getContactoMeta(
            _ultimoContactoFecha,
            _ultimoContactoEstado
          );
          const _ultimoContactoResumen = buildContactoResumen(
            _ultimoContactoFecha,
            _ultimoContactoEstado
          );

          return {
            ...s,
            _idStr,
            _name,
            _first,
            _dom,
            _isActive,
            _estadoNum,
            _ingresoTs,
            _deudaMeses,
            _estadoPago,
            _ultimoContactoFechaReal,
            _ultimoContactoFecha,
            _ultimoContactoEstado,
            _ultimoContactoNota,
            _contactoMeta,
            _ultimoContactoResumen,
          };
        });
        setSocios(enriched);
      } else {
        mostrarToast(
          `Error al obtener socios: ${data?.mensaje ?? "desconocido"}`,
          "error"
        );
        setSocios([]);
      }

      try {
        const ctrlLis = new AbortController();
        fetchAbortRef.current.listas = ctrlLis;

        const rLis = await fetch(`${BASE_URL}/api.php?action=listas`, {
          signal: ctrlLis.signal,
          cache: "force-cache",
        });
        const dataListas = await rLis.json();

        if (dataListas?.exito && dataListas?.listas) {
          const ls = dataListas.listas;
          setCategorias(Array.isArray(ls.categorias) ? ls.categorias : []);
          setCobradores(Array.isArray(ls.cobradores) ? ls.cobradores : []);
          setEstados(Array.isArray(ls.estados) ? ls.estados : []);
        } else {
          setCategorias([]);
          setCobradores([]);
          setEstados([]);
        }
      } catch {
        setCategorias([]);
        setCobradores([]);
        setEstados([]);
      }

      const elapsed = performance.now() - t0;
      const waitMore = Math.max(0, MIN_SPINNER_MS - elapsed);
      setTimeout(() => {
        setCargando(false);
        triggerCascade(360);
      }, waitMore);
    } catch (error) {
      if (error?.name !== "AbortError") {
        mostrarToast("Error de red al obtener datos", "error");
        setSocios([]);
        setCategorias([]);
        setCobradores([]);
        setEstados([]);
        setCargando(false);
      }
    }
  }, [mostrarToast, triggerCascade]);

  useEffect(() => {
    cargarDatos();
    return () => {
      fetchAbortRef.current.socios?.abort?.();
      fetchAbortRef.current.listas?.abort?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (needsRefresh) {
      cargarDatos();
      setNeedsRefresh(false);
    }
  }, [needsRefresh, cargarDatos]);

  useEffect(() => {
    if (!Array.isArray(socios) || socios.length === 0) {
      setCumple18Pendientes([]);
      setSocioCumple18EnfocadoId(null);
      return;
    }

    const cerrados = readJsonLocalStorage(LS_CUMPLE_18_CERRADOS, {});
    const today = getLocalToday();

    const pendientes = socios
      .filter((s) => s?._isActive)
      .map((s) => ({ socio: s, info: getCumple18Info(s.nacimiento, today) }))
      .filter((item) => {
        if (!item.info) return false;
        const key = getCumple18DismissKey(item.socio, item.info);
        return !cerrados[key];
      })
      .sort((a, b) => {
        const edadA = Number(a.info?.edad ?? 0);
        const edadB = Number(b.info?.edad ?? 0);
        if (edadA !== edadB) return edadB - edadA;
        return String(a.socio?.nombre ?? "").localeCompare(String(b.socio?.nombre ?? ""));
      });

    setCumple18Pendientes(pendientes);

    if (pendientes.length === 0) {
      setSocioCumple18EnfocadoId(null);
    }
  }, [socios]);

  useEffect(() => {
    if (!restorePendingRef.current) return;
    if (restoredOnceRef.current) return;
    if (cargando) return;

    try {
      const rawFilters = sessionStorage.getItem(SS_KEYS.FILTERS);
      if (rawFilters) {
        const parsed = JSON.parse(rawFilters);
        setFiltros((prev) => ({ ...prev, ...parsed }));
        setBusquedaInput(parsed.busqueda || "");
      }

      const selId = sessionStorage.getItem(SS_KEYS.SEL_ID);
      const savedOffsetRaw = sessionStorage.getItem(SS_KEYS.SCROLL);
      const savedOffset = Number(savedOffsetRaw || "0");
      const safeOffset =
        Number.isFinite(savedOffset) && savedOffset >= 0 ? savedOffset : 0;

      setInitialScrollOffset(safeOffset);

      const parsed = rawFilters ? JSON.parse(rawFilters) : filtros;

      const currentList = (() => {
        let arr = socios.filter((s) => s._isActive);

        if (parsed.showAll) return arr;

        if (parsed.busquedaId) {
          const found = arr.find(
            (s) => String(s.id_socio) === String(parsed.busquedaId)
          );
          arr = found ? [found] : [];
        }
        if (parsed.letraSeleccionada && parsed.letraSeleccionada !== "TODOS") {
          arr = arr.filter((s) => s._first === parsed.letraSeleccionada);
        }
        if (
          parsed.categoriaSeleccionada &&
          parsed.categoriaSeleccionada !== "OPCIONES"
        ) {
          arr = arr.filter(
            (s) =>
              String(s.id_categoria) === String(parsed.categoriaSeleccionada)
          );
        }
        if (
          parsed.estadoSeleccionado &&
          parsed.estadoSeleccionado !== "TODOS"
        ) {
          arr = arr.filter(
            (s) => String(s.id_estado) === String(parsed.estadoSeleccionado)
          );
        }
        if (
          parsed.deudaPagoSeleccionado &&
          normalizeDeudaPagoFilter(parsed.deudaPagoSeleccionado) !== "TODOS"
        ) {
          arr = arr.filter((s) =>
            socioCumpleFiltroDeudaPago(s, parsed.deudaPagoSeleccionado)
          );
        }
        if (
          parsed.contactoSeleccionado &&
          normalizeContactoFiltro(parsed.contactoSeleccionado) !== "TODOS"
        ) {
          arr = arr.filter((s) =>
            socioCumpleFiltroContacto(s, parsed.contactoSeleccionado)
          );
        }
        if (parsed.busqueda) {
          const q = String(parsed.busqueda).toLowerCase();
          arr = arr.filter((s) => s._name.includes(q));
        }
        if (parsed.fechaDesde || parsed.fechaHasta) {
          const tsDesde = parseDateToTs(parsed.fechaDesde);
          const tsHastaRaw = parseDateToTs(parsed.fechaHasta);
          const tsHasta =
            tsHastaRaw != null ? tsHastaRaw + 24 * 60 * 60 * 1000 : null;
          arr = arr.filter((s) => {
            const t = s._ingresoTs;
            if (t == null) return false;
            if (tsDesde != null && t < tsDesde) return false;
            if (tsHasta != null && t >= tsHasta) return false;
            return true;
          });
        }
        return arr;
      })();

      if (selId) {
        const idx = currentList.findIndex(
          (s) => String(s.id_socio) === String(selId)
        );
        if (idx >= 0) {
          setSocioSeleccionado(currentList[idx]);
          applyScrollSmart(idx, safeOffset);
        } else {
          applyScrollSmart(-1, safeOffset);
        }
      } else {
        applyScrollSmart(-1, safeOffset);
      }

      restoredOnceRef.current = true;
      restorePendingRef.current = false;

      sessionStorage.removeItem(SS_KEYS.SEL_ID);
      sessionStorage.removeItem(SS_KEYS.TS);
    } catch {
      restoredOnceRef.current = true;
      restorePendingRef.current = false;
    }
  }, [cargando, socios, filtros, applyScrollSmart]);

  const mapCategorias = useMemo(() => {
    const m = new Map();
    for (const c of categorias)
      m.set(
        String(c.id ?? c.id_categoria ?? ""),
        String(c.descripcion ?? c.nombre ?? "")
      );
    return m;
  }, [categorias]);

  const mapCobradores = useMemo(() => {
    const m = new Map();
    for (const c of cobradores)
      m.set(String(c.id ?? c.id_cobrador ?? ""), String(c.nombre ?? ""));
    return m;
  }, [cobradores]);

  const mapEstados = useMemo(() => {
    const m = new Map();
    for (const e of estados)
      m.set(
        String(e.id ?? e.id_estado ?? ""),
        String(e.descripcion ?? e.nombre ?? "")
      );
    return m;
  }, [estados]);

  const manejarSeleccion = useCallback((socio) => {
    setSocioSeleccionado((prev) => (prev?._idStr !== socio._idStr ? socio : null));
  }, []);

  const enfocarSocioEnTabla = useCallback(
    (socio) => {
      if (!socio?.id_socio) return;

      setBusquedaInput("");
      startTransition(() => {
        setFiltros({
          busqueda: "",
          busquedaId: "",
          letraSeleccionada: "TODOS",
          categoriaSeleccionada: "OPCIONES",
          estadoSeleccionado: "TODOS",
          deudaPagoSeleccionado: "TODOS",
          contactoSeleccionado: "TODOS",
          fechaDesde: "",
          fechaHasta: "",
          showAll: true,
        });
      });

      const idBuscado = String(socio.id_socio);
      setSocioCumple18EnfocadoId(idBuscado);

      setTimeout(() => {
        const activos = socios.filter((s) => s._isActive);
        const idx = activos.findIndex((s) => String(s.id_socio) === idBuscado);
        const socioFinal = activos[idx] || socio;

        setSocioSeleccionado(socioFinal);

        if (idx >= 0) {
          try {
            listRef.current?.scrollToItem?.(idx, "center");
          } catch {}
        }
      }, 120);
    },
    [socios, setFiltros, startTransition]
  );

  const mostrarCumpleAnterior = useCallback(() => {
    setCumple18Pendientes((prev) => {
      if (!Array.isArray(prev) || prev.length <= 1) return prev;
      const copia = [...prev];
      const ultimo = copia.pop();
      return [ultimo, ...copia];
    });
  }, []);

  const mostrarCumpleSiguiente = useCallback(() => {
    setCumple18Pendientes((prev) => {
      if (!Array.isArray(prev) || prev.length <= 1) return prev;
      const [primero, ...resto] = prev;
      return [...resto, primero];
    });
  }, []);

  const cerrarAlertaCumple18 = useCallback(() => {
    if (!socioCumple18Alerta || !cumple18InfoAlerta) return;

    const cerrados = readJsonLocalStorage(LS_CUMPLE_18_CERRADOS, {});
    const key = getCumple18DismissKey(socioCumple18Alerta, cumple18InfoAlerta);

    cerrados[key] = {
      id_socio: socioCumple18Alerta.id_socio,
      nombre: socioCumple18Alerta.nombre || "",
      cerrado_en: new Date().toISOString(),
    };

    writeJsonLocalStorage(LS_CUMPLE_18_CERRADOS, cerrados);

    setCumple18Pendientes((prev) => prev.slice(1));

    if (String(socioCumple18EnfocadoId || "") === String(socioCumple18Alerta.id_socio || "")) {
      setSocioCumple18EnfocadoId(null);
    }
  }, [socioCumple18Alerta, cumple18InfoAlerta, socioCumple18EnfocadoId]);

  const eliminarSocio = useCallback(
    async (id) => {
      try {
        const response = await fetch(`${BASE_URL}/api.php?action=eliminar_socio`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id_socio: id }),
        });
        const data = await response.json();
        if (data.exito) {
          setSocios((prev) => prev.filter((s) => s.id_socio !== id));
          mostrarToast("Socio eliminado correctamente");
          triggerCascade(300);
        } else {
          mostrarToast(`Error al eliminar: ${data.mensaje}`, "error");
        }
      } catch {
        mostrarToast("Error de red al intentar eliminar", "error");
      } finally {
        setMostrarModalEliminar(false);
        setSocioAEliminar(null);
      }
    },
    [mostrarToast, triggerCascade]
  );

  const darDeBajaSocio = useCallback(
    async (id, motivo) => {
      try {
        const response = await fetch(`${BASE_URL}/api.php?action=dar_baja_socio`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id_socio: id, motivo }),
        });
        const data = await response.json();
        if (data.exito) {
          setSocios((prev) => prev.filter((s) => s.id_socio !== id));
          mostrarToast("Socio dado de baja correctamente");
          triggerCascade(300);
        } else {
          mostrarToast(`Error: ${data.mensaje}`, "error");
        }
      } catch {
        mostrarToast("Error de red al intentar dar de baja", "error");
      } finally {
        setMostrarModalDarBaja(false);
        setSocioDarBaja(null);
      }
    },
    [mostrarToast, triggerCascade]
  );

  const guardarContactoSocio = useCallback(
    async (payload) => {
      if (!socioContacto?.id_socio) return;

      setGuardandoContacto(true);
      try {
        const response = await fetch(
          `${BASE_URL}/api.php?action=actualizar_contacto_socio`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id_socio: socioContacto.id_socio,
              ultimo_contacto_fecha: payload.ultimo_contacto_fecha,
              ultimo_contacto_estado: payload.ultimo_contacto_estado,
              ultimo_contacto: payload.ultimo_contacto,
            }),
          }
        );

        const data = await response.json();

        if (!data?.exito) {
          mostrarToast(data?.mensaje || "No se pudo guardar el contacto", "error");
          return;
        }

        const row = data?.socio || {
          id_socio: socioContacto.id_socio,
          ultimo_contacto_fecha: payload.ultimo_contacto_fecha,
          ultimo_contacto_estado: payload.ultimo_contacto_estado,
          ultimo_contacto: payload.ultimo_contacto,
        };

        const patch = {
          ultimo_contacto_fecha:
            row.ultimo_contacto_fecha || payload.ultimo_contacto_fecha || "",
          ultimo_contacto_estado: normalizeContactoEstado(
            row.ultimo_contacto_estado || payload.ultimo_contacto_estado
          ),
          ultimo_contacto: row.ultimo_contacto ?? payload.ultimo_contacto ?? "",
        };

        patch._ultimoContactoFecha = patch.ultimo_contacto_fecha;
        patch._ultimoContactoEstado = patch.ultimo_contacto_estado;
        patch._ultimoContactoNota = String(patch.ultimo_contacto || "").trim();
        patch._contactoMeta = getContactoMeta(
          patch._ultimoContactoFecha,
          patch._ultimoContactoEstado
        );
        patch._ultimoContactoResumen = buildContactoResumen(
          patch._ultimoContactoFecha,
          patch._ultimoContactoEstado
        );

        setSocios((prev) =>
          prev.map((s) =>
            String(s.id_socio) === String(socioContacto.id_socio) ? { ...s, ...patch } : s
          )
        );

        setSocioSeleccionado((prev) =>
          prev && String(prev.id_socio) === String(socioContacto.id_socio)
            ? { ...prev, ...patch }
            : prev
        );

        setSocioInfo((prev) =>
          prev && String(prev.id_socio) === String(socioContacto.id_socio)
            ? { ...prev, ...patch }
            : prev
        );

        setSocioContacto((prev) =>
          prev && String(prev.id_socio) === String(socioContacto.id_socio)
            ? { ...prev, ...patch }
            : prev
        );

        if (
          mostrarModalHistorialContacto &&
          socioHistorialContacto &&
          String(socioHistorialContacto.id_socio) === String(socioContacto.id_socio)
        ) {
          const nuevoRegistro = data?.contacto || {
            id_contacto: data?.socio?.id_ultimo_contacto || Date.now(),
            id_socio: socioContacto.id_socio,
            fecha_contacto: patch._ultimoContactoFecha,
            estado_contacto: patch._ultimoContactoEstado,
            detalle_contacto: patch._ultimoContactoNota,
            created_at: new Date().toISOString().slice(0, 19).replace("T", " "),
          };

          setHistorialContactos((prev) => [
            nuevoRegistro,
            ...prev.filter((item) => String(item.id_contacto) !== String(nuevoRegistro.id_contacto)),
          ]);
        }

        mostrarToast("Último contacto guardado correctamente");
        setMostrarModalContacto(false);
        setSocioContacto(null);
      } catch {
        mostrarToast("Error de red al guardar el último contacto", "error");
      } finally {
        setGuardandoContacto(false);
      }
    },
    [
      mostrarToast,
      socioContacto,
      mostrarModalHistorialContacto,
      socioHistorialContacto,
    ]
  );

  const abrirHistorialContacto = useCallback(
    async (socioBase) => {
      if (!socioBase?.id_socio) return;

      setSocioHistorialContacto(socioBase);
      setHistorialContactos([]);
      setMostrarModalHistorialContacto(true);
      setCargandoHistorialContactos(true);

      try {
        const response = await fetch(
          `${BASE_URL}/api.php?action=obtener_historial_contactos_socio&id_socio=${encodeURIComponent(
            socioBase.id_socio
          )}`,
          { cache: "no-store" }
        );

        const data = await response.json();

        if (!data?.exito) {
          mostrarToast(data?.mensaje || "No se pudo obtener el historial", "error");
          setHistorialContactos([]);
          return;
        }

        setHistorialContactos(Array.isArray(data.historial) ? data.historial : []);
      } catch {
        mostrarToast("Error de red al obtener el historial", "error");
        setHistorialContactos([]);
      } finally {
        setCargandoHistorialContactos(false);
      }
    },
    [mostrarToast]
  );

  const exportarExcel = useCallback(() => {
    if (socios.length === 0) {
      mostrarToast("No hay socios registrados para exportar.", "error");
      return;
    }
    if (!showAll && activeFiltersCount === 0) {
      mostrarToast('Aplicá al menos un filtro o "Mostrar todos" para exportar.', "error");
      return;
    }
    if (sociosFiltrados.length === 0) {
      mostrarToast("No hay socios que coincidan con los filtros actuales.", "error");
      return;
    }

    const datos = sociosFiltrados.map((s) => {
      const catTxt = mapCategorias.get(String(s.id_categoria)) ?? s.id_categoria;
      const cobTxt = mapCobradores.get(String(s.id_cobrador)) ?? s.id_cobrador;
      const estTxt = mapEstados.get(String(s.id_estado)) ?? s.id_estado;

      return {
        ID: s.id_socio,
        Nombre: s.nombre,
        DNI: s.dni,
        Domicilio: s._dom,
        Teléfono_móvil: s.telefono_movil,
        Teléfono_fijo: s.telefono_fijo,
        Categoría: catTxt,
        Cobrador: cobTxt,
        Estado: estTxt,
        Comentario: s.comentario,
        Fecha_Nacimiento: s.nacimiento,
        Ingreso: s.ingreso,
        Activo: s.activo,
        Estado_pago: getLabelDeudaPago(
          s._estadoPago === "al-dia"
            ? "AL_DIA"
            : s._estadoPago === "debe-1-2"
            ? "DEBE_1_2"
            : "DEBE_3_MAS"
        ),
        Deuda_meses: s._deudaMeses ?? 0,
        Ultimo_contacto_fecha: s._ultimoContactoFecha || "",
        Ultimo_contacto_estado:
          CONTACTO_ESTADO_LABELS[s._ultimoContactoEstado] || "Sin gestión",
        Ultimo_contacto_nota: s._ultimoContactoNota || "",
      };
    });

    const ws = XLSX.utils.json_to_sheet(datos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      ws,
      showAll ? "Socios (todos activos)" : "Socios (filtrados)"
    );

    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(blob, "Socios.xlsx");
  }, [
    socios,
    sociosFiltrados,
    showAll,
    activeFiltersCount,
    mostrarToast,
    mapCategorias,
    mapCobradores,
    mapEstados,
  ]);

  /* ============================
        FILA VIRTUALIZADA
  ============================ */
  const RowBase = ({ index, style, data }) => {
    const socio = data[index];
    const esFilaPar = (index & 1) === 0;
    const esSocioCumple18Enfocado =
      socioCumple18EnfocadoId && String(socio.id_socio) === String(socioCumple18EnfocadoId);

    const shouldAnimate = animacionActiva && index < MAX_CASCADE;
    const animationDelay = shouldAnimate ? `${index * 0.035}s` : "0s";
    const contactoMeta = socio._contactoMeta || getContactoMeta(
      socio._ultimoContactoFecha,
      socio._ultimoContactoEstado
    );

    return (
      <div
        style={{
          ...style,
          animationDelay,
          animationName: shouldAnimate ? "fadeIn" : "none",
          animationFillMode: "forwards",
          animationDuration: shouldAnimate ? ".3s" : "0s",
          opacity: shouldAnimate ? 0 : 1,
          backgroundColor: esSocioCumple18Enfocado
            ? "#eaf3ff"
            : contactoMeta.background || undefined,
          borderLeft: esSocioCumple18Enfocado
            ? "6px solid #2563eb"
            : contactoMeta.border
            ? `5px solid ${contactoMeta.border}`
            : undefined,
          boxShadow: esSocioCumple18Enfocado
            ? "inset 0 0 0 2px rgba(37, 99, 235, 0.28), 0 6px 18px rgba(37, 99, 235, 0.16)"
            : undefined,
        }}
        className={`soc-tabla-fila ${esFilaPar ? "soc-row-even" : "soc-row-odd"} ${
          socioSeleccionado?._idStr === socio._idStr ? "soc-fila-seleccionada" : ""
        } ${esSocioCumple18Enfocado ? "soc-fila-cumple18-enfocada" : ""}`}
        onClick={() => manejarSeleccion(socio)}
        title={socio._ultimoContactoResumen || "Sin gestión registrada"}
      >
        <div className="soc-col-id" data-label="ID" title={socio.id_socio}>
          {socio.id_socio}
        </div>

        <div className="soc-col-nombre" data-label="Socio" title={socio.nombre}>
          {socio.nombre}
        </div>

        <div className="soc-col-domicilio" data-label="Domicilio" title={socio._dom}>
          {socio._dom}
        </div>

        {/* ✅ COLUMNA COMENTARIO: solo muestra el comentario, sin resumen de gestión */}
        <div className="soc-col-comentario" data-label="Comentario">
          {socio.comentario ? (
            <div title={socio.comentario}>
              {socio.comentario.length > 36
                ? `${socio.comentario.substring(0, 36)}…`
                : socio.comentario}
            </div>
          ) : null}
        </div>

        <div className="soc-col-acciones">
          {socioSeleccionado?._idStr === socio._idStr && (
            <div className="soc-iconos-acciones">
              <FaInfoCircle
                title="Ver información"
                onClick={(e) => {
                  e.stopPropagation();
                  setSocioInfo(socio);
                  setMostrarModalInfo(true);
                }}
                className="soc-icono"
              />

              {isAdmin && (
                <>
                  <FaPhoneAlt
                    title="Registrar último contacto"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSocioContacto(socio);
                      setMostrarModalContacto(true);
                    }}
                    className="soc-icono"
                  />
                  <FaEdit
                    title="Editar"
                    onClick={(e) => {
                      e.stopPropagation();
                      goEditar(socio);
                    }}
                    className="soc-icono"
                  />
                  <FaTrash
                    title="Eliminar"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSocioAEliminar(socio);
                      setMostrarModalEliminar(true);
                    }}
                    className="soc-icono"
                  />
                  <FaUserMinus
                    title="Dar de baja"
                    className="soc-icono"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSocioDarBaja(socio);
                      setMostrarModalDarBaja(true);
                    }}
                  />
                </>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const Row = React.memo(RowBase, areEqual);

  const Outer = useMemo(() => {
    return React.forwardRef((props, ref) => (
      <div
        ref={ref}
        {...props}
        style={{ ...props.style, overflowX: "hidden" }}
      />
    ));
  }, []);

  const limpiarChip = useCallback(
    (tipo) => {
      setFiltros((prev) => {
        if (tipo === "busqueda") return { ...prev, busqueda: "", showAll: prev.showAll };
        if (tipo === "id") return { ...prev, busquedaId: "", showAll: false };
        if (tipo === "letra") return { ...prev, letraSeleccionada: "TODOS", showAll: false };
        if (tipo === "categoria")
          return { ...prev, categoriaSeleccionada: "OPCIONES", showAll: false };
        if (tipo === "estado")
          return { ...prev, estadoSeleccionado: "TODOS", showAll: false };
        if (tipo === "deudaPago")
          return { ...prev, deudaPagoSeleccionado: "TODOS", showAll: false };
        if (tipo === "contacto")
          return { ...prev, contactoSeleccionado: "TODOS", showAll: false };
        if (tipo === "fecha")
          return { ...prev, fechaDesde: "", fechaHasta: "", showAll: false };
        if (tipo === "showAll") return { ...prev, showAll: false };
        return prev;
      });
      if (tipo === "busqueda") setBusquedaInput("");
    },
    [setFiltros]
  );

  const chips = useMemo(() => {
    const arr = [];
    if (showAll) {
      arr.push({ key: "showAll", label: "Mostrar todos" });
      return arr;
    }
    if (busqueda && busqueda.trim()) {
      arr.push({ key: "busqueda", label: `Texto: "${busqueda.trim()}"` });
    }
    if (busquedaId) {
      arr.push({ key: "id", label: `ID: ${busquedaId}` });
    }
    if (letraSeleccionada && letraSeleccionada !== "TODOS") {
      arr.push({ key: "letra", label: `Letra: ${letraSeleccionada}` });
    }
    if (categoriaSeleccionada && categoriaSeleccionada !== "OPCIONES") {
      const found = categorias.find((c) => String(c.id) === String(categoriaSeleccionada));
      arr.push({
        key: "categoria",
        label: `Categoría: ${found ? found.descripcion : categoriaSeleccionada}`,
      });
    }
    if (estadoSeleccionado && estadoSeleccionado !== "TODOS") {
      const foundEstado = estados.find(
        (e) => String(e.id ?? e.id_estado ?? "") === String(estadoSeleccionado)
      );
      arr.push({
        key: "estado",
        label: `Estado: ${foundEstado ? (foundEstado.descripcion ?? foundEstado.nombre) : estadoSeleccionado}`,
      });
    }
    if (
      deudaPagoSeleccionado &&
      normalizeDeudaPagoFilter(deudaPagoSeleccionado) !== "TODOS"
    ) {
      arr.push({
        key: "deudaPago",
        label: `Deudas / pagos: ${getLabelDeudaPago(deudaPagoSeleccionado)}`,
      });
    }
    if (
      contactoSeleccionado &&
      normalizeContactoFiltro(contactoSeleccionado) !== "TODOS"
    ) {
      arr.push({
        key: "contacto",
        label: `Último contacto: ${getLabelContactoFiltro(contactoSeleccionado)}`,
      });
    }
    if (fechaDesde || fechaHasta) {
      const etiqueta =
        fechaDesde && fechaHasta
          ? `Ingreso: ${fechaDesde} → ${fechaHasta}`
          : fechaDesde
          ? `Ingreso: desde ${fechaDesde}`
          : `Ingreso: hasta ${fechaHasta}`;
      arr.push({ key: "fecha", label: etiqueta });
    }
    return arr;
  }, [
    showAll,
    busqueda,
    busquedaId,
    letraSeleccionada,
    categoriaSeleccionada,
    estadoSeleccionado,
    categorias,
    estados,
    deudaPagoSeleccionado,
    contactoSeleccionado,
    fechaDesde,
    fechaHasta,
  ]);

  const dynamicItemSize = useResponsiveItemSize(!!socioSeleccionado);

  return (
    <div className="soc-main-container">
      <div className="soc-container">
        {toast.mostrar && (
          <Toast
            tipo={toast.tipo}
            mensaje={toast.mensaje}
            onClose={() => setToast({ mostrar: false, tipo: "", mensaje: "" })}
            duracion={3000}
          />
        )}

        <BarraSuperior
          cargando={cargando}
          busquedaInput={busquedaInput}
          setBusquedaInput={setBusquedaInput}
          busquedaId={busquedaId}
          letraSeleccionada={letraSeleccionada}
          categoriaSeleccionada={categoriaSeleccionada}
          estadoSeleccionado={estadoSeleccionado}
          deudaPagoSeleccionado={deudaPagoSeleccionado}
          contactoSeleccionado={contactoSeleccionado}
          fechaDesde={fechaDesde}
          fechaHasta={fechaHasta}
          setFiltros={setFiltros}
          filtrosRef={filtrosRef}
          mostrarFiltros={mostrarFiltros}
          setMostrarFiltros={setMostrarFiltros}
          categorias={categorias}
          estados={estados}
          startTransition={startTransition}
        />

        <div className="soc-tabla-container">
          <div className="soc-tabla-header-container" style={{ position: "relative" }}>
            <div className="soc-header-meta">
              <div className="soc-contador">
                <FaUsers className="soc-contador-icono" size={14} />
                {showAll
                  ? "Total visibles:"
                  : activeFiltersCount === 0
                  ? "Filtrá para ver socios:"
                  : "Socios filtrados:"}
                <strong>
                  {showAll
                    ? sociosFiltrados.length
                    : activeFiltersCount === 0
                    ? 0
                    : sociosFiltrados.length}
                </strong>
              </div>

              <div className="soc-header-meta-right">
                <div className="soc-filters-island">
                  {chips.map((ch) => (
                    <div key={ch.key} className="soc-chip" title={ch.label}>
                      <span>{ch.label}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          limpiarChip(ch.key);
                        }}
                        className="soc-chip-close"
                        title="Quitar filtro"
                      >
                        <FaTimes size={10} />
                      </button>
                    </div>
                  ))}
                </div>

                {/* ✅ INDICADORES DE ÚLTIMO CONTACTO — estilo mejorado */}
                <div className="soc-contacto-legend">
                  <span className="soc-contacto-legend__title">Último contacto</span>
                  {[
                    { color: "#27ae60", colorBg: "#edf8f1", label: "Contactado" },
                    { color: "#f2994a", colorBg: "#fff4e8", label: "Pendiente" },
                    { color: "#eb5757", colorBg: "#fdeeee", label: "No contactado" },
                    { color: "#9ca3af", colorBg: "#f3f4f6", label: "Sin gestión" },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="soc-contacto-legend__item"
                      style={{ "--legend-color": item.color, "--legend-bg": item.colorBg }}
                    >
                      <span className="soc-contacto-legend__dot" />
                      <span className="soc-contacto-legend__label">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="soc-tabla-header">
              <div className="soc-col-id">ID</div>
              <div className="soc-col-nombre">Apellido y Nombre</div>
              <div className="soc-col-domicilio">Domicilio</div>
              <div className="soc-col-comentario">Comentario</div>
              <div className="soc-col-acciones">Acciones</div>
            </div>
          </div>

          <div
            className={`soc-list-container ${animacionActiva ? "soc-cascade-animation" : ""}`}
            style={{ flex: 1, overflow: "hidden", position: "relative" }}
          >
            {!showAll && activeFiltersCount === 0 ? (
              <div className="soc-boton-mostrar-container">
                <div className="soc-mensaje-inicial">Aplicá al menos un filtro para ver socios</div>
                <button
                  className="soc-boton-mostrar-todos"
                  onClick={() => {
                    setBusquedaInput("");
                    startTransition(() => {
                      setFiltros({
                        busqueda: "",
                        busquedaId: "",
                        letraSeleccionada: "TODOS",
                        categoriaSeleccionada: "OPCIONES",
                        estadoSeleccionado: "TODOS",
                        deudaPagoSeleccionado: "TODOS",
                        contactoSeleccionado: "TODOS",
                        fechaDesde: "",
                        fechaHasta: "",
                        showAll: true,
                      });
                    });
                    requestAnimationFrame(() => triggerCascade(320));
                  }}
                >
                  Mostrar todos los socios
                </button>
              </div>
            ) : cargando ? (
              <div className="soc-cargando-tabla">
                <div className="soc-spinner" />
                <p className="soc-texto-cargando">Cargando socios...</p>
              </div>
            ) : socios.length === 0 ? (
              <div className="soc-sin-resultados">No hay socios registrados</div>
            ) : sociosFiltrados.length === 0 ? (
              <div className="soc-sin-resultados">No hay resultados con los filtros actuales</div>
            ) : (
              <AutoSizer>
                {({ height, width }) => (
                  <List
                    key={`${tablaVersion}-${dynamicItemSize}`}
                    ref={listRef}
                    height={height}
                    width={width}
                    itemCount={sociosFiltrados.length}
                    itemSize={dynamicItemSize}
                    itemData={sociosFiltrados}
                    overscanCount={4}
                    outerElementType={Outer}
                    itemKey={(index, data) => data[index]._idStr}
                    initialScrollOffset={initialScrollOffset}
                    onScroll={({ scrollOffset }) => {
                      lastScrollOffsetRef.current = scrollOffset;
                      try {
                        sessionStorage.setItem(SS_KEYS.SCROLL, String(scrollOffset));
                      } catch {}
                    }}
                  >
                    {Row}
                  </List>
                )}
              </AutoSizer>
            )}
          </div>
        </div>

        <div className="soc-barra-inferior">
          <button className="soc-boton soc-boton-volver" onClick={() => navigate("/panel")}>
            <FaArrowLeft className="soc-boton-icono" /> Volver
          </button>

          <div className="soc-botones-derecha">
            {isAdmin && (
              <button
                className="soc-boton soc-boton-agregar"
                onClick={() => navigate("/socios/agregar")}
              >
                <FaUserPlus className="soc-boton-icono" /> Agregar Socio
              </button>
            )}

            <button
              className="soc-boton soc-boton-exportar"
              onClick={exportarExcel}
              disabled={
                cargando ||
                sociosFiltrados.length === 0 ||
                socios.length === 0 ||
                (!showAll && activeFiltersCount === 0)
              }
            >
              <FaFileExcel className="soc-boton-icono" /> Exportar a Excel
            </button>

            <button className="soc-boton soc-boton-baja" onClick={() => navigate("/socios/baja")}>
              <FaUserSlash className="soc-boton-icono" /> Dados de Baja
            </button>

            <button className="soc-boton soc-boton-Familia" onClick={() => navigate("/familias")}>
              <FaUsers className="soc-boton-icono" /> Familias
            </button>
          </div>
        </div>

        {ReactDOM.createPortal(
          <ModalCumple18Socio
            mostrar={Boolean(socioCumple18Alerta)}
            socio={socioCumple18Alerta}
            info={cumple18InfoAlerta}
            cantidadPendiente={cumple18Pendientes.length}
            indiceActual={cumple18Pendientes.length > 0 ? 1 : 0}
            onAnterior={mostrarCumpleAnterior}
            onSiguiente={mostrarCumpleSiguiente}
            onClose={cerrarAlertaCumple18}
            onVerSocio={() => enfocarSocioEnTabla(socioCumple18Alerta)}
          />,
          document.body
        )}

        {ReactDOM.createPortal(
          <ModalEliminarSocio
            mostrar={mostrarModalEliminar}
            socio={socioAEliminar}
            onClose={() => {
              setMostrarModalEliminar(false);
              setSocioAEliminar(null);
            }}
            onEliminar={eliminarSocio}
          />,
          document.body
        )}

        {ReactDOM.createPortal(
          <ModalInfoSocio
            mostrar={mostrarModalInfo}
            socio={socioInfo}
            onClose={() => {
              setMostrarModalInfo(false);
              setSocioInfo(null);
            }}
          />,
          document.body
        )}

        {ReactDOM.createPortal(
          <ModalDarBajaSocio
            mostrar={mostrarModalDarBaja}
            socio={socioDarBaja}
            onClose={() => {
              setMostrarModalDarBaja(false);
              setSocioDarBaja(null);
            }}
            onDarBaja={darDeBajaSocio}
          />,
          document.body
        )}

        {ReactDOM.createPortal(
          <ModalRegistrarContactoSocio
            mostrar={mostrarModalContacto}
            socio={socioContacto}
            guardando={guardandoContacto}
            onClose={() => {
              if (guardandoContacto) return;
              setMostrarModalContacto(false);
              setSocioContacto(null);
            }}
            onGuardar={guardarContactoSocio}
            onOpenHistorial={() => {
              if (!socioContacto) return;
              abrirHistorialContacto(socioContacto);
            }}
          />,
          document.body
        )}

        {ReactDOM.createPortal(
          <ModalHistorialContactoSocio
            mostrar={mostrarModalHistorialContacto}
            socio={socioHistorialContacto}
            registros={historialContactos}
            cargando={cargandoHistorialContactos}
            onClose={() => {
              setMostrarModalHistorialContacto(false);
              setSocioHistorialContacto(null);
              setHistorialContactos([]);
            }}
          />,
          document.body
        )}
      </div>
    </div>
  );
};

export default Socios;