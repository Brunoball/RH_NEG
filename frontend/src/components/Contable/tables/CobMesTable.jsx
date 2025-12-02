// src/components/Contable/tables/CobMesTable.jsx
import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFilter,
  faMagnifyingGlass,
  faSpinner,
  faCreditCard,        // TRANSFERENCIA
  faBuilding,          // OFICINA
  faHandHoldingDollar, // COBRADOR / EFECTIVO
} from "@fortawesome/free-solid-svg-icons";
import "../dashboard.css";

const sumMoneda = (arr) =>
  arr.reduce((acc, p) => acc + (Number(p?._precioNum) || 0), 0);

// Mapeo de íconos por cobrador (usar nombres exactos de la base de datos)
const ICONS = {
  TRANSFERENCIA: faCreditCard,
  OFICINA: faBuilding,
  COBRADOR: faHandHoldingDollar,
  // Agregar más íconos si hay otros cobradores
};

// Estados de socio a desglosar
const ESTADOS_SOCIO = ["ACTIVO", "PASIVO"];

// Medios de pago que queremos mostrar debajo de ACTIVO / PASIVO para OFICINA
const MEDIOS_OFICINA = ["TRANSFERENCIA", "EFECTIVO"];

export default function CobMesTable({
  loadingResumen,
  periodosVisibles,
  esperadosPorMes,                // { mes -> esperado TOTAL }
  esperadosPorMesPorCobrador,    // { COBRADOR -> { mes -> esperado } }
  sociosPorMesPorCobrador,       // { COBRADOR -> { mes -> socios } }
  getPagosByMonth,
  cobradorSeleccionado,
  mesSeleccionado,
  nfPesos,
  // NUEVO: esperado y socios por COBRADOR y ESTADO
  // Forma esperadosPorMesPorCobradorEstado[COBRADOR][ESTADO][mes] = monto
  esperadosPorMesPorCobradorEstado,
  // Forma sociosPorMesPorCobradorEstado[COBRADOR][ESTADO][mes] = cant socios
  sociosPorMesPorCobradorEstado,
}) {
  const upper = (s) => String(s || "").toUpperCase().trim();

  // Familia visual (OFICINA / COBRADOR / TRANSFERENCIA)
  const getFamilyClass = (nombre) => {
    const key = upper(nombre);
    if (key === "OFICINA") return "family-oficina";
    if (key === "COBRADOR") return "family-cobrador";
    if (key === "TRANSFERENCIA") return "family-transferencia";
    return "family-other";
  };

  const selectedKey =
    cobradorSeleccionado && cobradorSeleccionado !== "todos"
      ? upper(cobradorSeleccionado)
      : null;

  // Obtener todos los cobradores únicos de los datos
  const getAllCobradores = () => {
    const cobradoresSet = new Set();

    // Agregar cobradores del esperado
    if (esperadosPorMesPorCobrador) {
      Object.keys(esperadosPorMesPorCobrador).forEach((cob) => {
        cobradoresSet.add(cob);
      });
    }

    // Agregar cobradores de los pagos reales
    const allMonths = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    allMonths.forEach((m) => {
      const pagosMes = getPagosByMonth(m) || [];
      pagosMes.forEach((p) => {
        if (p._cb) cobradoresSet.add(upper(p._cb));
      });
    });

    // Ordenar alfabéticamente
    return Array.from(cobradoresSet).sort((a, b) => a.localeCompare(b, "es"));
  };

  // Lista de cobradores a mostrar: todos o solo el seleccionado
  const cobradoresAListar = selectedKey ? [selectedKey] : getAllCobradores();

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
        // Recaudado del período (todos los cobradores)
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
            esperadosPorMesPorCobrador?.[selectedKey]?.[m] || 0
          );
        } else {
          esperadoPeriodo += Number(esperadosPorMes?.[m] || 0);
        }
      });

      // Subfilas: TODOS o SOLO el cobrador seleccionado
      const cobradoresListado = cobradoresAListar.map((nombre) => {
        const key = upper(nombre);
        let esperado = 0;
        let recaudado = 0;

        const sociosMeses = []; // para deduplicar cuando el período tiene 2 meses

        for (const m of monthsToUse) {
          // esperado por cobrador
          esperado += Number(esperadosPorMesPorCobrador?.[key]?.[m] || 0);

          // recaudado por cobrador
          const pagosMes = (getPagosByMonth(m) || []).filter(
            (pg) => upper(pg._cb) === key
          );
          recaudado += sumMoneda(pagosMes);

          // socios del cobrador en ese mes (esperados, vienen del backend)
          const sociosMes = Number(sociosPorMesPorCobrador?.[key]?.[m] || 0);
          sociosMeses.push(sociosMes);
        }

        // Socios del cobrador en el PERÍODO
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
          const porMedio = {}; // por medio de pago dentro del estado

          for (const m of monthsToUse) {
            // Esperado por estado (viene desde el backend)
            if (esperadosPorMesPorCobradorEstado?.[key]?.[est]) {
              esperadoE += Number(
                esperadosPorMesPorCobradorEstado[key][est]?.[m] || 0
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

            // Desglosar por MEDIO DE PAGO dentro del estado
            pagosMesEstado.forEach((pg) => {
              const medioRaw =
                pg.Medio_Pago ||
                pg.medio_pago_nombre ||
                pg.medio_pago ||
                "";
              const medio = upper(medioRaw);
              if (!medio) return;

              if (!porMedio[medio]) {
                porMedio[medio] = {
                  recaudado: 0,
                  socios: 0, // interpretamos "cant soc" = cantidad de pagos
                };
              }
              porMedio[medio].recaudado += Number(pg._precioNum) || 0;
              porMedio[medio].socios += 1;
            });

            // Socios por estado en ese mes (esperados, desde backend si está)
            let sociosMesE = 0;

            if (sociosPorMesPorCobradorEstado?.[key]?.[est]) {
              sociosMesE = Number(
                sociosPorMesPorCobradorEstado[key][est]?.[m] || 0
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
            porMedio,
          };
        }

        return {
          nombre: key,
          esperado,
          recaudado,
          socios,
          porEstado,
          icon: ICONS[key] || faHandHoldingDollar,
        };
      });

      // Filtrar cobradores que tienen datos (esperado o recaudado > 0)
      const cobradoresConDatos = cobradoresListado.filter(
        (c) => c.esperado > 0 || c.recaudado > 0 || c.socios > 0
      );

      // Socios del PERÍODO = suma de los socios de cada cobrador
      const sociosPeriodo = cobradoresConDatos.reduce(
        (acc, c) => acc + (c.socios || 0),
        0
      );

      const diferenciaPeriodo = esperadoPeriodo - recaudadoPeriodo;

      return {
        label,
        esperado: esperadoPeriodo,
        recaudado: recaudadoPeriodo,
        diferencia: diferenciaPeriodo,
        sociosPeriodo,
        cobradoresListado: cobradoresConDatos,
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
      <div
        className={`contable-tablewrap ${
          loadingResumen ? "is-loading" : ""
        }`}
      >
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

                  {/* Subfilas por cobrador y por estado */}
                  {r.cobradoresListado.length > 0 && (
                    <div className="gridtable-subrows">
                      {r.cobradoresListado.map((cob, idx) => {
                        const familyClass = getFamilyClass(cob.nombre);
                        const clsCobrador = `pill pill-light pill-cobrador ${familyClass}`;

                        return (
                          <React.Fragment key={`cm-${i}-c-${idx}`}>
                            {/* Fila del COBRADOR */}
                            <div className="gridtable-row subrow" role="row">
                              <div className="gridtable-cell" role="cell">
                                <span className={clsCobrador}>
                                  <FontAwesomeIcon icon={cob.icon} />{" "}
                                  {cob.nombre}
                                </span>
                              </div>
                              <div
                                className="gridtable-cell centers"
                                role="cell"
                              >
                                {fmt(cob.esperado)}
                              </div>
                              <div
                                className="gridtable-cell centers"
                                role="cell"
                              >
                                {fmt(cob.recaudado)}
                              </div>
                              <div
                                className="gridtable-cell centers"
                                role="cell"
                              >
                                {fmtSocios(cob.socios)}
                              </div>
                              <div
                                className="gridtable-cell centers"
                                role="cell"
                                style={difStyle(
                                  cob.esperado - cob.recaudado
                                )}
                              >
                                {fmtDif(cob.esperado - cob.recaudado)}
                              </div>
                            </div>

                            {/* Fila ACTIVO */}
                            <div
                              className="gridtable-row subrow subrow-estado"
                              role="row"
                            >
                              <div
                                className="gridtable-cell"
                                role="cell"
                              >
                                <span
                                  className={`pill pill-soft pill-estado pill-estado-activo ${familyClass}`}
                                >
                                  ACTIVO
                                </span>
                              </div>
                              <div
                                className="gridtable-cell centers"
                                role="cell"
                              >
                                {fmt(cob.porEstado.ACTIVO?.esperado || 0)}
                              </div>
                              <div
                                className="gridtable-cell centers"
                                role="cell"
                              >
                                {fmt(cob.porEstado.ACTIVO?.recaudado || 0)}
                              </div>
                              <div
                                className="gridtable-cell centers"
                                role="cell"
                              >
                                {fmtSocios(
                                  cob.porEstado.ACTIVO?.socios || 0
                                )}
                              </div>
                              <div
                                className="gridtable-cell centers"
                                role="cell"
                                style={difStyle(
                                  (cob.porEstado.ACTIVO?.esperado || 0) -
                                    (cob.porEstado.ACTIVO?.recaudado || 0)
                                )}
                              >
                                {fmtDif(
                                  (cob.porEstado.ACTIVO?.esperado || 0) -
                                    (cob.porEstado.ACTIVO?.recaudado || 0)
                                )}
                              </div>
                            </div>

                            {/* SUBSUBFILAS: ACTIVO -> medios de pago (solo OFICINA) */}
                            {cob.nombre === "OFICINA" &&
                              MEDIOS_OFICINA.map((medio) => {
                                const info =
                                  cob.porEstado.ACTIVO?.porMedio?.[medio] || {
                                    recaudado: 0,
                                    socios: 0,
                                  };
                                if (
                                  info.recaudado === 0 &&
                                  info.socios === 0
                                ) {
                                  return null;
                                }
                                const medioLower = medio.toLowerCase();
                                const clsMedio = `pill pill-soft pill-mini pill-medio-${medioLower} ${familyClass}`;

                                return (
                                  <div
                                    className="gridtable-row subrow subrow-estado subrow-medio"
                                    role="row"
                                    key={`cm-${i}-c-${idx}-A-${medio}`}
                                  >
                                    <div
                                      className="gridtable-cell"
                                      role="cell"
                                    >
                                      <span className={clsMedio}>
                                        {medio}
                                      </span>
                                    </div>
                                    <div
                                      className="gridtable-cell centers"
                                      role="cell"
                                    >
                                      {/* Esperado vacío */}
                                      <span className="muted">—</span>
                                    </div>
                                    <div
                                      className="gridtable-cell centers"
                                      role="cell"
                                    >
                                      {fmt(info.recaudado)}
                                    </div>
                                    <div
                                      className="gridtable-cell centers"
                                      role="cell"
                                    >
                                      {fmtSocios(info.socios)}
                                    </div>
                                    <div
                                      className="gridtable-cell centers"
                                      role="cell"
                                      style={difStyle(0)}
                                    >
                                      {fmtDif(0)}
                                    </div>
                                  </div>
                                );
                              })}

                            {/* Fila PASIVO */}
                            <div
                              className="gridtable-row subrow subrow-estado"
                              role="row"
                            >
                              <div
                                className="gridtable-cell"
                                role="cell"
                              >
                                <span
                                  className={`pill pill-soft pill-estado pill-estado-pasivo ${familyClass}`}
                                >
                                  PASIVO
                                </span>
                              </div>
                              <div
                                className="gridtable-cell centers"
                                role="cell"
                              >
                                {fmt(cob.porEstado.PASIVO?.esperado || 0)}
                              </div>
                              <div
                                className="gridtable-cell centers"
                                role="cell"
                              >
                                {fmt(cob.porEstado.PASIVO?.recaudado || 0)}
                              </div>
                              <div
                                className="gridtable-cell centers"
                                role="cell"
                              >
                                {fmtSocios(
                                  cob.porEstado.PASIVO?.socios || 0
                                )}
                              </div>
                              <div
                                className="gridtable-cell centers"
                                role="cell"
                                style={difStyle(
                                  (cob.porEstado.PASIVO?.esperado || 0) -
                                    (cob.porEstado.PASIVO?.recaudado || 0)
                                )}
                              >
                                {fmtDif(
                                  (cob.porEstado.PASIVO?.esperado || 0) -
                                    (cob.porEstado.PASIVO?.recaudado || 0)
                                )}
                              </div>
                            </div>

                            {/* SUBSUBFILAS: PASIVO -> medios de pago (solo OFICINA) */}
                            {cob.nombre === "OFICINA" &&
                              MEDIOS_OFICINA.map((medio) => {
                                const info =
                                  cob.porEstado.PASIVO?.porMedio?.[medio] || {
                                    recaudado: 0,
                                    socios: 0,
                                  };
                                if (
                                  info.recaudado === 0 &&
                                  info.socios === 0
                                ) {
                                  return null;
                                }
                                const medioLower = medio.toLowerCase();
                                const clsMedio = `pill pill-soft pill-mini pill-medio-${medioLower} ${familyClass}`;

                                return (
                                  <div
                                    className="gridtable-row subrow subrow-estado subrow-medio"
                                    role="row"
                                    key={`cm-${i}-c-${idx}-P-${medio}`}
                                  >
                                    <div
                                      className="gridtable-cell"
                                      role="cell"
                                    >
                                      <span className={clsMedio}>
                                        {medio}
                                      </span>
                                    </div>
                                    <div
                                      className="gridtable-cell centers"
                                      role="cell"
                                    >
                                      {/* Esperado vacío */}
                                      <span className="muted">—</span>
                                    </div>
                                    <div
                                      className="gridtable-cell centers"
                                      role="cell"
                                    >
                                      {fmt(info.recaudado)}
                                    </div>
                                    <div
                                      className="gridtable-cell centers"
                                      role="cell"
                                    >
                                      {fmtSocios(info.socios)}
                                    </div>
                                    <div
                                      className="gridtable-cell centers"
                                      role="cell"
                                      style={difStyle(0)}
                                    >
                                      {fmtDif(0)}
                                    </div>
                                  </div>
                                );
                              })}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  )}
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
