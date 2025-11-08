import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFilter, faMagnifyingGlass, faSpinner } from "@fortawesome/free-solid-svg-icons";

const sumMoneda = (arr) => arr.reduce((acc, p) => acc + (Number(p?._precioNum) || 0), 0);

export default function CobMesTable({
  loadingResumen,
  periodosVisibles,
  esperadosPorMes,
  getPagosByMonth,
  cobradorSeleccionado,
  nfPesos
}) {
  const rows = (periodosVisibles || []).map((p) => {
    const label = p.value;
    const months = p.months && p.months.length
      ? p.months
      : (String(label).match(/\d{1,2}/g) || []).map((n) => parseInt(n, 10)).filter((n) => n >= 1 && n <= 12);

    let recaudado = 0;
    let esperado = 0;

    months.forEach((m) => {
      const pagosMes = (getPagosByMonth(m) || []).filter(pg =>
        cobradorSeleccionado === "todos" ? true : pg._cb === cobradorSeleccionado
      );
      recaudado += sumMoneda(pagosMes);
      esperado  += Number(esperadosPorMes?.[m] || 0);
    });

    const diferencia = esperado - recaudado;

    return { label, esperado, recaudado, diferencia };
  });

  const totales = rows.reduce((acc, r) => {
    acc.esperado += r.esperado;
    acc.recaudado += r.recaudado;
    return acc;
  }, { esperado: 0, recaudado: 0 });
  const totalDif = totales.esperado - totales.recaudado;

  return (
    <section className="resumen-wrap" aria-label="Cobros por mes/período">
      <div className={`contable-tablewrap ${loadingResumen ? "is-loading" : ""}`}>
        <div className="gridtable-header" role="row" style={{ position: "relative", zIndex: 3 }}>
          <div className="gridtable-cell" role="columnheader">Período</div>
          <div className="gridtable-cell centers" role="columnheader">Esperado</div>
          <div className="gridtable-cell centers" role="columnheader">Recaudado</div>
          <div className="gridtable-cell centers" role="columnheader">Dif. (Esp-Rec)</div>
        </div>

        <div className="gridtable-body" role="rowgroup" style={{ flex: "1 1 auto", overflow: "auto", display: "flex", flexDirection: "column" }}>
          {loadingResumen ? (
            <div className="gridtable-empty" role="row" style={{ flex: "1 1 auto", display: "grid", placeItems: "center" }}>
              <div className="gridtable-empty-inner" role="cell">
                <div className="empty-icon"><FontAwesomeIcon icon={faSpinner} spin /></div>
                Calculando…
              </div>
            </div>
          ) : periodosVisibles.length === 0 ? (
            <div className="gridtable-empty" role="row" style={{ flex: "1 1 auto", display: "grid", placeItems: "center" }}>
              <div className="gridtable-empty-inner" role="cell">
                <div className="empty-icon"><FontAwesomeIcon icon={faFilter} /></div>
                Ajustá los filtros para ver datos.
              </div>
            </div>
          ) : rows.length === 0 ? (
            <div className="gridtable-empty" role="row" style={{ flex: "1 1 auto", display: "grid", placeItems: "center" }}>
              <div className="gridtable-empty-inner" role="cell">
                <div className="empty-icon"><FontAwesomeIcon icon={faMagnifyingGlass} /></div>
                No hay resultados con los filtros actuales.
              </div>
            </div>
          ) : (
            <>
              {rows.map((r, i) => (
                <div className="gridtable-row" role="row" key={`cm-${i}`}>
                  <div className="gridtable-cell" role="cell">{r.label}</div>
                  <div className="gridtable-cell centers" role="cell">{nfPesos.format(r.esperado)}</div>
                  <div className="gridtable-cell centers" role="cell">{nfPesos.format(r.recaudado)}</div>
                  <div className="gridtable-cell centers" role="cell">{nfPesos.format(r.diferencia)}</div>
                </div>
              ))}
              <div className="gridtable-row" role="row" style={{ fontWeight:"bold", background:"rgba(59,130,246,.08)" }}>
                <div className="gridtable-cell" role="cell">TOTAL AÑO</div>
                <div className="gridtable-cell centers" role="cell">{nfPesos.format(totales.esperado)}</div>
                <div className="gridtable-cell centers" role="cell">{nfPesos.format(totales.recaudado)}</div>
                <div className="gridtable-cell centers" role="cell">{nfPesos.format(totalDif)}</div>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
