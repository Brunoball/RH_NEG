// src/components/Contable/pdf/ExportDetSocPDF.jsx
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logo from "../../../imagenes/Logo_rh.jpeg";

/**
 * Genera PDF de "Detalle de Socios"
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
  const marginX = 50;
  let y = 60;

  /* ========= ENCABEZADO ========= */
  // Logo derecha - MÁS PEQUEÑO
  try {
    const img = new Image();
    img.src = logo;
    // Reducido de 70x70 a 50x50 y ajustada posición
    doc.addImage(img, "JPEG", pageWidth - 110, 35, 50, 50);
  } catch (err) {
    console.warn("No se pudo cargar el logo:", err);
  }

  // Título organización
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Círculo RH Negativo", marginX, 60);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(80);
  doc.text("San Francisco, Córdoba", marginX, 78);

  // Línea divisoria
  doc.setDrawColor(180);
  doc.setLineWidth(0.6);
  doc.line(marginX, 95, pageWidth - marginX, 95);

  // Título principal
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(0);
  doc.text("Detalle de socios por tipo de servicio", pageWidth / 2, 125, {
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
    y += 22;
  }

  /* ========= TABLA ACTIVO ========= */
  const activos = rows.filter((r) => r.servicio === "ACTIVO");
  const pasivos = rows.filter((r) => r.servicio === "PASIVO");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(30);
  doc.text("Servicio: ACTIVO", marginX, y);
  y += 10;

  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX },
    head: [["Categoría", "Cantidad"]],
    body: activos.map((r) => [r.categoria, r.cantidad]),
    styles: {
      fontSize: 11,
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
      0: { cellWidth: "auto", halign: "left" }, 
      1: { halign: "right", cellWidth: 100 } 
    },
    theme: "grid",
  });

  y = doc.lastAutoTable.finalY + 15;
  
  // TOTAL ACTIVO - Mejor alineación
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(0);
  
  // Fondo sutil para el total
  doc.setFillColor(245, 247, 255);
  doc.rect(marginX, y - 8, pageWidth - 2 * marginX, 20, 'F');
  
  // Borde superior
  doc.setDrawColor(200);
  doc.setLineWidth(0.5);
  doc.line(marginX, y - 8, pageWidth - marginX, y - 8);
  
  doc.text("TOTAL ACTIVO:", marginX + 10, y + 5);
  doc.text(String(totales.ACTIVO), pageWidth - marginX - 10, y + 5, { 
    align: "right" 
  });

  // Separador
  y += 25;
  doc.setDrawColor(200);
  doc.setLineWidth(0.8);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 25;

  /* ========= TABLA PASIVO ========= */
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(30);
  doc.text("Servicio: PASIVO", marginX, y);
  y += 10;

  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX },
    head: [["Categoría", "Cantidad"]],
    body: pasivos.map((r) => [r.categoria, r.cantidad]),
    styles: {
      fontSize: 11,
      cellPadding: 6,
      valign: "middle",
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [124, 58, 237],
      textColor: 255,
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [250, 245, 255] },
    columnStyles: { 
      0: { cellWidth: "auto", halign: "left" }, 
      1: { halign: "right", cellWidth: 100 } 
    },
    theme: "grid",
  });

  y = doc.lastAutoTable.finalY + 15;
  
  // TOTAL PASIVO - Mejor alineación
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(0);
  
  // Fondo sutil para el total
  doc.setFillColor(250, 245, 255);
  doc.rect(marginX, y - 8, pageWidth - 2 * marginX, 20, 'F');
  
  // Borde superior
  doc.setDrawColor(200);
  doc.setLineWidth(0.5);
  doc.line(marginX, y - 8, pageWidth - marginX, y - 8);
  
  doc.text("TOTAL PASIVO:", marginX + 10, y + 5);
  doc.text(String(totales.PASIVO), pageWidth - marginX - 10, y + 5, { 
    align: "right" 
  });

  /* ========= TOTAL GENERAL ========= */
  const totalGeneral = (totales.ACTIVO || 0) + (totales.PASIVO || 0);
  y += 35;
  
  // Fondo destacado para el total general
  doc.setFillColor(240, 249, 255);
  doc.rect(marginX, y - 8, pageWidth - 2 * marginX, 25, 'F');
  
  // Borde completo
  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(1);
  doc.rect(marginX, y - 8, pageWidth - 2 * marginX, 25);
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(20);
  doc.text("TOTAL GENERAL:", marginX + 15, y + 8);
  doc.text(String(totalGeneral), pageWidth - marginX - 15, y + 8, { 
    align: "right" 
  });

  // Línea final
  y += 40;
  doc.setDrawColor(180);
  doc.setLineWidth(0.6);
  doc.line(marginX, y, pageWidth - marginX, y);

  // Pie de página
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
  const parts = ["det_soc"];
  if (anio) parts.push(anio);
  if (mes && mes !== "Todos los meses") parts.push(`P${parseInt(mes, 10)}`);
  else if (periodo && periodo !== "Selecciona un periodo")
    parts.push(String(periodo).replace(/\s+/g, "_"));
  if (cobrador && cobrador !== "todos")
    parts.push(String(cobrador).replace(/\s+/g, "_"));

  doc.save(`det_soc_${parts.join("_")}.pdf`);
}