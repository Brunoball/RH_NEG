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

// Estados de socio a desglosar
const ESTADOS_SOCIO = ["ACTIVO", "PASIVO"];

export default function CobMesTable({
  loadingResumen,
  periodosVisibles,
  esperadosPorMes,          // { mes -> esperado TOTAL }
  esperadosPorMesPorMedio,  // { MEDIO -> { mes -> esperado } }
  sociosPorMesPorMedio,     // { MEDIO -> { mes -> socios } }
  getPagosByMonth,
  cobradorSeleccionado,
  mesSeleccionado,
  nfPesos,
  // NUEVO: esperado y socios por MEDIO y ESTADO
  // Forma esperadosPorMesPorMedioEstado[MEDIO][ESTADO][mes] = monto
  esperadosPorMesPorMedioEstado,
  // Forma sociosPorMesPorMedioEstado[MEDIO][ESTADO][mes] = cant socios
  sociosPorMesPorMedioEstado,
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

      // Totales por período (monto)
      let recaudadoPeriodo = 0;
      let esperadoPeriodo = 0;

      monthsToUse.forEach((m) => {
        // Recaudado del período (todos los medios)
        const pagosMes = (getPagosByMonth(m) || []).filter((pg) =>
          !selectedKey
            ? true
            : upper(pg._cb) === selectedKey ||
              upper(pg.id_cobrador ?? "") === selectedKey
        );
        recaudadoPeriodo += sumMoneda(pagosMes);

        // Esperado del período
        if (selectedKey) {
          esperadoPeriodo += Number(
            esperadosPorMesPorMedio?.[selectedKey]?.[m] || 0
          );
        } else {
          esperadoPeriodo += Number(esperadosPorMes?.[m] || 0);
        }
      });

      // Subfilas: TODOS o SOLO el medio seleccionado
      const mediosListado = mediosAListar.map((nombre) => {
        const key = upper(nombre);
        let esperado = 0;
        let recaudado = 0;

        const sociosMeses = []; // para deduplicar cuando el período tiene 2 meses

        for (const m of monthsToUse) {
          // esperado por grupo
          esperado += Number(esperadosPorMesPorMedio?.[key]?.[m] || 0);

          // recaudado por grupo
          const pagosMes = (getPagosByMonth(m) || []).filter(
            (pg) => upper(pg._cb) === key
          );
          recaudado += sumMoneda(pagosMes);

          // socios del grupo en ese mes (esperados, vienen del backend)
          const sociosMes = Number(sociosPorMesPorMedio?.[key]?.[m] || 0);
          sociosMeses.push(sociosMes);
        }

        // Socios del medio en el PERÍODO
        let socios = 0;
        if (monthsToUse.length <= 1) {
          socios = sociosMeses.reduce((a, b) => a + b, 0);
        } else {
          socios = sociosMeses.length ? Math.max(...sociosMeses) : 0;
        }

        // ============ DESGLOSE POR ESTADO (ACTIVO / PASIVO) =============
        const porEstado = {};

        for (const est of ESTADOS_SOCIO) {
          let esperadoE = 0;
          let recaudadoE = 0;
          const sociosEArr = [];

          for (const m of monthsToUse) {
            // Esperado por estado (viene desde el backend)
            if (esperadosPorMesPorMedioEstado?.[key]?.[est]) {
              esperadoE += Number(
                esperadosPorMesPorMedioEstado[key][est]?.[m] || 0
              );
            }

            // Recaudado por estado → filtramos pagos por cobrador + estado socio
            const pagosMesEstado = (getPagosByMonth(m) || []).filter((pg) => {
              const cbOk = upper(pg._cb) === key;

              // Normalizar estado del socio igual que en el backend:
              //  - 'PASIVO' literal => PASIVO
              //  - cualquier otro valor => ACTIVO
              const estadoSocioRaw = upper(
                pg.Estado_Socio ||
                  pg.estado_socio ||
                  pg.estado_socio_desc ||
                  pg.estado_socio_descripcion ||
                  ""
              );
              const estadoSocioNorm =
                estadoSocioRaw === "PASIVO" ? "PASIVO" : "ACTIVO";

              const estOk = estadoSocioNorm === est;
              return cbOk && estOk;
            });

            recaudadoE += sumMoneda(pagosMesEstado);

            // Socios por estado en ese mes (esperados, desde backend si está)
            let sociosMesE = 0;

            if (sociosPorMesPorMedioEstado?.[key]?.[est]) {
              sociosMesE = Number(
                sociosPorMesPorMedioEstado[key][est]?.[m] || 0
              );
            } else {
              // fallback: contamos IDs de socio distintos en los pagos de ese mes
              const ids = new Set(
                pagosMesEstado.map((pg) => pg.ID_Socio || pg.id_socio)
              );
              sociosMesE = ids.size;
            }

            sociosEArr.push(sociosMesE);
          }

          let sociosE = 0;
          if (monthsToUse.length <= 1) {
            sociosE = sociosEArr.reduce((a, b) => a + b, 0);
          } else {
            sociosE = sociosEArr.length ? Math.max(...sociosEArr) : 0;
          }

          porEstado[est] = {
            esperado: esperadoE,
            recaudado: recaudadoE,
            socios: sociosE,
          };
        }

        return { nombre: key, esperado, recaudado, socios, porEstado };
      });

      // Socios del PERÍODO = suma de los socios de cada medio
      const sociosPeriodo = mediosListado.reduce(
        (acc, m) => acc + (m.socios || 0),
        0
      );

      const diferenciaPeriodo = esperadoPeriodo - recaudadoPeriodo;

      return {
        label,
        esperado: esperadoPeriodo,
        recaudado: recaudadoPeriodo,
        diferencia: diferenciaPeriodo,
        sociosPeriodo,
        mediosListado,
      };
    });
  };

  const rows = buildRows();

  // Totales generales
  const totales = rows.reduce(
    (acc, r) => {
      acc.esperado += r.esperado;
      acc.recaudado += r.recaudado;
      acc.socios = Math.max(acc.socios, r.sociosPeriodo || 0);
      return acc;
    },
    { esperado: 0, recaudado: 0, socios: 0 }
  );

  const totalDif = totales.esperado - totales.recaudado;
  const noPeriodos = (periodosVisibles || []).length === 0;

  const fmt = (num) => `$ ${nfPesos.format(num)}`;
  const fmtDif = (num) => `$ ${nfPesos.format(Math.abs(num))}`;
  const fmtSocios = (num) => nfPesos.format(num);
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
          <div className="gridtable-cell" role="columnheader">
            Período
          </div>
          <div className="gridtable-cell centers" role="columnheader">
            Esperado
          </div>
          <div className="gridtable-cell centers" role="columnheader">
            Recaudado
          </div>
          <div className="gridtable-cell centers" role="columnheader">
            Socios
          </div>
          <div className="gridtable-cell centers" role="columnheader">
            Dif. (Esp-Rec)
          </div>
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
                    <div className="gridtable-cell" role="cell">
                      {r.label}
                    </div>
                    <div className="gridtable-cell centers" role="cell">
                      {fmt(r.esperado)}
                    </div>
                    <div className="gridtable-cell centers" role="cell">
                      {fmt(r.recaudado)}
                    </div>
                    <div className="gridtable-cell centers" role="cell">
                      {fmtSocios(r.sociosPeriodo)}
                    </div>
                    <div
                      className="gridtable-cell centers"
                      role="cell"
                      style={difStyle(r.diferencia)}
                    >
                      {fmtDif(r.diferencia)}
                    </div>
                  </div>

                  {/* Subfilas por medio de pago y por estado */}
                  <div className="gridtable-subrows">
                    {r.mediosListado.map((m, idx) => {
                      const icon = ICONS[m.nombre] || faCreditCard;

                      return (
                        <React.Fragment key={`cm-${i}-m-${idx}`}>
                          {/* Fila del MEDIO (TRANSFERENCIA / OFICINA / COBRADOR) */}
                          <div className="gridtable-row subrow" role="row">
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
                            <div className="gridtable-cell centers" role="cell">
                              {fmtSocios(m.socios)}
                            </div>
                            <div
                              className="gridtable-cell centers"
                              role="cell"
                              style={difStyle(m.esperado - m.recaudado)}
                            >
                              {fmtDif(m.esperado - m.recaudado)}
                            </div>
                          </div>

                          {/* Fila ACTIVO */}
                          <div className="gridtable-row subrow subrow-estado" role="row">
                            <div className="gridtable-cell" role="cell">
                              <span className="pill pill-soft">ACTIVO</span>
                            </div>
                            <div className="gridtable-cell centers" role="cell">
                              {fmt(m.porEstado.ACTIVO?.esperado || 0)}
                            </div>
                            <div className="gridtable-cell centers" role="cell">
                              {fmt(m.porEstado.ACTIVO?.recaudado || 0)}
                            </div>
                            <div className="gridtable-cell centers" role="cell">
                              {fmtSocios(m.porEstado.ACTIVO?.socios || 0)}
                            </div>
                            <div
                              className="gridtable-cell centers"
                              role="cell"
                              style={difStyle(
                                (m.porEstado.ACTIVO?.esperado || 0) -
                                  (m.porEstado.ACTIVO?.recaudado || 0)
                              )}
                            >
                              {fmtDif(
                                (m.porEstado.ACTIVO?.esperado || 0) -
                                  (m.porEstado.ACTIVO?.recaudado || 0)
                              )}
                            </div>
                          </div>

                          {/* Fila PASIVO */}
                          <div className="gridtable-row subrow subrow-estado" role="row">
                            <div className="gridtable-cell" role="cell">
                              <span className="pill pill-soft pill-warn">PASIVO</span>
                            </div>
                            <div className="gridtable-cell centers" role="cell">
                              {fmt(m.porEstado.PASIVO?.esperado || 0)}
                            </div>
                            <div className="gridtable-cell centers" role="cell">
                              {fmt(m.porEstado.PASIVO?.recaudado || 0)}
                            </div>
                            <div className="gridtable-cell centers" role="cell">
                              {fmtSocios(m.porEstado.PASIVO?.socios || 0)}
                            </div>
                            <div
                              className="gridtable-cell centers"
                              role="cell"
                              style={difStyle(
                                (m.porEstado.PASIVO?.esperado || 0) -
                                  (m.porEstado.PASIVO?.recaudado || 0)
                              )}
                            >
                              {fmtDif(
                                (m.porEstado.PASIVO?.esperado || 0) -
                                  (m.porEstado.PASIVO?.recaudado || 0)
                              )}
                            </div>
                          </div>
                        </React.Fragment>
                      );
                    })}
                  </div>
                </React.Fragment>
              ))}

              {/* Fila TOTAL */}
              <div className="gridtable-row cobmes-total" role="row">
                <div className="gridtable-cell" role="cell">
                  TOTAL
                </div>
                <div className="gridtable-cell centers" role="cell">
                  {fmt(totales.esperado)}
                </div>
                <div className="gridtable-cell centers" role="cell">
                  {fmt(totales.recaudado)}
                </div>
                <div className="gridtable-cell centers" role="cell">
                  {fmtSocios(totales.socios)}
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
