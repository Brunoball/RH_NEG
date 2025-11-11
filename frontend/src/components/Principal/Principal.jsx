// src/components/Principal/Principal.jsx
import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUsers,
  faMoneyBillWave,
  faUserPlus,
  faSignOutAlt,
  faFileInvoiceDollar,
  faTags,
} from "@fortawesome/free-solid-svg-icons";

import "./principal.css";           // <-- nuevo CSS con el diseño calcado
import "../Global/roots.css";       // (si ya lo usás globalmente, mantenelo)
import logoRH from "../../imagenes/Logo_rh.jpeg";

/* ================================
   Util: limpiar TODO lo de Socios
===================================*/
function clearSociosFiltersAndCaches() {
  try {
    const LS_KEYS = [
      "filtros_socios",
      "filtros_socios_v2",
      "socios_cache",
      "listas_cache",
      "socios_cache_etag",
      "socios_cache_exp",
      "token_socios",
    ];
    LS_KEYS.forEach((k) => localStorage.removeItem(k));
  } catch {}

  try {
    const SS_KEYS = [
      "filtros_socios",
      "socios_last_filters",
      "socios_last_scroll",
      "socios_last_sel_id",
      "socios_last_ts",
    ];
    SS_KEYS.forEach((k) => sessionStorage.removeItem(k));
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith("socio_prefetch_")) sessionStorage.removeItem(key);
    }
  } catch {}
}

