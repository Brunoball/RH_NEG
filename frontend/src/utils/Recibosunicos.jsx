// src/utils/RecibosUnicos.jsx
import BASE_URL from '../config/config';

/**
 * Genera comprobantes "cortos" (2 columnas) para 1..N socios.
 */
export const imprimirRecibosUnicos = async (
  listaSocios,
  periodoActual = '',
  ventana = null,
  anioSeleccionado = null
) => {
  const getIdSocio = (obj) => {
    const raw = obj?.id_socio ?? obj?.idSocio ?? obj?.idsocio ?? obj?.id ?? null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };
  const formatARS = (m) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(m);
  const limpiarPrefijoPeriodo = (t = '') => String(t).replace(/^\s*per[ií]odo?s?\s*:?\s*/i, '').trim();
  const extraerAnio = (t = '') => { const m = String(t).match(/(20\d{2})/); return m ? parseInt(m[1], 10) : null; };
  const contarPares = (t = '') => { const u = String(t).replace(/\s*[yY]\s*/g, '/'); let c=0; const r=/(\d+)\s*\/\s*(\d+)/g; while(r.exec(u)) c++; return c; };
  const normalizarYOrdenarPeriodos = (t = '') => {
    const limpio = limpiarPrefijoPeriodo(t);
    const u = limpio.replace(/\s*[yY]\s*/g, '/');
    const pares = []; const r=/(\d+)\s*\/\s*(\d+)/g; let m;
    while ((m = r.exec(u)) !== null) { const a = parseInt(m[1],10), b = parseInt(m[2],10); if (Number.isFinite(a)&&Number.isFinite(b)) pares.push([a,b]); }
    if (pares.length === 0) return u.split(/[,\s]+/g).filter(Boolean).join(' - ').trim();
    pares.sort((A,B)=> (A[0]!==B[0] ? A[0]-B[0] : A[1]-B[1]));
    return pares.map(([a,b])=>`${a}/${b}`).join(' - ');
  };

  // enriquecer con API
  const sociosCompletos = [];
  for (const socio of (listaSocios || [])) {
    const idNorm = getIdSocio(socio);
    if (idNorm === null) {
      sociosCompletos.push({
        ...socio,
        id_socio: socio.id_socio ?? socio.idSocio ?? socio.idsocio ?? socio.id ?? '',
        nombre_cobrador: socio.medio_pago || '',
        id_periodo: socio.id_periodo || periodoActual || '',
        anio: anioSeleccionado ?? socio.anio ?? socio.anioTrabajo ?? null,
      });
      continue;
    }
    try {
      const res = await fetch(`${BASE_URL}/api.php?action=socio_comprobante&id=${idNorm}`);
      const data = await res.json();
      if (data?.exito) {
        sociosCompletos.push({
          ...data.socio,
          ...socio,
          id_socio: data.socio.id_socio ?? idNorm,
          nombre_cobrador: data.socio.nombre_cobrador || data.socio.medio_pago || socio.medio_pago || '',
          id_periodo: socio.id_periodo || data.socio.id_periodo || periodoActual || '',
          anio: anioSeleccionado ?? socio.anio ?? socio.anioTrabajo ?? data.socio.anio ?? null,
        });
      } else {
        sociosCompletos.push({
          ...socio,
          id_socio: idNorm,
          nombre_cobrador: socio.medio_pago || '',
          id_periodo: socio.id_periodo || periodoActual || '',
          anio: anioSeleccionado ?? socio.anio ?? socio.anioTrabajo ?? null,
        });
      }
    } catch {
      sociosCompletos.push({
        ...socio,
        id_socio: idNorm,
        nombre_cobrador: socio.medio_pago || '',
        id_periodo: socio.id_periodo || periodoActual || '',
        anio: anioSeleccionado ?? socio.anio ?? socio.anioTrabajo ?? null,
      });
    }
  }

  // catálogos
  let categorias = {}, estados = {}, periodos = {};
  try {
    const resListas = await fetch(`${BASE_URL}/api.php?action=listas`);
    const dataListas = await resListas.json();
    if (dataListas?.exito) {
      categorias = Object.fromEntries((dataListas.listas.categorias || []).map((c) => [c.id_categoria, c.descripcion]));
      estados    = Object.fromEntries((dataListas.listas.estados    || []).map((e) => [String(e.id_estado), e.descripcion]));
      periodos   = Object.fromEntries((dataListas.listas.periodos   || []).map((p) => [String(p.id), p.nombre]));
    }
  } catch {}

  const popup = ventana || window.open('', '', 'width=800,height=600');
  if (!popup) return;

  const posicionesTop = [20, 68, 117, 166, 216, 264];
  let pagesHTML = '';
  const codigosBarra = [];
  const totalPaginas = Math.ceil(sociosCompletos.length / 6);

  for (let p = 0; p < totalPaginas; p++) {
    const pageSocios = sociosCompletos.slice(p * 6, p * 6 + 6);
    let pageHTML = '<div class="page">';

    for (let i = 0; i < pageSocios.length; i++) {
      const s = pageSocios[i];
      const top = posicionesTop[i];

      const id = getIdSocio(s) ?? '';
      const nombre = (s.apellido ? `${String(s.apellido).toUpperCase()} ` : '') + (s.nombre ? String(s.nombre).toUpperCase() : '');
      const domicilio = [s.domicilio, s.numero].filter(Boolean).join(' ').trim() || '';
      const tel = typeof s.telefono === 'string' ? s.telefono.trim() : (s.telefono || '');
      const cobro = typeof s.domicilio_cobro === 'string' ? s.domicilio_cobro.trim() : (s.domicilio_cobro || '');

      // CORRECCIÓN: Mostrar la categoría correcta del socio
      const grupo = s.nombre_categoria 
        || categorias[s.id_categoria] 
        || s.grupo_sanguineo 
        || categorias[s.id_grupo] 
        || '';

      const estadoTxt = s.nombre_estado || s.estado || estados[String(s.id_estado)] || '';
      const estado = String(estadoTxt).toUpperCase();

      const codigoPeriodoRaw = String(s.id_periodo || periodoActual || '0');
      const textoBasePeriodo = s.periodo_texto || periodos[codigoPeriodoRaw] || `Período ${codigoPeriodoRaw}`;

      const esAnual =
        codigoPeriodoRaw === '7' ||
        (s.periodo_texto && String(s.periodo_texto).toUpperCase().includes('ANUAL')) ||
        String(textoBasePeriodo).toUpperCase().includes('ANUAL');

      const codigoPeriodo = esAnual ? '7' : codigoPeriodoRaw;

      const anioParaCodigo =
        anioSeleccionado ?? s.anio ?? s.anioTrabajo ?? extraerAnio(textoBasePeriodo) ?? new Date().getFullYear();

      const textoPeriodo = esAnual
        ? `CONTADO ANUAL /${anioParaCodigo}`
        : `${normalizarYOrdenarPeriodos(textoBasePeriodo)} /${anioParaCodigo}`;

      const importeStr =
        typeof s.importe_total === 'number'
          ? formatARS(s.importe_total)
          : typeof s.importe === 'number'
          ? formatARS(s.importe)
          : s.importe || '$4000';

      const cantidadPares = contarPares(textoBasePeriodo);
      const showBarcode = esAnual || cantidadPares === 1;

      const anio2d = String(anioParaCodigo).slice(-2);
      const codigoBarra = `${codigoPeriodo}${anio2d}-${id}`;

      let barcodeIndex = null;
      if (showBarcode) {
        barcodeIndex = codigosBarra.length;
        codigosBarra.push(codigoBarra);
      }

      const bloque = (conCodigo) => `
        <div class="recibo-area" style="top:${top}mm; left:${conCodigo ? '5mm' : '110mm'};">
          <div class="recibo">
            <div class="row">
              <div class="cell cell-full"><strong>Socio:</strong>&nbsp;${id || '-'} - ${nombre}</div>
            </div>
            <div class="row">
              <div class="cell cell-full"><strong>Domicilio:</strong>&nbsp;${domicilio}</div>
            </div>
            <div class="row">
              <div class="cell cell-full"><strong>Domicilio de cobro:</strong>&nbsp;${cobro}</div>
            </div>
            <div class="row">
              <div class="cell"><strong>Tel:</strong>&nbsp;${tel}</div>
              <div class="cell"><div class="importe">Importe: ${importeStr}</div></div>
            </div>
            <div class="row">
              <div class="cell periodo-grupo">
                <div><strong>Período:</strong>&nbsp;${textoPeriodo}</div>
                <div><strong>Grupo:</strong>&nbsp;${grupo}&nbsp;<strong>Estado:</strong>&nbsp;${estado}</div>
              </div>
              <div class="cell cell-barcode">
                ${
                  conCodigo
                    ? (showBarcode
                        ? `<div class="barcode-container"><svg id="barcode-${barcodeIndex}" class="barcode"></svg></div>
                           <div class="barcode-text">${codigoBarra}</div>`
                        : ``)
                    : `<div class="firma">Francisco José Meré -<br/>Tesorero</div>`
                }
              </div>
            </div>
          </div>
        </div>
      `;

      pageHTML += bloque(true);
      pageHTML += bloque(false);
    }

    pageHTML += '</div>';
    pagesHTML += pageHTML;
  }

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Recibos</title>
  <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
  <style>
    @page { size: A4 portrait; margin: 0; }
    body { margin: 0; padding: 0; font-family: Arial, sans-serif; font-size: 8pt; }
    .page { width: 210mm; height: 297mm; position: relative; page-break-after: always; }
    .recibo-area { width: 95mm; height: 30mm; box-sizing: border-box; position: absolute; padding: .5rem 0 0; font-size: .8rem; overflow: hidden; }
    .recibo { width: 100%; height: 100%; display: flex; justify-content: center; flex-direction: column; box-sizing: border-box; font-size: .8rem; }
    .row { padding: 0 0.2rem; display: flex; width: 100%; justify-content:space-between; }
    .cell { margin: 0; box-sizing: border-box; overflow: hidden; display: flex; white-space: nowrap; text-overflow: ellipsis; }
    .cell-full { flex: 0 0 100%; }
    .cell-barcode { padding: 0; height: 100%; min-height: 6mm; display: flex; flex-direction: column; justify-content: center; align-items: center; }
    .barcode-container { display: flex; align-items: center; justify-content: center; width: 100%; height: 70%; }
    .barcode { width: 100%; height: auto; max-height: 24px; }
    .barcode-text { font-size: 6pt; text-align: center; margin: 0; height: 30%; display: flex; align-items: center; justify-content: center; }
    .firma { font-size: 8pt; text-align: center; width: 100%; }
    .importe { font-weight: bold; text-align: end; font-size: 8pt; width: 100%; margin-right:.5rem; }
    .periodo-grupo { display: flex; flex-direction: column; justify-content: center; flex: 1; height: fit-content; }
    .periodo-grupo div { flex: 1; display: flex; align-items: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  </style>
</head>
<body>
  ${pagesHTML}
  <script>
    (function(){
      var codigos = ${JSON.stringify(codigosBarra)};
      for (var i = 0; i < codigos.length; i++) {
        try {
          JsBarcode("#barcode-" + i, codigos[i], { format: "CODE128", lineColor: "#000", width: 2.5, height: 50, displayValue: false });
        } catch (e) {}
      }
      window.print();
    })();
  </script>
</body>
</html>`;

  popup.document.open();
  popup.document.write(html);
  popup.document.close();
};