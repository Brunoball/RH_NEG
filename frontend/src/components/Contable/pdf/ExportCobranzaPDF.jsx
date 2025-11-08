// src/components/Contable/pdf/ExportCobranzaPDF.js
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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
  let y = 52;

  // Encabezado
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Detalle de cobranza (Esperado vs Recaudado)", pageWidth / 2, y, { align: "center" });
  y += 26;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  if (fecha) {
    doc.text(`Fecha de impresión: ${fecha}`, marginX, y);
    y += 16;
  }
  if (lineaPeriodo) {
    doc.text(lineaPeriodo, marginX, y);
    y += 12;
  }
  if (cobrador && cobrador !== "todos") {
    doc.text(`Cobrador: ${cobrador}`, marginX, y);
    y += 14;
  }

  // Tabla
  const head = [["Período", "Esperado", "Recaudado", "Dif. (ESP-REC)"]];
  const body = rows.map((r) => {
    const esperado = nf ? `$${nf.format(r.esperado || 0)}` : String(r.esperado || 0);
    const recaudado = nf ? `$${nf.format(r.recaudado || 0)}` : String(r.recaudado || 0);
    const diferencia = (r.diferencia || 0);
    const difTxt = (nf ? `$${nf.format(Math.abs(diferencia))}` : String(Math.abs(diferencia)));
    const difStr = `${diferencia < 0 ? "-" : ""}${difTxt}`;
    return [r.periodo, esperado, recaudado, difStr];
  });

  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX },
    head,
    body,
    styles: { fontSize: 11, cellPadding: 6 },
    headStyles: { fillColor: [245, 245, 245], textColor: 0, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 200 },
      1: { cellWidth: 110, halign: "right" },
      2: { cellWidth: 110, halign: "right" },
      3: { cellWidth: 140, halign: "right" },
    },
    theme: "striped",
  });

  const parts = ["cobranza"];
  if (anio) parts.push(anio);
  if (mes && mes !== "Todos los meses") parts.push(`P${parseInt(mes, 10)}`);
  else if (periodo && periodo !== "Selecciona un periodo") parts.push(String(periodo).replace(/\s+/g, "_"));
  if (cobrador && cobrador !== "todos") parts.push(String(cobrador).replace(/\s+/g, "_"));

  doc.save(`detalle_cobranza_${parts.join("_")}.pdf`);
}
