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
  
  // Helper para sumar montos
  const sumMoneda = (arr) =>
    arr.reduce((acc, p) => acc + (Number(p?._precioNum) || 0), 0);
  
  const upper = (s) => String(s || "").toUpperCase().trim();
  
  // Obtener todos los cobradores
  const getAllCobradores = () => {
    const cobradoresSet = new Set();
    
    if (esperadosPorMesPorCobrador) {
      Object.keys(esperadosPorMesPorCobrador).forEach((cob) => {
        cobradoresSet.add(cob);
      });
    }
    
    const allMonths = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    allMonths.forEach((m) => {
      const pagosMes = getPagosByMonth(m) || [];
      pagosMes.forEach((p) => {
        if (p._cb) cobradoresSet.add(upper(p._cb));
      });
    });
    
    return Array.from(cobradoresSet).sort((a, b) => a.localeCompare(b, "es"));
  };
  
  const selectedKey =
    cobradorSeleccionado && cobradorSeleccionado !== "todos"
      ? upper(cobradorSeleccionado)
      : null;

  const cobradoresAListar = selectedKey ? [selectedKey] : getAllCobradores();
  
  // Estados de socio
  const ESTADOS_SOCIO = ["ACTIVO", "PASIVO"];
  
  // Medios de pago para OFICINA
  const MEDIOS_OFICINA = ["TRANSFERENCIA", "EFECTIVO"];
  
  // Construir datos para cada período
  const periodosData = (periodosVisibles || []).map((p) => {
    const label = p.value;
    const months = p.months && p.months.length
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
      const pagosMes = (getPagosByMonth(m) || []).filter((pg) =>
        !selectedKey
          ? true
          : upper(pg._cb) === selectedKey ||
            upper(pg.id_cobrador ?? "") === selectedKey
      );
      recaudadoPeriodo += sumMoneda(pagosMes);
      
      if (selectedKey) {
        esperadoPeriodo += Number(
          esperadosPorMesPorCobrador?.[selectedKey]?.[m] || 0
        );
      } else {
        esperadoPeriodo += Number(esperadosPorMes?.[m] || 0);
      }
    });
    
    // Cobradores dentro del período
    const cobradoresListado = cobradoresAListar
      .map((nombre) => {
        const key = upper(nombre);
        let esperado = 0;
        let recaudado = 0;
        const sociosMeses = [];
        
        for (const m of monthsToUse) {
          esperado += Number(esperadosPorMesPorCobrador?.[key]?.[m] || 0);
          
          const pagosMes = (getPagosByMonth(m) || []).filter(
            (pg) => upper(pg._cb) === key
          );
          recaudado += sumMoneda(pagosMes);
          
          const sociosMes = Number(
            sociosPorMesPorCobrador?.[key]?.[m] || 0
          );
          sociosMeses.push(sociosMes);
        }
        
        let socios = 0;
        if (monthsToUse.length <= 1) {
          socios = sociosMeses.reduce((a, b) => a + b, 0);
        } else {
          socios = sociosMeses.length ? Math.max(...sociosMeses) : 0;
        }
        
        // Datos por estado
        const porEstado = {};
        
        for (const est of ESTADOS_SOCIO) {
          let esperadoE = 0;
          let recaudadoE = 0;
          const sociosEArr = [];
          const porMedio = {};
          
          for (const m of monthsToUse) {
            if (esperadosPorMesPorCobradorEstado?.[key]?.[est]) {
              esperadoE += Number(
                esperadosPorMesPorCobradorEstado[key][est]?.[m] || 0
              );
            }
            
            const pagosMesEstado = (getPagosByMonth(m) || []).filter((pg) => {
              const cbOk = upper(pg._cb) === key;
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
            
            // Medios de pago dentro del estado
            pagosMesEstado.forEach((pg) => {
              const medioRaw =
                pg.Medio_Pago ||
                pg.medio_pago_nombre ||
                pg.medio_pago ||
                "";
              const medio = upper(medioRaw);
              if (!medio) return;
              
              if (!porMedio[medio]) {
                porMedio[medio] = { recaudado: 0, socios: 0 };
              }
              porMedio[medio].recaudado += Number(pg._precioNum) || 0;
              porMedio[medio].socios += 1;
            });
            
            let sociosMesE = 0;
            if (sociosPorMesPorCobradorEstado?.[key]?.[est]) {
              sociosMesE = Number(
                sociosPorMesPorCobradorEstado[key][est]?.[m] || 0
              );
            } else {
              const ids = new Set(
                pagosMesEstado.map(
                  (pg) => pg.ID_Socio || pg.id_socio
                )
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
        
        return { nombre: key, esperado, recaudado, socios, porEstado };
      })
      .filter((c) => c.esperado > 0 || c.recaudado > 0 || c.socios > 0);
    
    const sociosPeriodo = cobradoresListado.reduce(
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
      cobradoresListado,
    };
  });
  
  // Totales generales
  const totales = periodosData.reduce(
    (acc, r) => {
      acc.esperado += r.esperado;
      acc.recaudado += r.recaudado;
      acc.socios = Math.max(acc.socios, r.sociosPeriodo || 0);
      return acc;
    },
    { esperado: 0, recaudado: 0, socios: 0 }
  );
  
  const totalDif = totales.esperado - totales.recaudado;
  
  // Helper para formato
  const fmtMoney = (num) =>
    nfPesos ? `$${nfPesos.format(num || 0)}` : String(num ?? 0);
  const fmtInt = (num) =>
    nfPesos ? nfPesos.format(num || 0) : String(num ?? 0);
  
  /* ========= PREPARAR FILAS PARA PDF ========= */
  const head = [
    ["Período / Detalle", "Esperado", "Recaudado", "Socios", "Dif. (ESP-REC)"],
  ];
  const body = [];
  
  // Agregar cada período y su jerarquía
  periodosData.forEach((periodoData) => {
    // Fila del período principal
    body.push([
      periodoData.label,
      fmtMoney(periodoData.esperado),
      fmtMoney(periodoData.recaudado),
      fmtInt(periodoData.sociosPeriodo),
      fmtMoney(Math.abs(periodoData.diferencia)),
      periodoData.diferencia <= 0 ? [40, 167, 69] : [220, 53, 69], // Color para diferencia
      0, // Nivel 0 = período
    ]);
    
    // Subfilas por cobrador
    periodoData.cobradoresListado.forEach((cobrador) => {
      const difCobrador = cobrador.esperado - cobrador.recaudado;
      body.push([
        `  • ${cobrador.nombre}`,
        fmtMoney(cobrador.esperado),
        fmtMoney(cobrador.recaudado),
        fmtInt(cobrador.socios),
        fmtMoney(Math.abs(difCobrador)),
        difCobrador <= 0 ? [40, 167, 69] : [220, 53, 69],
        1, // Nivel 1 = cobrador
      ]);
      
      // Subsubfilas por estado (ACTIVO)
      const activo = cobrador.porEstado?.ACTIVO;
      if (activo && (activo.esperado > 0 || activo.recaudado > 0)) {
        const difActivo = activo.esperado - activo.recaudado;
        body.push([
          `      - ACTIVO`,
          fmtMoney(activo.esperado),
          fmtMoney(activo.recaudado),
          fmtInt(activo.socios),
          fmtMoney(Math.abs(difActivo)),
          difActivo <= 0 ? [40, 167, 69] : [220, 53, 69],
          2, // Nivel 2 = estado
        ]);
        
        // Medios de pago para OFICINA - ACTIVO
        if (cobrador.nombre === "OFICINA" && activo.porMedio) {
          MEDIOS_OFICINA.forEach((medio) => {
            const info = activo.porMedio[medio];
            if (info && (info.recaudado > 0 || info.socios > 0)) {
              body.push([
                `        └ ${medio}`,
                "—",
                fmtMoney(info.recaudado),
                fmtInt(info.socios),
                "—",
                [107, 114, 128], // Gris
                3, // Nivel 3 = medio
              ]);
            }
          });
        }
      }
      
      // Subsubfilas por estado (PASIVO)
      const pasivo = cobrador.porEstado?.PASIVO;
      if (pasivo && (pasivo.esperado > 0 || pasivo.recaudado > 0)) {
        const difPasivo = pasivo.esperado - pasivo.recaudado;
        body.push([
          `      - PASIVO`,
          fmtMoney(pasivo.esperado),
          fmtMoney(pasivo.recaudado),
          fmtInt(pasivo.socios),
          fmtMoney(Math.abs(difPasivo)),
          difPasivo <= 0 ? [40, 167, 69] : [220, 53, 69],
          2, // Nivel 2 = estado
        ]);
        
        // Medios de pago para OFICINA - PASIVO
        if (cobrador.nombre === "OFICINA" && pasivo.porMedio) {
          MEDIOS_OFICINA.forEach((medio) => {
            const info = pasivo.porMedio[medio];
            if (info && (info.recaudado > 0 || info.socios > 0)) {
              body.push([
                `        └ ${medio}`,
                "—",
                fmtMoney(info.recaudado),
                fmtInt(info.socios),
                "—",
                [107, 114, 128], // Gris
                3, // Nivel 3 = medio
              ]);
            }
          });
        }
      }
    });
    
    // Espacio entre períodos
    body.push(["", "", "", "", "", null, 0]);
  });
  
  // Agregar fila de TOTAL
  body.push([
    "TOTAL GENERAL",
    fmtMoney(totales.esperado),
    fmtMoney(totales.recaudado),
    fmtInt(totales.socios),
    fmtMoney(Math.abs(totalDif)),
    totalDif <= 0 ? [40, 167, 69] : [220, 53, 69],
    0,
  ]);

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
        
        // Estilo para fila TOTAL
        if (body[data.row.index]?.[0] === "TOTAL GENERAL") {
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
