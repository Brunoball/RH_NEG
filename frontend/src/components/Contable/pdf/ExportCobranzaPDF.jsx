// src/components/Contable/pdf/ExportCobranzaPDF.js
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logo from "../../../imagenes/Logo_rh.jpeg";

/**
 * Genera PDF de "Detalle de Cobranza" con toda la tabla jerárquica
 * 
 * @param {Object} opts
 * @param {Array} opts.rows - Array de filas de la tabla CobMesTable
 * @param {Array} opts.periodosVisibles - Periodos a mostrar
 * @param {Object} opts.esperadosPorMes - Esperado por mes
 * @param {Object} opts.esperadosPorMesPorCobrador - Esperado por cobrador y mes
 * @param {Object} opts.sociosPorMesPorCobrador - Socios por cobrador y mes
 * @param {Function} opts.getPagosByMonth - Función para obtener pagos por mes
 * @param {string} opts.cobradorSeleccionado - Cobrador seleccionado
 * @param {string|number} opts.mesSeleccionado - Mes seleccionado
 * @param {Intl.NumberFormat} opts.nfPesos - Formateador de números
 * @param {Object} opts.esperadosPorMesPorCobradorEstado - Esperado por cobrador, estado y mes
 * @param {Object} opts.sociosPorMesPorCobradorEstado - Socios por cobrador, estado y mes
 * @param {string} opts.fecha - Fecha de impresión
 * @param {string} opts.lineaPeriodo - Línea de período
 * @param {string|number} opts.anio - Año seleccionado
 * @param {string} opts.periodo - Período seleccionado
 * @param {string} opts.cobrador - Cobrador seleccionado
 * @param {Array} opts.categoriasMonto - Categorías con montos (monto por período)
 */
