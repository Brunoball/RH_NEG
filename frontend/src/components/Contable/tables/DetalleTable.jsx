// ✅ REEMPLAZAR COMPLETO
// src/components/Contable/tables/DetalleTable.jsx

import React, { memo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFilter, faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons";
import "../dashboard.css";

/** Fila memoizada */
const GridRow = memo(function GridRow({ r, i, nfPesos }) {
  const montoNum =
    Number.isFinite(r?._precioNum) ? Number(r._precioNum) : Number(r?.Precio ?? 0) || 0;
  const montoFmt = nfPesos.format(montoNum);

  const periodoRaw = String(r?.Mes_Pagado || "").trim();
  const isInscripcion = periodoRaw.toUpperCase() === "INSCRIPCION";

  const categoriaTxt = String(r?._categoriaTxt || "-").trim();
  const categoriaCell = isInscripcion ? `$${montoFmt}` : `${categoriaTxt} (${montoFmt})`;

  // ✅ anio_aplicado viene REAL desde DB (p.anio_aplicado)
  const anioAplicadoNum = Number(r?.anio_aplicado);
  const anioAplicado =
    Number.isFinite(anioAplicadoNum) && anioAplicadoNum > 0 ? String(anioAplicadoNum) : "";

  // ✅ Periodo pago: "PERIODO (nombre) / anio_aplicado"
  // (para anual pagado en 2025 pero aplicado 2026, va a mostrar 2026)
  const periodoCell = `${periodoRaw || "-"}${anioAplicado ? ` / ${anioAplicado}` : ""}`;

  return (
    <div
      className="gridtable-row row-appear"
      role="row"
      style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}
    >
      <div className="gridtable-cell" role="cell" data-label="Apellido y Nombre">
        {r?._nombreCompleto || "-"}
      </div>

      <div className="gridtable-cell centers" role="cell" data-label="Categoría (Monto)">
        {categoriaCell}
      </div>

      <div className="gridtable-cell centers" role="cell" data-label="Cobrador">
        {r?._cb || "-"}
      </div>

      <div className="gridtable-cell centers" role="cell" data-label="Fecha de Pago">
        {r?.fechaPago || "-"}
      </div>

      <div className="gridtable-cell centers" role="cell" data-label="Periodo pago">
        {periodoCell}
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
  const rows = Array.isArray(registrosFiltradosPorBusqueda)
    ? registrosFiltradosPorBusqueda
    : [];

  const totalRows = rows.length || 0;

  return (
    <section className="resumen-wrap detalle-section" aria-label="Detalle de pagos por socio">
      <div className={`contable-tablewrap ${showSkeleton ? "is-loading" : ""}`}>
        <div className="gridtable-header detalle-header" role="row">
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

        <div className="gridtable-body detalle-body" role="rowgroup" aria-rowcount={totalRows}>
          {showSkeleton ? (
            renderSkeletonRows()
          ) : (
            <>
              {!needsYearData ? (
                <div className="gridtable-empty detalle-empty" role="row">
                  <div className="gridtable-empty-inner" role="cell">
                    <div className="empty-icon">
                      <FontAwesomeIcon icon={faFilter} />
                    </div>
                    Seleccione un año para ver los pagos
                  </div>
                </div>
              ) : rows.length === 0 ? (
                <div className="gridtable-empty detalle-empty" role="row">
                  <div className="gridtable-empty-inner" role="cell">
                    <div className="empty-icon">
                      <FontAwesomeIcon icon={faMagnifyingGlass} />
                    </div>
                    No hay registros para ese filtro/búsqueda.
                  </div>
                </div>
              ) : (
                rows.map((r, i) => (
                  <GridRow key={r?._ts ? `${r._ts}-${i}` : i} r={r} i={i} nfPesos={nfPesos} />
                ))
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}