/* =========== Modal cierre de sesión (estilo institucional) ============= */
function ConfirmLogoutModal({ open, onConfirm, onCancel }) {
  const cancelBtnRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    // focus + esc
    cancelBtnRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e) => {
      if (e.key === "Escape") onCancel?.();
      if (e.key === "Enter") onConfirm?.();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onCancel, onConfirm]);

  if (!open) return null;
  const stop = (e) => e.stopPropagation();

  return (
    <div
      className="modalprincipal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modalprincipal-title"
      onMouseDown={onCancel}
    >
      <div className="modalprincipal-container modalprincipal--danger" onMouseDown={stop}>
        <div className="modalprincipal__icon" aria-hidden="true">
          <FontAwesomeIcon icon={faSignOutAlt} />
        </div>

        <h3 id="modalprincipal-title" className="modalprincipal-title">
          Confirmar cierre de sesión
        </h3>
        <p className="modalprincipal-text">¿Estás seguro de que deseas cerrar la sesión?</p>

        <div className="modalprincipal-buttons">
          <button
            type="button"
            className="modalprincipal-btn modalprincipal-btn--ghost"
            onClick={onCancel}
            ref={cancelBtnRef}
            autoFocus
          >
            Cancelar
          </button>
          <button
            type="button"
            className="modalprincipal-btn modalprincipal-btn--solid-danger"
            onClick={onConfirm}
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

const Principal = () => {
  // usuario / rol
  const usuario = (() => {
    try {
      return JSON.parse(localStorage.getItem("usuario"));
    } catch {
      return null;
    }
  })();
  const displayName = usuario?.nombre || usuario?.Nombre_Completo || "Usuario";
  const rol = (usuario?.rol || "vista").toLowerCase();
  const isAdmin = rol === "admin";
  const isViewer = rol === "vista";

  const navigate = useNavigate();
  const [showConfirm, setShowConfirm] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  // limpieza de caches al entrar
  useEffect(() => {
    clearSociosFiltersAndCaches();
  }, []);

  // también limpiamos restos genéricos de búsquedas (opcional)
  useEffect(() => {
    try {
      localStorage.removeItem("ultimaBusqueda");
      localStorage.removeItem("ultimosResultados");
      localStorage.removeItem("alumnoSeleccionado");
      localStorage.removeItem("ultimaAccion");
    } catch {}
  }, []);

  // acciones
  const pedirConfirmacion = () => setShowConfirm(true);

  const doLogout = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      try {
        sessionStorage.clear();
        localStorage.removeItem("usuario");
        localStorage.removeItem("token");
      } catch {}
      setShowConfirm(false);
      navigate("/", { replace: true });
    }, 350);
  }, [navigate]);

  const goSocios = useCallback(() => {
    clearSociosFiltersAndCaches();
    navigate("/socios");
  }, [navigate]);

  const goCuotas = useCallback(() => navigate("/cuotas"), [navigate]);
  const goContable = useCallback(() => navigate("/contable"), [navigate]);
  const goRegistro = useCallback(() => navigate("/registro"), [navigate]);
  const goCategorias = useCallback(() => navigate("/categorias"), [navigate]);

  // Ítems visibles (calcados al layout institucional de tarjetas)
  const itemsBase = [
    {
      icon: faUsers,
      text: "Gestionar Socios",
      desc: "Administra el listado de socios",
      onClick: goSocios,
    },
  ];
  const itemsNoVista = [
    {
      icon: faMoneyBillWave,
      text: "Gestionar Cuotas",
      desc: "Control de pagos y cuotas",
      onClick: goCuotas,
    },
    {
      icon: faTags,
      text: "Categorías",
      desc: "Montos de categorías",
      onClick: goCategorias,
    },
    {
      icon: faFileInvoiceDollar,
      text: "Gestión contable",
      desc: "Ingresos por mes y categorías",
      onClick: goContable,
    },
  ];
  const itemsAdminSolo = [
    {
      icon: faUserPlus,
      text: "Registro de Usuarios",
      desc: "Administra accesos al sistema",
      onClick: goRegistro,
    },
  ];

  const visibleItems = isViewer
    ? itemsBase
    : isAdmin
    ? [...itemsBase, ...itemsNoVista, ...itemsAdminSolo]
    : [...itemsBase, ...itemsNoVista];

  return (
    <div className={`pagina-principal-container ${isExiting ? "slide-fade-out" : ""}`}>
      <div className="pagina-principal-card">
        {/* Header fila (texto izq / logo der) */}
        <div className="pagina-principal-header header--row">
          <div className="header-text">
            <h1 className="title">
              Sistema de <span className="title-accent">Gestión Círculo RH Negativo</span>
            </h1>
            <p className="subtitle">Panel de administración integral</p>
            <p className="subtitle">
              Bienvenido, <strong>{displayName}</strong>
              <span className="sr-only"> (Rol: {rol})</span>
            </p>
          </div>

          <div className="logo-container logo-container--right">
            <img src={logoRH} alt="Logo RH Negativo" className="logo" />
          </div>
        </div>

        {/* Grid institucional de 3 columnas */}
        <div className="menu-container">
          <div className="menu-grid flex--compact">
            {visibleItems.map((item, idx) => (
              <button key={idx} className="menu-button card--compact" onClick={item.onClick} type="button">
                <div className="button-icon icon--sm" aria-hidden="true">
                  <FontAwesomeIcon icon={item.icon} size="lg" />
                </div>
                <span className="button-text text--sm">{item.text}</span>
                {item.desc ? <span className="button-desc">{item.desc}</span> : null}
              </button>
            ))}
          </div>
        </div>

        {/* Botón salir (estilo calcado) */}
        <button type="button" className="logout-button" onClick={pedirConfirmacion}>
          <FontAwesomeIcon icon={faSignOutAlt} className="logout-icon" />
          <span className="logout-text-full">Cerrar Sesión</span>
          <span className="logout-text-short">Salir</span>
        </button>

        {/* Footer */}
        <footer className="pagina-principal-footer">
          Desarrollado por{" "}
          <a href="https://3devsnet.com" target="_blank" rel="noopener noreferrer">
            3devs.solutions
          </a>
        </footer>
      </div>

      {/* Modal */}
      <ConfirmLogoutModal open={showConfirm} onConfirm={doLogout} onCancel={() => setShowConfirm(false)} />
    </div>
  );
};

export default Principal;
