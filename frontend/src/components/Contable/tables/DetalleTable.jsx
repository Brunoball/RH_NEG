// src/components/Contable/tables/DetalleTable.jsx
import React, { memo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFilter,
  faMagnifyingGlass,
} from "@fortawesome/free-solid-svg-icons";
import "../dashboard.css";
/** Fila memoizada (mismo markup que tenías) */
const GridRow = memo(function GridRow({ r, i, nfPesos }) {
  const montoFmt = Number.isFinite(r._precioNum)
    ? nfPesos.format(r._precioNum)
    : "0";

  return (
    <div
      className="gridtable-row row-appear"
      role="row"
      style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}
    >
      <div
        className="gridtable-cell"
        role="cell"
        data-label="Apellido y Nombre"
      >
        {r._nombreCompleto}
      </div>
      <div
        className="gridtable-cell centers"
        role="cell"
        data-label="Categoría (Monto)"
      >
        {(r._categoriaTxt || "-") + " (" + montoFmt + ")"}
      </div>
      <div
        className="gridtable-cell centers"
        role="cell"
        data-label="Cobrador"
      >
        {r._cb || "-"}
      </div>
      <div
        className="gridtable-cell centers"
        role="cell"
        data-label="Fecha de Pago"
      >
        {r.fechaPago || "-"}
      </div>
      <div
        className="gridtable-cell centers"
        role="cell"
        data-label="Periodo pago"
      >
        {r.Mes_Pagado || "-"}
      </div>
    </div>
  );
});

export default function DetalleTable({
  showSkeleton,
  renderSkeletonRows,
  needsYearData,
  registrosFiltradosPorBusqueda,
  nfPesos,
}) {
  const totalRows = registrosFiltradosPorBusqueda.length || 0;

  return (
    <section
      className="resumen-wrap detalle-section"
      aria-label="Detalle de pagos por socio"
    >
      <div
        className={`contable-tablewrap ${
          showSkeleton ? "is-loading" : ""
        }`}
      >
        <div
          className="gridtable-header detalle-header"
          role="row"
        >
          <div className="gridtable-cell" role="columnheader">
            Apellido y Nombre
          </div>
          <div className="gridtable-cell centers" role="columnheader">
            Categoría
          </div>
          <div className="gridtable-cell centers" role="columnheader">
            Cobrador
          </div>
          <div className="gridtable-cell centers" role="columnheader">
            Fecha de Pago
          </div>
          <div className="gridtable-cell centers" role="columnheader">
            Periodo pago
          </div>
        </div>

        <div
          className="gridtable-body detalle-body"
          role="rowgroup"
          aria-rowcount={totalRows}
        >
          {showSkeleton ? (
            renderSkeletonRows()
          ) : (
            <>
              {!needsYearData ? (
                <div
                  className="gridtable-empty detalle-empty"
                  role="row"
                >
                  <div
                    className="gridtable-empty-inner"
                    role="cell"
                  >
                    <div className="empty-icon">
                      <FontAwesomeIcon icon={faFilter} />
                    </div>
                    Seleccione un año para ver los pagos
                  </div>
                </div>
              ) : registrosFiltradosPorBusqueda.length === 0 ? (
                <div
                  className="gridtable-empty detalle-empty"
                  role="row"
                >
                  <div
                    className="gridtable-empty-inner"
                    role="cell"
                  >
                    <div className="empty-icon">
                      <FontAwesomeIcon icon={faMagnifyingGlass} />
                    </div>
                    No hay registros para ese filtro/búsqueda.
                  </div>
                </div>
              ) : (
                registrosFiltradosPorBusqueda.map((r, i) => (
                  <GridRow
                    key={r._ts ? `${r._ts}-${i}` : i}
                    r={r}
                    i={i}
                    nfPesos={nfPesos}
                  />
                ))
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
