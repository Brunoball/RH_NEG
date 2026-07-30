// src/components/Contable/tables/CobMesTable.jsx
import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFilter,
  faMagnifyingGlass,
  faSpinner,
  faCreditCard,
  faBuilding,
  faHandHoldingDollar,
  faFileSignature,
} from "@fortawesome/free-solid-svg-icons";
import "../dashboard.css";

const upper = (value) => String(value || "").toUpperCase().trim();

const isInscripcion = (pago) =>
  upper(pago?.Mes_Pagado || pago?.mes_pagado) === "INSCRIPCION" ||
  upper(pago?.Tipo_Precio || pago?.tipo_precio) === "I";

const getSocioKey = (pago) => {
  const id = pago?.ID_Socio ?? pago?.id_socio ?? pago?.idSocio ?? null;
  if (id !== null && id !== undefined && String(id).trim() !== "") {
    return `id:${String(id).trim()}`;
  }

  const nombre = upper(
    pago?._nombreCompleto || pago?.Socio || pago?.socio || pago?.Nombre_Completo
  ).replace(/\s+/g, " ");
  return nombre ? `nombre:${nombre}` : null;
};

const sumMoneda = (pagos) =>
  (pagos || []).reduce((acc, pago) => acc + (Number(pago?._precioNum) || 0), 0);

const countSociosUnicos = (pagos) => {
  const socios = new Set();
  (pagos || []).forEach((pago) => {
    const key = getSocioKey(pago);
    if (key) socios.add(key);
  });
  return socios.size;
};

const ICONS = {
  TRANSFERENCIA: faCreditCard,
  OFICINA: faBuilding,
  COBRADOR: faHandHoldingDollar,
};

const ESTADOS_SOCIO = ["ACTIVO", "PASIVO"];
const MEDIOS_OFICINA = ["TRANSFERENCIA", "EFECTIVO"];