export function exportCobranzaPDF({
  rows = [],
  periodosVisibles = [],
  esperadosPorMes = {},
  esperadosPorMesPorCobrador = {},
  sociosPorMesPorCobrador = {},
  getPagosByMonth = () => [],
  cobradorSeleccionado = "todos",
  mesSeleccionado = "Todos los meses",
  nfPesos,
  esperadosPorMesPorCobradorEstado = {},
  sociosPorMesPorCobradorEstado = {},
  fecha = "",
  lineaPeriodo = "",
  anio,
  periodo,
  cobrador,

  // 🔹 NUEVO: montos por categoría
  categoriasMonto = [],
}) {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 40;
  let y = 60;

  /* ========= ENCABEZADO ========= */
  try {
    const img = new Image();
    img.src = logo;
    doc.addImage(img, "JPEG", pageWidth - 110, 35, 50, 50);
  } catch (err) {
    console.warn("No se pudo cargar el logo:", err);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Círculo RH Negativo", marginX, 60);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(80);
  doc.text("San Francisco, Córdoba", marginX, 78);

  doc.setDrawColor(180);
  doc.setLineWidth(0.6);
  doc.line(marginX, 95, pageWidth - marginX, 95);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(0);
  doc.text(
    "Detalle de cobranza (Esperado vs Recaudado)",
    pageWidth / 2,
    125,
    { align: "center" }
  );

  // Bloque de contexto
  y = 150;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(40);

  if (fecha) {
    doc.text(`Fecha de impresión: ${fecha}`, marginX, y);
    y += 16;
  }
  if (lineaPeriodo) {
    doc.text(lineaPeriodo, marginX, y);
    y += 16;
  }
  if (cobrador && cobrador !== "todos") {
    doc.text(`Cobrador: ${cobrador}`, marginX, y);
    y += 22;
  }

  /* ========= MONTOS POR CATEGORÍA (MONTO POR PERÍODO) ========= */
  if (categoriasMonto && categoriasMonto.length) {
    // Título del bloque
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(20);
    doc.text("Montos por categoría (monto por período):", marginX, y);
    y += 14;

    // Detalle de cada categoría
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(40);

    categoriasMonto.forEach((cat) => {
      const nombre = cat.nombre_categoria || "-";

      const montoNum = Number(cat.monto_mensual || 0);
      const montoTxt =
        cat.monto_mensual_fmt ||
        (nfPesos ? `$${nfPesos.format(montoNum)}` : String(montoNum ?? 0));

      const sociosTxt = cat.cant_socios
        ? ` (${cat.cant_socios} socios)`
        : "";

      doc.text(`• ${nombre}: ${montoTxt}${sociosTxt}`, marginX + 8, y);
      y += 12;
    });

    y += 8; // pequeño espacio antes de la tabla principal
  }

  /* ========= CONSTRUIR DATOS DE LA TABLA JERÁRQUICA ========= */
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
    (pagos || []).reduce(
      (acc, pago) => acc + (Number(pago?._precioNum) || 0),
      0
    );

  const countSociosUnicos = (pagos) => {
    const socios = new Set();
    (pagos || []).forEach((pago) => {
      const key = getSocioKey(pago);
      if (key) socios.add(key);
    });
    return socios.size;
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
  const ESTADOS_SOCIO = ["ACTIVO", "PASIVO"];
  const MEDIOS_OFICINA = ["TRANSFERENCIA", "EFECTIVO"];

  const pagosParaMeses = (months) => {
    const pagos = [];
    months.forEach((mes) => {
      (getPagosByMonth(mes) || []).forEach((pago) => {
        if (!selectedKey || upper(pago?._cb) === selectedKey) pagos.push(pago);
      });
    });
    return pagos;
  };

  const sociosEsperados = (key, months, estado = null) => {
    const source = estado
      ? sociosPorMesPorCobradorEstado?.[key]?.[estado]
      : sociosPorMesPorCobrador?.[key];
    const valores = months.map((mes) => Number(source?.[mes] || 0));
    if (months.length <= 1) return valores.reduce((acc, n) => acc + n, 0);
    return valores.length ? Math.max(...valores) : 0;
  };

  const periodosData = (periodosVisibles || []).map((periodoVisible) => {
    const label = periodoVisible.value;
    const periodMonths =
      periodoVisible.months && periodoVisible.months.length
        ? periodoVisible.months
        : (String(label).match(/\d{1,2}/g) || [])
            .map((n) => parseInt(n, 10))
            .filter((n) => n >= 1 && n <= 12);

    const months =
      mesSeleccionado && mesSeleccionado !== "Todos los meses"
        ? [parseInt(mesSeleccionado, 10)]
        : periodMonths;

    const pagosPeriodo = pagosParaMeses(months);
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

          const porMedioRaw = {};
          pagosEstado.forEach((pago) => {
            const medio = upper(
              pago?.Medio_Pago || pago?.medio_pago_nombre || pago?.medio_pago
            );
            if (!medio) return;
            if (!porMedioRaw[medio]) porMedioRaw[medio] = [];
            porMedioRaw[medio].push(pago);
          });

          const porMedio = {};
          Object.entries(porMedioRaw).forEach(([medio, pagos]) => {
            porMedio[medio] = {
              recaudado: sumMoneda(pagos),
              socios: countSociosUnicos(pagos),
            };
          });

          porEstado[estado] = {
            esperado: esperadoEstado,
            recaudado: sumMoneda(pagosEstado),
            socios: sociosEsperados(key, months, estado),
            porMedio,
          };
        });

        return {
          nombre: key,
          esperado,
          recaudado,
          socios: sociosEsperados(key, months),
          porEstado,
        };
      })
      .filter(
        (item) => item.esperado > 0 || item.recaudado > 0 || item.socios > 0
      );

    const recaudadoPeriodo = sumMoneda(pagosCuotas);

    return {
      label,
      esperado: esperadoPeriodo,
      recaudado: recaudadoPeriodo,
      diferencia: esperadoPeriodo - recaudadoPeriodo,
      sociosPeriodo: cobradoresListado.reduce(
        (acc, item) => acc + Number(item.socios || 0),
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

  const totalesCuotas = periodosData.reduce(
    (acc, item) => {
      acc.esperado += item.esperado;
      acc.recaudado += item.recaudado;
      acc.socios = Math.max(acc.socios, item.sociosPeriodo || 0);
      return acc;
    },
    { esperado: 0, recaudado: 0, socios: 0 }
  );

  const pagosInscripcionesTotal = periodosData.flatMap(
    (item) => item.inscripciones?.pagos || []
  );
  const totalesInscripciones = {
    recaudado: sumMoneda(pagosInscripcionesTotal),
    socios: countSociosUnicos(pagosInscripcionesTotal),
  };

  const totalDif = totalesCuotas.esperado - totalesCuotas.recaudado;
  const totalIngresado =
    totalesCuotas.recaudado + totalesInscripciones.recaudado;

  const fmtMoney = (num) =>
    nfPesos ? `$${nfPesos.format(Number(num || 0))}` : String(num ?? 0);
  const fmtInt = (num) =>
    nfPesos ? nfPesos.format(Number(num || 0)) : String(num ?? 0);

  /* ========= PREPARAR FILAS PARA PDF ========= */
  const head = [
    ["Período / Detalle", "Esperado", "Recaudado", "Socios", "Dif. (ESP-REC)"],
  ];
  const body = [];

  periodosData.forEach((periodoData) => {
    body.push([
      periodoData.label,
      fmtMoney(periodoData.esperado),
      fmtMoney(periodoData.recaudado),
      fmtInt(periodoData.sociosPeriodo),
      fmtMoney(Math.abs(periodoData.diferencia)),
      periodoData.diferencia <= 0 ? [40, 167, 69] : [220, 53, 69],
      0,
    ]);

    periodoData.cobradoresListado.forEach((cobradorData) => {
      const difCobrador = cobradorData.esperado - cobradorData.recaudado;
      body.push([
        `  • ${cobradorData.nombre}`,
        fmtMoney(cobradorData.esperado),
        fmtMoney(cobradorData.recaudado),
        fmtInt(cobradorData.socios),
        fmtMoney(Math.abs(difCobrador)),
        difCobrador <= 0 ? [40, 167, 69] : [220, 53, 69],
        1,
      ]);

      ESTADOS_SOCIO.forEach((estado) => {
        const detalle = cobradorData.porEstado?.[estado];
        if (!detalle || (!detalle.esperado && !detalle.recaudado && !detalle.socios)) {
          return;
        }

        const difEstado = detalle.esperado - detalle.recaudado;
        body.push([
          `      - ${estado}`,
          fmtMoney(detalle.esperado),
          fmtMoney(detalle.recaudado),
          fmtInt(detalle.socios),
          fmtMoney(Math.abs(difEstado)),
          difEstado <= 0 ? [40, 167, 69] : [220, 53, 69],
          2,
        ]);

        if (cobradorData.nombre === "OFICINA") {
          MEDIOS_OFICINA.forEach((medio) => {
            const info = detalle.porMedio?.[medio];
            if (!info || (!info.recaudado && !info.socios)) return;
            body.push([
              `        └ ${medio}`,
              "—",
              fmtMoney(info.recaudado),
              fmtInt(info.socios),
              "—",
              [107, 114, 128],
              3,
            ]);
          });
        }
      });
    });

    if (
      periodoData.inscripciones.recaudado > 0 ||
      periodoData.inscripciones.socios > 0
    ) {
      body.push([
        "  ↳ INSCRIPCIONES",
        "—",
        fmtMoney(periodoData.inscripciones.recaudado),
        fmtInt(periodoData.inscripciones.socios),
        "—",
        [107, 114, 128],
        4,
      ]);
    }

    body.push(["", "", "", "", "", null, 8]);
  });

  body.push([
    "TOTAL CUOTAS",
    fmtMoney(totalesCuotas.esperado),
    fmtMoney(totalesCuotas.recaudado),
    fmtInt(totalesCuotas.socios),
    fmtMoney(Math.abs(totalDif)),
    totalDif <= 0 ? [40, 167, 69] : [220, 53, 69],
    5,
  ]);

  if (totalesInscripciones.recaudado > 0 || totalesInscripciones.socios > 0) {
    body.push([
      "TOTAL INSCRIPCIONES",
      "—",
      fmtMoney(totalesInscripciones.recaudado),
      fmtInt(totalesInscripciones.socios),
      "—",
      [107, 114, 128],
      6,
    ]);
    body.push([
      "TOTAL INGRESADO",
      "—",
      fmtMoney(totalIngresado),
      "—",
      "—",
      [37, 99, 235],
      7,
    ]);
  }

  /* ========= TABLA PRINCIPAL ========= */
  const colWidths = [220, 90, 90, 70, 90];
  const tableWidth = colWidths.reduce((sum, w) => sum + w, 0);
  const tableMarginX = (pageWidth - tableWidth) / 2;

  autoTable(doc, {
    startY: y,
    margin: { left: tableMarginX, right: tableMarginX },
    head,
    body: body.map((row) => row.slice(0, 5)),
    styles: {
      fontSize: 9,
      cellPadding: 4,
      valign: "middle",
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [37, 99, 235],
      textColor: 255,
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [245, 247, 255] },
    columnStyles: {
      0: { 
        cellWidth: colWidths[0], 
        halign: "left",
        cellPadding: { left: 8, right: 4, top: 4, bottom: 4 },
      },
      1: { cellWidth: colWidths[1], halign: "right" },
      2: { cellWidth: colWidths[2], halign: "right" },
      3: { cellWidth: colWidths[3], halign: "right" },
      4: { cellWidth: colWidths[4], halign: "right" },
    },
    theme: "grid",
    
    didParseCell: (data) => {
      // Estilo según nivel de jerarquía
      if (data.section === "body") {
        const nivel = body[data.row.index]?.[6] || 0;
        
        // Indentación y estilo según nivel
        if (data.column.index === 0) {
          switch (nivel) {
            case 0: // Período
              data.cell.styles.fontStyle = "bold";
              data.cell.styles.fillColor = [240, 249, 255];
              break;
            case 1: // Cobrador
              data.cell.styles.fontStyle = "bold";
              break;
            case 2: // Estado
              data.cell.styles.fontStyle = "italic";
              break;
            case 3: // Medio
              data.cell.styles.fontSize = 8.5;
              break;
            case 4: // Inscripción del período
              data.cell.styles.fontStyle = "bold";
              data.cell.styles.textColor = [124, 58, 237];
              break;
            case 5: // Total cuotas
            case 6: // Total inscripciones
            case 7: // Total ingresado
              data.cell.styles.fontStyle = "bold";
              break;
          }
        }
        
        // Color para columna de diferencia
        if (data.column.index === 4) {
          const color = body[data.row.index]?.[5];
          if (color) {
            data.cell.styles.textColor = color;
            data.cell.styles.fontStyle = "bold";
          }
        }
        
        const rowLabel = body[data.row.index]?.[0];
        if (rowLabel === "TOTAL CUOTAS") {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [219, 234, 254];
          data.cell.styles.textColor = [30, 64, 175];
        }
        if (rowLabel === "TOTAL INSCRIPCIONES") {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [237, 233, 254];
          data.cell.styles.textColor = [109, 40, 217];
        }
        if (rowLabel === "TOTAL INGRESADO") {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [37, 99, 235];
          data.cell.styles.textColor = 255;
        }
      }
    },
  });

  /* ========= PIE ========= */
  const footerY = Math.max(doc.lastAutoTable.finalY + 50, pageHeight - 60);
  doc.setDrawColor(180);
  doc.setLineWidth(0.6);
  doc.line(marginX, footerY, pageWidth - marginX, footerY);

  doc.setFont("helvetica", "italic");
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(
    "Documento generado automáticamente por el sistema contable de RH Negativo",
    pageWidth / 2,
    pageHeight - 40,
    { align: "center" }
  );

  /* ========= NOMBRE DEL ARCHIVO ========= */
  const parts = ["cobranza"];
  if (anio) parts.push(anio);
  if (mesSeleccionado && mesSeleccionado !== "Todos los meses") {
    parts.push(`P${parseInt(mesSeleccionado, 10)}`);
  } else if (periodo && periodo !== "Selecciona un periodo") {
    parts.push(String(periodo).replace(/\s+/g, "_"));
  }
  if (cobrador && cobrador !== "todos") {
    parts.push(String(cobrador).replace(/\s+/g, "_"));
  }

  doc.save(`detalle_cobranza_completo_${parts.join("_")}.pdf`);
}
