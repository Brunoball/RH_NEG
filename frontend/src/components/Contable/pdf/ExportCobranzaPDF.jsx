// src/components/Contable/pdf/ExportCobranzaPDF.js
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logo from "../../../imagenes/Logo_rh.jpeg";

/**
 * Genera PDF de "Detalle de Cobranza"
 * @param {Object} opts
 * @param {Array}  opts.rows - [{periodo, esperado, recaudado, diferencia}, ...] (incluye TOTAL AÑO al final)
 * @param {string} opts.fecha
 * @param {string} opts.lineaPeriodo
 * @param {string|number} opts.anio
 * @param {string} opts.periodo
 * @param {string|number} opts.mes
 * @param {string} opts.cobrador
 * @param {Intl.NumberFormat} [opts.nf] - formateador de números (opcional)
 */
export function exportCobranzaPDF({
  rows = [],
  fecha = "",
  lineaPeriodo = "",
  anio,
  periodo,
  mes,
  cobrador,
  nf,
}) {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
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
  doc.text("Detalle de cobranza (Esperado vs Recaudado)", pageWidth / 2, 125, {
    align: "center",
  });

  y = 150;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
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

  /* ========= TABLA PRINCIPAL ========= */
  const head = [["Período", "Esperado", "Recaudado", "Dif. (ESP-REC)"]];

  // Separar filas normales del total
  const regularRows = rows.filter((row) => row.periodo !== "TOTAL AÑO");
  const totalRow = rows.find((row) => row.periodo === "TOTAL AÑO");

  // Cuerpo con info + color por fila
  const body = regularRows.map((r) => {
    const esperado = nf ? `$${nf.format(r.esperado || 0)}` : String(r.esperado || 0);
    const recaudado = nf ? `$${nf.format(r.recaudado || 0)}` : String(r.recaudado || 0);
    const diferencia = r.diferencia || 0;
    const difTxt = nf ? `$${nf.format(Math.abs(diferencia))}` : String(Math.abs(diferencia));

    // Verde si superávit (recaudado >= esperado), rojo si faltante
    const difColor = (r.recaudado || 0) < (r.esperado || 0) ? [220, 53, 69] : [40, 167, 69];

    // Guardamos también el color como 5to item para leerlo en didParseCell
    return [r.periodo, esperado, recaudado, difTxt, difColor];
  });

  // Anchos fijos para centrar la tabla
  const colWidths = [180, 120, 120, 130];
  const tableWidth = colWidths.reduce((sum, w) => sum + w, 0);
  const tableMarginX = (pageWidth - tableWidth) / 2;

  autoTable(doc, {
    startY: y,
    margin: { left: tableMarginX, right: tableMarginX },
    head,
    body: body.map((row) => row.slice(0, 4)),
    styles: {
      fontSize: 10,
      cellPadding: 6,
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
      0: { cellWidth: colWidths[0], halign: "left" },
      1: { cellWidth: colWidths[1], halign: "right" },
      2: { cellWidth: colWidths[2], halign: "right" },
      3: { cellWidth: colWidths[3], halign: "right" },
    },
    theme: "grid",

    // ✅ FIX: aplicar color en TODAS las filas del body (incluida la primera)
    didParseCell(data) {
      if (data.section === "body" && data.column.index === 3) {
        const rowIndex = data.row.index; // índice del body (0,1,2,...)
        const color = body[rowIndex] && body[rowIndex][4];
        if (color) {
          data.cell.styles.textColor = color;
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
  });

  /* ========= TOTAL GENERAL ========= */
  y = doc.lastAutoTable.finalY + 20;

  if (totalRow) {
    const totalEsperado = nf ? `$${nf.format(totalRow.esperado || 0)}` : String(totalRow.esperado || 0);
    const totalRecaudado = nf ? `$${nf.format(totalRow.recaudado || 0)}` : String(totalRow.recaudado || 0);
    const totalDiferencia = totalRow.diferencia || 0;
    const totalDifTxt = nf ? `$${nf.format(Math.abs(totalDiferencia))}` : String(Math.abs(totalDiferencia));

    const totalDifColor =
      (totalRow.recaudado || 0) < (totalRow.esperado || 0) ? [220, 53, 69] : [40, 167, 69];

    // Fondo destacado para el total general - centrado
    const totalWidth = tableWidth;
    const totalMarginX = tableMarginX;

    doc.setFillColor(240, 249, 255);
    doc.rect(totalMarginX, y - 8, totalWidth, 30, "F");

    doc.setDrawColor(37, 99, 235);
    doc.setLineWidth(1);
    doc.rect(totalMarginX, y - 8, totalWidth, 30);

    // Posiciones por columna
    const colPositions = [];
    let currentX = totalMarginX;
    colWidths.forEach((w) => {
      colPositions.push({ start: currentX, end: currentX + w });
      currentX += w;
    });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);

    doc.setTextColor(20);
    doc.text("TOTAL GENERAL", colPositions[0].start + 10, y + 10);

    doc.text(totalEsperado, colPositions[1].end - 10, y + 10, { align: "right" });
    doc.text(totalRecaudado, colPositions[2].end - 10, y + 10, { align: "right" });

    doc.setTextColor(totalDifColor[0], totalDifColor[1], totalDifColor[2]);
    doc.text(totalDifTxt, colPositions[3].end - 10, y + 10, { align: "right" });
  }

  /* ========= PIE ========= */
  y = doc.lastAutoTable.finalY + (totalRow ? 50 : 30);
  doc.setDrawColor(180);
  doc.setLineWidth(0.6);
  doc.line(marginX, y, pageWidth - marginX, y);

  doc.setFont("helvetica", "italic");
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(
    "Documento generado automáticamente por el sistema contable de RH Negativo",
    pageWidth / 2,
    doc.internal.pageSize.getHeight() - 40,
    { align: "center" }
  );

  /* ========= GUARDAR ========= */
  const parts = ["cobranza"];
  if (anio) parts.push(anio);
  if (mes && mes !== "Todos los meses") parts.push(`P${parseInt(mes, 10)}`);
  else if (periodo && periodo !== "Selecciona un periodo")
    parts.push(String(periodo).replace(/\s+/g, "_"));
  if (cobrador && cobrador !== "todos")
    parts.push(String(cobrador).replace(/\s+/g, "_"));

  doc.save(`detalle_cobranza_${parts.join("_")}.pdf`);
}