export default function CobMesTable({
  loadingResumen,
  periodosVisibles,
  esperadosPorMes,
  esperadosPorMesPorCobrador,
  sociosPorMesPorCobrador,
  getPagosByMonth,
  cobradorSeleccionado,
  mesSeleccionado,
  nfPesos,
  esperadosPorMesPorCobradorEstado,
  sociosPorMesPorCobradorEstado,
}) {
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

  const getAllCobradores = () => {
    const cobradores = new Set();

    Object.keys(esperadosPorMesPorCobrador || {}).forEach((nombre) => {
      const key = upper(nombre);
      if (key) cobradores.add(key);
    });

    for (let mes = 1; mes <= 12; mes += 1) {
      (getPagosByMonth(mes) || []).forEach((pago) => {
        const key = upper(pago?._cb);
        if (key) cobradores.add(key);
      });
    }

    return Array.from(cobradores).sort((a, b) => a.localeCompare(b, "es"));
  };

  const cobradoresAListar = selectedKey ? [selectedKey] : getAllCobradores();

  const paymentsForMonths = (months) => {
    const pagos = [];
    months.forEach((mes) => {
      (getPagosByMonth(mes) || []).forEach((pago) => {
        if (!selectedKey || upper(pago?._cb) === selectedKey) pagos.push(pago);
      });
    });
    return pagos;
  };

  const expectedSocios = (key, months, estado = null) => {
    const source = estado
      ? sociosPorMesPorCobradorEstado?.[key]?.[estado]
      : sociosPorMesPorCobrador?.[key];
    const valores = months.map((mes) => Number(source?.[mes] || 0));

    if (months.length <= 1) return valores.reduce((acc, n) => acc + n, 0);
    return valores.length ? Math.max(...valores) : 0;
  };

  const buildRows = () =>
    (periodosVisibles || []).map((periodo) => {
      const label = periodo.value;
      const periodMonths =
        periodo.months && periodo.months.length
          ? periodo.months
          : (String(label).match(/\d{1,2}/g) || [])
              .map((n) => parseInt(n, 10))
              .filter((n) => n >= 1 && n <= 12);

      const months =
        mesSeleccionado && mesSeleccionado !== "Todos los meses"
          ? [parseInt(mesSeleccionado, 10)]
          : periodMonths;

      const pagosPeriodo = paymentsForMonths(months);
      const pagosCuotas = pagosPeriodo.filter((pago) => !isInscripcion(pago));
      const pagosInscripciones = pagosPeriodo.filter(
        (pago) => isInscripcion(pago) && Number(pago?._precioNum || 0) > 0
      );

      const esperadoPeriodo = months.reduce((acc, mes) => {
        if (selectedKey) {
          return acc + Number(esperadosPorMesPorCobrador?.[selectedKey]?.[mes] || 0);
        }
        return acc + Number(esperadosPorMes?.[mes] || 0);
      }, 0);

      const recaudadoPeriodo = sumMoneda(pagosCuotas);

      const cobradoresListado = cobradoresAListar
        .map((nombre) => {
          const key = upper(nombre);
          const pagosCuotasCobrador = pagosCuotas.filter(
            (pago) => upper(pago?._cb) === key
          );

          const esperado = months.reduce(
            (acc, mes) =>
              acc + Number(esperadosPorMesPorCobrador?.[key]?.[mes] || 0),
            0
          );
          const recaudado = sumMoneda(pagosCuotasCobrador);
          const socios = expectedSocios(key, months);
          const porEstado = {};

          ESTADOS_SOCIO.forEach((estado) => {
            const pagosEstado = pagosCuotasCobrador.filter((pago) => {
              const raw = upper(
                pago?.Estado_Socio ||
                  pago?.estado_socio ||
                  pago?.estado_socio_desc ||
                  pago?.estado_socio_descripcion
              );
              const normalizado = raw === "PASIVO" ? "PASIVO" : "ACTIVO";
              return normalizado === estado;
            });

            const esperadoEstado = months.reduce(
              (acc, mes) =>
                acc +
                Number(
                  esperadosPorMesPorCobradorEstado?.[key]?.[estado]?.[mes] || 0
                ),
              0
            );

            const porMedio = {};
            pagosEstado.forEach((pago) => {
              const medio = upper(
                pago?.Medio_Pago || pago?.medio_pago_nombre || pago?.medio_pago
              );
              if (!medio) return;
              if (!porMedio[medio]) porMedio[medio] = { pagos: [] };
              porMedio[medio].pagos.push(pago);
            });

            Object.keys(porMedio).forEach((medio) => {
              const pagosMedio = porMedio[medio].pagos;
              porMedio[medio] = {
                recaudado: sumMoneda(pagosMedio),
                socios: countSociosUnicos(pagosMedio),
              };
            });

            porEstado[estado] = {
              esperado: esperadoEstado,
              recaudado: sumMoneda(pagosEstado),
              socios: expectedSocios(key, months, estado),
              porMedio,
            };
          });

          return {
            nombre: key,
            esperado,
            recaudado,
            socios,
            porEstado,
            icon: ICONS[key] || faHandHoldingDollar,
          };
        })
        .filter(
          (cobrador) =>
            cobrador.esperado > 0 ||
            cobrador.recaudado > 0 ||
            cobrador.socios > 0
        );

      return {
        label,
        esperado: esperadoPeriodo,
        recaudado: recaudadoPeriodo,
        diferencia: esperadoPeriodo - recaudadoPeriodo,
        sociosPeriodo: cobradoresListado.reduce(
          (acc, cobrador) => acc + Number(cobrador.socios || 0),
          0
        ),
        cobradoresListado,
        inscripciones: {
          pagos: pagosInscripciones,
          recaudado: sumMoneda(pagosInscripciones),
          socios: countSociosUnicos(pagosInscripciones),
        },
      };
    });

  const rows = buildRows();

  const totalesCuotas = rows.reduce(
    (acc, row) => {
      acc.esperado += row.esperado;
      acc.recaudado += row.recaudado;
      acc.socios = Math.max(acc.socios, row.sociosPeriodo || 0);
      return acc;
    },
    { esperado: 0, recaudado: 0, socios: 0 }
  );

  const pagosInscripcionesTotal = rows.flatMap(
    (row) => row.inscripciones?.pagos || []
  );
  const totalInscripciones = {
    recaudado: sumMoneda(pagosInscripcionesTotal),
    socios: countSociosUnicos(pagosInscripcionesTotal),
  };

  const totalDif = totalesCuotas.esperado - totalesCuotas.recaudado;
  const totalIngresado = totalesCuotas.recaudado + totalInscripciones.recaudado;
  const noPeriodos = (periodosVisibles || []).length === 0;

  const fmt = (num) => `$ ${nfPesos.format(Number(num || 0))}`;
  const fmtDif = (num) => `$ ${nfPesos.format(Math.abs(Number(num || 0)))}`;
  const fmtSocios = (num) => nfPesos.format(Number(num || 0));
  const difStyle = (num) => ({
    color: Number(num || 0) <= 0 ? "#16a34a" : "#ef4444",
    fontWeight: 600,
  });

  return (
    <section
      className="resumen-wrap cobmes-section"
      aria-label="Cobros por mes o período"
    >
      <div
        className={`contable-tablewrap ${loadingResumen ? "is-loading" : ""}`}
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
          <div
            className="gridtable-cell centers"
            role="columnheader"
            title="En cuotas muestra socios esperados; en inscripciones, socios que pagaron."
          >
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
              {rows.map((row, rowIndex) => (
                <React.Fragment key={`periodo-${rowIndex}`}>
                  <div className="gridtable-row cobmestable-row" role="row">
                    <div className="gridtable-cell" role="cell">
                      {row.label}
                    </div>
                    <div className="gridtable-cell centers" role="cell">
                      {fmt(row.esperado)}
                    </div>
                    <div className="gridtable-cell centers" role="cell">
                      {fmt(row.recaudado)}
                    </div>
                    <div className="gridtable-cell centers" role="cell">
                      {fmtSocios(row.sociosPeriodo)}
                    </div>
                    <div
                      className="gridtable-cell centers"
                      role="cell"
                      style={difStyle(row.diferencia)}
                    >
                      {fmtDif(row.diferencia)}
                    </div>
                  </div>

                  {row.cobradoresListado.length > 0 && (
                    <div className="gridtable-subrows">
                      {row.cobradoresListado.map((cobrador, cobradorIndex) => {
                        const familyClass = getFamilyClass(cobrador.nombre);
                        const difCobrador = cobrador.esperado - cobrador.recaudado;

                        return (
                          <React.Fragment
                            key={`periodo-${rowIndex}-cobrador-${cobradorIndex}`}
                          >
                            <div className="gridtable-row subrow" role="row">
                              <div className="gridtable-cell" role="cell">
                                <span
                                  className={`pill pill-light pill-cobrador ${familyClass}`}
                                >
                                  <FontAwesomeIcon icon={cobrador.icon} />{" "}
                                  {cobrador.nombre}
                                </span>
                              </div>
                              <div className="gridtable-cell centers" role="cell">
                                {fmt(cobrador.esperado)}
                              </div>
                              <div className="gridtable-cell centers" role="cell">
                                {fmt(cobrador.recaudado)}
                              </div>
                              <div className="gridtable-cell centers" role="cell">
                                {fmtSocios(cobrador.socios)}
                              </div>
                              <div
                                className="gridtable-cell centers"
                                role="cell"
                                style={difStyle(difCobrador)}
                              >
                                {fmtDif(difCobrador)}
                              </div>
                            </div>

                            {ESTADOS_SOCIO.map((estado) => {
                              const detalle = cobrador.porEstado?.[estado] || {
                                esperado: 0,
                                recaudado: 0,
                                socios: 0,
                                porMedio: {},
                              };
                              const difEstado = detalle.esperado - detalle.recaudado;
                              const estadoClass =
                                estado === "PASIVO"
                                  ? "pill-estado-pasivo"
                                  : "pill-estado-activo";

                              return (
                                <React.Fragment
                                  key={`periodo-${rowIndex}-cobrador-${cobradorIndex}-${estado}`}
                                >
                                  <div
                                    className="gridtable-row subrow subrow-estado"
                                    role="row"
                                  >
                                    <div className="gridtable-cell" role="cell">
                                      <span
                                        className={`pill pill-soft pill-estado ${estadoClass} ${familyClass}`}
                                      >
                                        {estado}
                                      </span>
                                    </div>
                                    <div
                                      className="gridtable-cell centers"
                                      role="cell"
                                    >
                                      {fmt(detalle.esperado)}
                                    </div>
                                    <div
                                      className="gridtable-cell centers"
                                      role="cell"
                                    >
                                      {fmt(detalle.recaudado)}
                                    </div>
                                    <div
                                      className="gridtable-cell centers"
                                      role="cell"
                                    >
                                      {fmtSocios(detalle.socios)}
                                    </div>
                                    <div
                                      className="gridtable-cell centers"
                                      role="cell"
                                      style={difStyle(difEstado)}
                                    >
                                      {fmtDif(difEstado)}
                                    </div>
                                  </div>

                                  {cobrador.nombre === "OFICINA" &&
                                    MEDIOS_OFICINA.map((medio) => {
                                      const info = detalle.porMedio?.[medio] || {
                                        recaudado: 0,
                                        socios: 0,
                                      };
                                      if (!info.recaudado && !info.socios) return null;

                                      return (
                                        <div
                                          className="gridtable-row subrow subrow-estado subrow-medio"
                                          role="row"
                                          key={`periodo-${rowIndex}-cobrador-${cobradorIndex}-${estado}-${medio}`}
                                        >
                                          <div className="gridtable-cell" role="cell">
                                            <span
                                              className={`pill pill-soft pill-mini pill-medio-${medio.toLowerCase()} ${familyClass}`}
                                            >
                                              {medio}
                                            </span>
                                          </div>
                                          <div
                                            className="gridtable-cell centers muted"
                                            role="cell"
                                          >
                                            —
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
                                            className="gridtable-cell centers muted"
                                            role="cell"
                                          >
                                            —
                                          </div>
                                        </div>
                                      );
                                    })}
                                </React.Fragment>
                              );
                            })}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  )}

                  {(row.inscripciones.recaudado > 0 ||
                    row.inscripciones.socios > 0) && (
                    <div
                      className="gridtable-row subrow subrow-inscripcion"
                      role="row"
                    >
                      <div className="gridtable-cell" role="cell">
                        <span className="pill pill-light pill-inscripcion">
                          <FontAwesomeIcon icon={faFileSignature} /> INSCRIPCIONES
                        </span>
                      </div>
                      <div className="gridtable-cell centers muted" role="cell">
                        —
                      </div>
                      <div className="gridtable-cell centers" role="cell">
                        {fmt(row.inscripciones.recaudado)}
                      </div>
                      <div className="gridtable-cell centers" role="cell">
                        {fmtSocios(row.inscripciones.socios)}
                      </div>
                      <div className="gridtable-cell centers muted" role="cell">
                        —
                      </div>
                    </div>
                  )}
                </React.Fragment>
              ))}

              <div className="gridtable-row cobmes-total" role="row">
                <div className="gridtable-cell" role="cell">
                  TOTAL CUOTAS
                </div>
                <div className="gridtable-cell centers" role="cell">
                  {fmt(totalesCuotas.esperado)}
                </div>
                <div className="gridtable-cell centers" role="cell">
                  {fmt(totalesCuotas.recaudado)}
                </div>
                <div className="gridtable-cell centers" role="cell">
                  {fmtSocios(totalesCuotas.socios)}
                </div>
                <div
                  className="gridtable-cell centers"
                  role="cell"
                  style={difStyle(totalDif)}
                >
                  {fmtDif(totalDif)}
                </div>
              </div>

              {(totalInscripciones.recaudado > 0 ||
                totalInscripciones.socios > 0) && (
                <>
                  <div
                    className="gridtable-row cobmes-total cobmes-total-inscripciones"
                    role="row"
                  >
                    <div className="gridtable-cell" role="cell">
                      TOTAL INSCRIPCIONES
                    </div>
                    <div className="gridtable-cell centers muted" role="cell">
                      —
                    </div>
                    <div className="gridtable-cell centers" role="cell">
                      {fmt(totalInscripciones.recaudado)}
                    </div>
                    <div className="gridtable-cell centers" role="cell">
                      {fmtSocios(totalInscripciones.socios)}
                    </div>
                    <div className="gridtable-cell centers muted" role="cell">
                      —
                    </div>
                  </div>
                  <div
                    className="gridtable-row cobmes-total cobmes-total-ingresado"
                    role="row"
                  >
                    <div className="gridtable-cell" role="cell">
                      TOTAL INGRESADO
                    </div>
                    <div className="gridtable-cell centers muted" role="cell">
                      —
                    </div>
                    <div className="gridtable-cell centers" role="cell">
                      {fmt(totalIngresado)}
                    </div>
                    <div className="gridtable-cell centers muted" role="cell">
                      —
                    </div>
                    <div className="gridtable-cell centers muted" role="cell">
                      —
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
