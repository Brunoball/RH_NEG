// src/components/Contable/tables/DetSocTable.jsx
import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFilter, faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons";

export default function DetSocTable({
  anioSeleccionado,
  loadingDetSoc,
  detSocRows,
  detSocTotales
}) {
  return (
    <section className="resumen-wrap" aria-label="Detalle de socios por servicio y categoría">
      <div className={`contable-tablewrap ${loadingDetSoc ? "is-loading" : ""}`}>
        <div className="gridtable-header" role="row" style={{ position: "relative", zIndex: 3 }}>
          <div className="gridtable-cell" role="columnheader">Servicio</div>
          <div className="gridtable-cell centers" role="columnheader">Categoría</div>
          <div className="gridtable-cell centers" role="columnheader">Cantidad</div>
        </div>

        <div className="gridtable-body" role="rowgroup" style={{ flex: "1 1 auto", overflow: "auto", display: "flex", flexDirection: "column" }}>
          {(!anioSeleccionado) ? (
            <div className="gridtable-empty" role="row" style={{ flex: "1 1 auto", display: "grid", placeItems: "center" }}>
              <div className="gridtable-empty-inner" role="cell">
                <div className="empty-icon"><FontAwesomeIcon icon={faFilter} /></div>
                Seleccione un año para ver el detalle.
              </div>
            </div>
          ) : detSocRows.length === 0 ? (
            <div className="gridtable-empty" role="row" style={{ flex: "1 1 auto", display: "grid", placeItems: "center" }}>
              <div className="gridtable-empty-inner" role="cell">
                <div className="empty-icon"><FontAwesomeIcon icon={faMagnifyingGlass} /></div>
                No hay resultados con los filtros actuales.
              </div>
            </div>
          ) : (
            <>
              {detSocRows.map((r, i) => (
                <div className="gridtable-row" role="row" key={`ds-${i}`}>
                  <div className="gridtable-cell" role="cell">{r.servicio}</div>
                  <div className="gridtable-cell centers" role="cell">{r.categoria}</div>
                  <div className="gridtable-cell centers" role="cell">{r.cantidad}</div>
                </div>
              ))}
              <div className="gridtable-row" role="row" style={{ fontWeight:"bold", background:"rgba(16,185,129,.08)" }}>
                <div className="gridtable-cell" role="cell">TOTAL ACTIVO</div>
                <div className="gridtable-cell centers" role="cell">—</div>
                <div className="gridtable-cell centers" role="cell">{detSocTotales.ACTIVO}</div>
              </div>
              <div className="gridtable-row" role="row" style={{ fontWeight:"bold", background:"rgba(234,179,8,.08)" }}>
                <div className="gridtable-cell" role="cell">TOTAL PASIVO</div>
                <div className="gridtable-cell centers" role="cell">—</div>
                <div className="gridtable-cell centers" role="cell">{detSocTotales.PASIVO}</div>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
