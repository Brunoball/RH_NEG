// src/utils/ReciboPDF.jsx
import BASE_URL from '../config/config';

/**
 * Genera un PDF en 1 hoja, con cabecera y un único comprobante.
 * Nombre del archivo: "Comprobante - <NOMBRE>.pdf"
 */
export async function generarReciboPDFUnico(opts = {}) {
  const {
    listaSocios = [],
    periodoActual = '',
    anioSeleccionado = null,
    headerImageUrl = '',
    baseUrl = BASE_URL,
  } = opts;

  const socioInput =
    Array.isArray(listaSocios) && listaSocios.length > 0 ? listaSocios[0] : null;
  if (!socioInput) {
    alert('No se recibió información del socio para generar el comprobante.');
    return;
  }

  const getIdSocio = (obj) => {
    const raw = obj?.id_socio ?? obj?.idSocio ?? obj?.idsocio ?? obj?.id ?? null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };
  const formatARS = (monto) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(monto);
  const limpiarPrefijoPeriodo = (txt = '') => String(txt).replace(/^\s*per[ií]odo?s?\s*:?\s*/i, '').trim();
  const extraerAnio = (txt = '') => {
    const m = String(txt).match(/(20\d{2})/);
    return m ? parseInt(m[1], 10) : null;
  };
  const normalizarYOrdenarPeriodos = (txt = '') => {
    const limpio = limpiarPrefijoPeriodo(txt);
    const unificado = limpio.replace(/\s*[yY]\s*/g, '/');
    const pares = [];
    const re = /(\d+)\s*\/\s*(\d+)/g;
    let m;
    while ((m = re.exec(unificado)) !== null) {
      const a = parseInt(m[1], 10);
      const b = parseInt(m[2], 10);
      if (Number.isFinite(a) && Number.isFinite(b)) pares.push([a, b]);
    }
    if (pares.length === 0) {
      return unificado.split(/[,\s]+/g).filter(Boolean).join(' - ').trim();
    }
    pares.sort((A, B) => (A[0] !== B[0] ? A[0] - B[0] : A[1] - B[1]));
    return pares.map(([a, b]) => `${a}/${b}`).join(' - ');
  };

  // catálogos (opcionales)
  let categorias = {};
  let estados = {};
  let periodos = {};
  try {
    const resListas = await fetch(`${baseUrl}/api.php?action=listas`);
    const dataListas = await resListas.json();
    if (dataListas?.exito) {
      categorias = Object.fromEntries((dataListas.listas.categorias || []).map((c) => [c.id_categoria, c.descripcion]));
      estados    = Object.fromEntries((dataListas.listas.estados    || []).map((e) => [String(e.id_estado), e.descripcion]));
      periodos   = Object.fromEntries((dataListas.listas.periodos   || []).map((p) => [String(p.id), p.nombre]));
    }
  } catch {}

  const id = getIdSocio(socioInput) ?? '';
  const nombreMayus = (
    (socioInput.apellido ? `${String(socioInput.apellido).toUpperCase()} ` : '') +
    (socioInput.nombre ? String(socioInput.nombre).toUpperCase() : (socioInput.nombre_socio || ''))
  ).trim();
  const domicilio = [socioInput.domicilio, socioInput.numero].filter(Boolean).join(' ').trim() || '';
  const tel = typeof socioInput.telefono === 'string' ? socioInput.telefono.trim() : (socioInput.telefono || '');
  const cobro = typeof socioInput.domicilio_cobro === 'string' ? socioInput.domicilio_cobro.trim() : (socioInput.domicilio_cobro || '');

  // CORRECCIÓN: Mostrar la categoría correcta del socio
  const grupo = socioInput.nombre_categoria 
    || categorias[socioInput.id_categoria] 
    || socioInput.grupo_sanguineo 
    || categorias[socioInput.id_grupo] 
    || '';

  const estadoTxt = socioInput.nombre_estado || socioInput.estado || estados[String(socioInput.id_estado)] || '';
  const estado = String(estadoTxt).toUpperCase();

  const codigoPeriodoRaw = String(socioInput.id_periodo || periodoActual || '0');
  const textoBasePeriodo = socioInput.periodo_texto || periodos[codigoPeriodoRaw] || `Período ${codigoPeriodoRaw}`;

  const esAnual =
    codigoPeriodoRaw === '7' ||
    (socioInput.periodo_texto && String(socioInput.periodo_texto).toUpperCase().includes('ANUAL')) ||
    String(textoBasePeriodo).toUpperCase().includes('ANUAL');

  const anioParaCodigo =
    anioSeleccionado ?? socioInput.anio ?? socioInput.anioTrabajo ?? extraerAnio(textoBasePeriodo) ?? new Date().getFullYear();

  const textoPeriodo = esAnual
    ? `CONTADO ANUAL /${anioParaCodigo}`
    : `${normalizarYOrdenarPeriodos(textoBasePeriodo)} /${anioParaCodigo}`;

  const importeStr =
    typeof socioInput.importe_total === 'number'
      ? formatARS(socioInput.importe_total)
      : typeof socioInput.importe === 'number'
      ? formatARS(socioInput.importe)
      : socioInput.importe || '$4000';

  const safe = (s) => String(s || '').replace(/[\/\\:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
  const fileName = `Comprobante - ${safe(nombreMayus)}.pdf`;

  const popup = window.open('', '', 'width=1000,height=800');
  if (!popup) {
    alert('Bloqueador de ventanas emergentes activo. Permití pop-ups para descargar el PDF.');
    return;
  }

  const html = `
<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<title>Comprobante</title>
<style>
  @page { size: A4 portrait; margin: 0; }
  html, body { margin: 0; padding: 0; font-family: Arial, sans-serif; color:#000; }
  #pdf-root { width: 210mm; box-sizing: border-box; }
  .header { width: 100%; box-sizing: border-box; padding: 5mm 8mm 1mm; }
  .header img { width: 100%; height: auto; display: block; }
  .header-fallback { padding: 3mm 8mm 1mm; border-bottom: 1px solid #ddd; }
  .header-fallback-title { font-size: 16px; font-weight: 700; letter-spacing: .4px; }
  .header-fallback-sub { font-size: 11px; color: #333; }
  .content { padding: 1.5mm 8mm 8mm; box-sizing: border-box; }
  .recibo { width: 100%; padding: 4mm 6mm 6mm; box-sizing: border-box; }
  .row { display:flex; justify-content:space-between; gap:10mm; }
  .col { flex:1; }
  .line { margin-bottom: 2.2mm; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .bold { font-weight: 700; }
  .importe-box { text-align:right; font-weight:700; margin-bottom: 0.8mm; }
  .separador { height: 1px; background:#000; margin: 0.8mm 0 1.6mm; opacity:.2; }
  .firma-box { text-align:right; font-size: 10pt; line-height: 1.2; margin-top: 4mm; }
  #pdf-root, .header, .content, .recibo, .row, .col { page-break-inside: avoid; break-inside: avoid; }
</style>
</head>
<body>
  <div id="pdf-root">
    <div class="header">
      ${
        headerImageUrl
          ? `<img src="${headerImageUrl}" onerror="this.style.display='none';document.getElementById('hdr-fb').style.display='block';" alt="Cabecera"/>`
          : `<div id="hdr-fb" class="header-fallback">
               <div class="header-fallback-title">CIRCULO Rh (-) · Asociación Civil</div>
               <div class="header-fallback-sub">Pje. Madre Teresa de Calcuta 48 · Tel: (03564) 436-366 · San Francisco (CBA)</div>
               <div class="header-fallback-sub">IVA: EXENTO · CUIT: 30-71097653-4 · Inicio de actividades 2009</div>
             </div>`
      }
      <div id="hdr-fb" class="header-fallback" style="display:none;">
        <div class="header-fallback-title">CIRCULO Rh (-) · Asociación Civil</div>
        <div class="header-fallback-sub">Pje. Madre Teresa de Calcuta 48 · Tel: (03564) 436-366 · San Francisco (CBA)</div>
        <div class="header-fallback-sub">IVA: EXENTO · CUIT: 30-71097653-4 · Inicio de actividades 2009</div>
      </div>
    </div>

    <div class="content">
      <div class="recibo">
        <div class="row">
          <div class="col">
            <div class="line"><span class="bold">Socio:</span> ${id || '-'} - ${nombreMayus}</div>
            <div class="line"><span class="bold">Domicilio:</span> ${domicilio}</div>
            <div class="line"><span class="bold">Domicilio de cobro:</span> ${cobro}</div>
            <div class="line"><span class="bold">Tel:</span> ${tel}</div>
            <div class="line"><span class="bold">Período:</span> ${textoPeriodo}</div>
            <div class="line"><span class="bold">Grupo:</span> ${grupo} <span class="bold">Estado:</span> ${estado}</div>
          </div>
          <div class="col" style="flex:0 0 45mm;">
            <div class="importe-box">Importe: ${importeStr}</div>
            <div class="separador"></div>
            <div class="firma-box">
              Francisco José Meré<br/>Tesorero
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
  <script>
    (function(){
      setTimeout(function(){
        var node = document.getElementById('pdf-root');
        var opt = {
          margin: [0, 0, 0, 0],
          filename: ${JSON.stringify(fileName)},
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, letterRendering: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: 'avoid-all' }
        };
        html2pdf().set(opt).from(node).save().then(function(){ window.close(); });
      }, 250);
    })();
  </script>
</body>
</html>
  `;

  popup.document.open();
  popup.document.write(html);
  popup.document.close();
}