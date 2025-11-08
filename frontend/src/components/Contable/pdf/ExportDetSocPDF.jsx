// src/components/Contable/pdf/ExportDetSocPDF.js
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/**
 * Genera PDF de "Detalle de Socios"
 * @param {Object} opts
 * @param {Array}  opts.rows - [{servicio:'ACTIVO'|'PASIVO', categoria:'A', cantidad: N}, ...]
 * @param {Object} opts.totales - { ACTIVO: N, PASIVO: N }
 * @param {string} opts.fecha - texto fecha impresión
 * @param {string} opts.lineaPeriodo - texto debajo del título (periodo/año)
 * @param {string|number} opts.anio
 * @param {string} opts.periodo
 * @param {string|number} opts.mes
 * @param {string} opts.cobrador
 */
export function exportDetSocPDF({
  rows = [],
  totales = { ACTIVO: 0, PASIVO: 0 },
  fecha = "",
  lineaPeriodo = "",
  anio,
  periodo,
  mes,
  cobrador,
}) {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 40;
  let y = 52;

  // Encabezado
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Detalle de socios por tipo de servicio", pageWidth / 2, y, { align: "center" });
  y += 26;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  if (fecha) {
    doc.text(`Fecha de impresión: ${fecha}`, marginX, y);
    y += 16;
  }
  if (lineaPeriodo) {
    doc.text(lineaPeriodo, marginX, y);
    y += 20;
  }

  // Encabezado de tabla visual
  doc.setFont("helvetica", "bold");
  doc.text("Servicio", marginX, y);
  doc.text("Categoría", marginX + 220, y);
  doc.text("Cantidad", pageWidth - marginX - 70, y, { align: "right" });
  y += 6;
  doc.setLineWidth(0.8);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 12;

  const activos = rows.filter((r) => r.servicio === "ACTIVO");
  const pasivos = rows.filter((r) => r.servicio === "PASIVO");

  // ACTIVO
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("ACTIVO", marginX, y);
  y += 10;

  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX },
    head: [["", "Categoría", "Cantidad"]],
    body: activos.map((r) => ["", r.categoria, r.cantidad]),
    styles: { fontSize: 11, cellPadding: 6 },
    headStyles: { fillColor: [255, 255, 255], textColor: 0, fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 0 }, 1: { cellWidth: 260 }, 2: { cellWidth: 100, halign: "right" } },
    theme: "plain",
  });
  y = doc.lastAutoTable.finalY + 6;

  doc.setFont("helvetica", "bold");
  doc.text("TOTAL:", marginX + 220, y);
  doc.text(String(totales.ACTIVO), pageWidth - marginX, y, { align: "right" });
  y += 18;

  doc.setDrawColor(150);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 14;

  // PASIVO
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("PASIVO", marginX, y);
  y += 10;

  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX },
    head: [["", "Categoría", "Cantidad"]],
    body: pasivos.map((r) => ["", r.categoria, r.cantidad]),
    styles: { fontSize: 11, cellPadding: 6 },
    headStyles: { fillColor: [255, 255, 255], textColor: 0, fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 0 }, 1: { cellWidth: 260 }, 2: { cellWidth: 100, halign: "right" } },
    theme: "plain",
  });
  y = doc.lastAutoTable.finalY + 6;

  doc.setFont("helvetica", "bold");
  doc.text("TOTAL:", marginX + 220, y);
  doc.text(String(totales.PASIVO), pageWidth - marginX, y, { align: "right" });

  const parts = ["det_soc"];
  if (anio) parts.push(anio);
  if (mes && mes !== "Todos los meses") parts.push(`P${parseInt(mes, 10)}`);
  else if (periodo && periodo !== "Selecciona un periodo") parts.push(String(periodo).replace(/\s+/g, "_"));
  if (cobrador && cobrador !== "todos") parts.push(String(cobrador).replace(/\s+/g, "_"));

  doc.save(`det_soc_${parts.join("_")}.pdf`);
}
