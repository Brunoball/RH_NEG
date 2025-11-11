// src/components/Contable/tables/CobMesTable.jsx
import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFilter,
  faMagnifyingGlass,
  faSpinner,
  faCreditCard,        // TRANSFERENCIA
  faBuilding,          // OFICINA
  faHandHoldingDollar, // COBRADOR
} from "@fortawesome/free-solid-svg-icons";
import "../dashboard.css";

const sumMoneda = (arr) =>
  arr.reduce((acc, p) => acc + (Number(p?._precioNum) || 0), 0);

// Grupos fijos solicitados
const TARGETS = ["TRANSFERENCIA", "OFICINA", "COBRADOR"];

// Mapeo de íconos por medio
const ICONS = {
  TRANSFERENCIA: faCreditCard,
  OFICINA: faBuilding,
  COBRADOR: faHandHoldingDollar,
};

export default function CobMesTable({
  loadingResumen,
  periodosVisibles,
  esperadosPorMes,            // { mes -> esperado TOTAL }
  esperadosPorMesPorMedio,    // { NOMBRE_MAYUS -> { mes -> esperado } }
  getPagosByMonth,
  cobradorSeleccionado,
  mesSeleccionado,
  nfPesos,
}) {
  const upper = (s) => String(s || "").toUpperCase().trim();

  const selectedKey =
    cobradorSeleccionado && cobradorSeleccionado !== "todos"
      ? upper(cobradorSeleccionado)
      : null;

  // Lista de medios a mostrar: todos o solo el seleccionado
  const mediosAListar = selectedKey ? [selectedKey] : TARGETS;

  const buildRows = () => {
    return (periodosVisibles || []).map((p) => {
      const label = p.value;
      const months =
        p.months && p.months.length
          ? p.months
          : (String(label).match(/\d{1,2}/g) || [])
              .map((n) => parseInt(n, 10))
              .filter((n) => n >= 1 && n <= 12);

      const monthsToUse =
        mesSeleccionado && mesSeleccionado !== "Todos los meses"
          ? [parseInt(mesSeleccionado, 10)]
          : months;

      // Totales por período
      let recaudadoPeriodo = 0;
      let esperadoPeriodo = 0;

      monthsToUse.forEach((m) => {
        // Recaudado: si hay medio seleccionado, filtra por ese medio
        const pagosMes = (getPagosByMonth(m) || []).filter((pg) =>
          !selectedKey
            ? true
            : upper(pg._cb) === selectedKey ||
              upper(pg.id_cobrador ?? "") === selectedKey
        );
        recaudadoPeriodo += sumMoneda(pagosMes);

        // Esperado: si hay medio seleccionado, usar el esperado del medio; si no, el total del mes
        if (selectedKey) {
          esperadoPeriodo += Number(esperadosPorMesPorMedio?.[selectedKey]?.[m] || 0);
        } else {
          esperadoPeriodo += Number(esperadosPorMes?.[m] || 0);
        }
      });

      // Subfilas: todos o solo el medio seleccionado
      const mediosListado = mediosAListar.map((nombre) => {
        const key = upper(nombre);
        // Esperado por grupo
        let esperado = 0;
        for (const m of monthsToUse) {
          esperado += Number(esperadosPorMesPorMedio?.[key]?.[m] || 0);
        }

        // Recaudado por grupo
        let recaudado = 0;
        for (const m of monthsToUse) {
          const pagosMes = (getPagosByMonth(m) || []).filter(
            (pg) => upper(pg._cb) === key
          );
          recaudado += sumMoneda(pagosMes);
        }

        return { nombre: key, esperado, recaudado };
      });

      const diferenciaPeriodo = esperadoPeriodo - recaudadoPeriodo;
      return {
        label,
        esperado: esperadoPeriodo,
        recaudado: recaudadoPeriodo,
        diferencia: diferenciaPeriodo,
        mediosListado,
      };
    });
  };

  const rows = buildRows();

  const totales = rows.reduce(
    (acc, r) => {
      acc.esperado += r.esperado;
      acc.recaudado += r.recaudado;
      return acc;
    },
    { esperado: 0, recaudado: 0 }
  );

  const totalDif = totales.esperado - totales.recaudado;
  const noPeriodos = (periodosVisibles || []).length === 0;

  const fmt = (num) => `$ ${nfPesos.format(num)}`;
  const fmtDif = (num) => `$ ${nfPesos.format(Math.abs(num))}`;
  const difStyle = (num) => ({
    color: num <= 0 ? "#16a34a" : "#ef4444",
    fontWeight: 600,
  });

  return (
    <section
      className="resumen-wrap cobmes-section"
      aria-label="Cobros por mes/período"
    >
      <div className={`contable-tablewrap ${loadingResumen ? "is-loading" : ""}`}>
        <div className="gridtable-header cobmes-header" role="row">
          <div className="gridtable-cell" role="columnheader">Período</div>
          <div className="gridtable-cell centers" role="columnheader">Esperado</div>
          <div className="gridtable-cell centers" role="columnheader">Recaudado</div>
          <div className="gridtable-cell centers" role="columnheader">Dif. (Esp-Rec)</div>
        </div>

        <div className="gridtable-body cobmes-body" role="rowgroup">
          {loadingResumen ? (
            <div className="gridtable-empty cobmes-empty" role="row">
              <div className="gridtable-empty-inner" role="cell">
                <div className="empty-icon">
                  <FontAwesomeIcon icon={faSpinner} spin />
                </div>
                Calculando…
              </div>
            </div>
          ) : noPeriodos ? (
            <div className="gridtable-empty cobmes-empty" role="row">
              <div className="gridtable-empty-inner" role="cell">
                <div className="empty-icon">
                  <FontAwesomeIcon icon={faFilter} />
                </div>
                Ajustá los filtros para ver datos.
              </div>
            </div>
          ) : rows.length === 0 ? (
            <div className="gridtable-empty cobmes-empty" role="row">
              <div className="gridtable-empty-inner" role="cell">
                <div className="empty-icon">
                  <FontAwesomeIcon icon={faMagnifyingGlass} />
                </div>
                No hay resultados con los filtros actuales.
              </div>
            </div>
          ) : (
            <>
              {rows.map((r, i) => (
                <React.Fragment key={`cm-${i}`}>
                  {/* Fila principal del período */}
                  <div className="gridtable-row cobmestable-row" role="row">
                    <div className="gridtable-cell" role="cell">{r.label}</div>
                    <div className="gridtable-cell centers" role="cell">
                      {fmt(r.esperado)}
                    </div>
                    <div className="gridtable-cell centers" role="cell">
                      {fmt(r.recaudado)}
                    </div>
                    <div
                      className="gridtable-cell centers"
                      role="cell"
                      style={difStyle(r.diferencia)}
                    >
                      {fmtDif(r.diferencia)}
                    </div>
                  </div>

                  {/* Subfilas: TODOS o SOLO el medio seleccionado */}
                  <div className="gridtable-subrows">
                    {r.mediosListado.map((m, idx) => {
                      const icon = ICONS[m.nombre] || faCreditCard;
                      return (
                        <div
                          className="gridtable-row subrow"
                          role="row"
                          key={`cm-${i}-m-${idx}`}
                        >
                          <div className="gridtable-cell" role="cell">
                            <span className="pill pill-light">
                              <FontAwesomeIcon icon={icon} /> {m.nombre}
                            </span>
                          </div>
                          <div className="gridtable-cell centers" role="cell">
                            {fmt(m.esperado)}
                          </div>
                          <div className="gridtable-cell centers" role="cell">
                            {fmt(m.recaudado)}
                          </div>
                          <div
                            className="gridtable-cell centers"
                            role="cell"
                            style={difStyle(m.esperado - m.recaudado)}
                          >
                            {fmtDif(m.esperado - m.recaudado)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </React.Fragment>
              ))}

              <div className="gridtable-row cobmes-total" role="row">
                <div className="gridtable-cell" role="cell">TOTAL AÑO</div>
                <div className="gridtable-cell centers" role="cell">
                  {fmt(totales.esperado)}
                </div>
                <div className="gridtable-cell centers" role="cell">
                  {fmt(totales.recaudado)}
                </div>
                <div
                  className="gridtable-cell centers"
                  role="cell"
                  style={difStyle(totalDif)}
                >
                  {fmtDif(totalDif)}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
