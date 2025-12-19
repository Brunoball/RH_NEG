// src/utils/imprimirRecibos.jsx
import BASE_URL from '../config/config';

export const imprimirRecibos = async (listaSocios, periodoActual = '', ventana) => {
  // Normaliza el ID de socio desde distintas claves y lo devuelve como número o null
  const getIdSocio = (obj) => {
    const raw = obj?.id_socio ?? obj?.idSocio ?? obj?.idsocio ?? obj?.id ?? null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };

  const sociosCompletos = [];

  // Enriquecer datos de cada socio con la API (si hay ID válido)
  for (let socio of listaSocios) {
    const idNorm = getIdSocio(socio);

    if (idNorm === null) {
      // Sin ID válido: usar tal cual con fallback
      sociosCompletos.push({
        ...socio,
        id_socio: socio.id_socio ?? socio.idSocio ?? socio.idsocio ?? socio.id ?? '',
        nombre_cobrador: socio.medio_pago || '',
        id_periodo: socio.id_periodo || periodoActual || ''
      });
      continue;
    }

    try {
      const res = await fetch(`${BASE_URL}/api.php?action=socio_comprobante&id=${idNorm}`);
      const data = await res.json();
      if (data.exito) {
        sociosCompletos.push({
          ...data.socio,
          id_socio: data.socio.id_socio ?? idNorm, // aseguro consistencia
          nombre_cobrador: data.socio.nombre_cobrador || data.socio.medio_pago || '',
          id_periodo: data.socio.id_periodo || socio.id_periodo || periodoActual || ''
        });
      } else {
        sociosCompletos.push({
          ...socio,
          id_socio: idNorm,
          nombre_cobrador: socio.medio_pago || '',
          id_periodo: socio.id_periodo || periodoActual || ''
        });
      }
    } catch {
      sociosCompletos.push({
        ...socio,
        id_socio: idNorm,
        nombre_cobrador: socio.medio_pago || '',
        id_periodo: socio.id_periodo || periodoActual || ''
      });
    }
  }

  // === ORDENAR ASCENDENTE POR ID DE SOCIO ===
  sociosCompletos.sort((a, b) => {
    const ida = getIdSocio(a);
    const idb = getIdSocio(b);
    if (ida === null && idb === null) return 0;
    if (ida === null) return 1;  // los sin ID al final
    if (idb === null) return -1;
    return ida - idb;            // ascendente
  });

  // Catálogos
  let categorias = {}, estados = {}, cobradores = {}, periodos = {};

  try {
    const resListas = await fetch(`${BASE_URL}/api.php?action=listas`);
    const dataListas = await resListas.json();
    if (dataListas.exito) {
      categorias = Object.fromEntries(dataListas.listas.categorias.map(c => [c.id_categoria, c.descripcion]));
      estados    = Object.fromEntries(dataListas.listas.estados.map(e => [e.id_estado, e.descripcion]));
      cobradores = Object.fromEntries(dataListas.listas.cobradores.map(c => [c.id_cobrador, c.nombre]));
      periodos   = Object.fromEntries(dataListas.listas.periodos.map(p => [p.id, p.nombre]));
    }
  } catch (error) {
    console.error("Error obteniendo listas:", error);
  }

  const ventanaImpresion = ventana || window.open('', '', 'width=800,height=600');
  if (!ventanaImpresion) return;

  const anioActual = new Date().getFullYear();
  const posicionesTop = [20, 68, 117, 166, 216, 264];

  // Precomputo los códigos de barras para el <script> embebido (evita JSON.stringify raros)
  const codigosBarra = sociosCompletos.map((s) => {
    const idn = getIdSocio(s);
    const idStr = Number.isFinite(idn) ? String(idn) : '-';
    const cp = s.id_periodo || periodoActual || '0';
    return `${cp}-${idStr}`;
  });

  const html = `
  <html>
    <head>
      <title>Recibos</title>
      <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
      <style>
        @page { size: A4 portrait; margin: 0; }
        body {
          margin: 0;
          padding: 0;
          font-family: Arial, sans-serif;
          font-size: 8pt;
        }
        .page {
          width: 210mm;
          height: 297mm;
          position: relative;
          page-break-after: always;
        }
        .recibo-area {
          width: 95mm;
          height: 30mm;
          box-sizing: border-box;
          position: absolute;
          padding: .5rem 0 0;
          font-size: .8rem;
          overflow: hidden;
        }
        .recibo {
          width: 100%;
          height: 100%;
          display: flex;
          justify-content: center;
          flex-direction: column;
          box-sizing: border-box;
          font-size: .8rem;
        }
        .row {
          padding: 0 0.2rem;
          display: flex;
          width: 100%;
        }
        .cell {
          margin: 0;
          box-sizing: border-box;
          overflow: hidden;
          display: flex;
          flex: 1;
          white-space: nowrap;
          text-overflow: ellipsis;
        }
        .cell-full {
          flex: 0 0 100%;
        }
        .cell-barcode {
          flex: 1;
          padding: 0;
          height: 100%;
          min-height: 6mm;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
        }
        .barcode-container {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 70%;
        }
        .barcode {
          width: 100%;
          height: auto;
          max-height: 24px;
        }
        .barcode-text {
          font-size: 6pt;
          text-align: center;
          margin: 0;
          height: 30%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .firma {
          font-size: 8pt;
          text-align: center;
          width: 100%;
        }
        .importe {
          font-weight: bold;
          text-align: center;
          font-size: 8pt;
          width: 100%;
        }
        .periodo-grupo {
          display: flex;
          flex-direction: column;
          justify-content: center;
          flex: 1;
          height: fit-content;
        }
        .periodo-grupo div {
          flex: 1;
          display: flex;
          align-items: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      </style>
    </head>
    <body>
      ${(() => {
        let htmlPaginas = '';
        for (let p = 0; p < Math.ceil(sociosCompletos.length / 6); p++) {
          const pageSocios = sociosCompletos.slice(p * 6, p * 6 + 6);
          htmlPaginas += `<div class="page">`;

          for (let i = 0; i < pageSocios.length; i++) {
            const socio = pageSocios[i];
            const indexGlobal = p * 6 + i; // índice global = índice en sociosCompletos
            const top = posicionesTop[i];

            const idNorm = getIdSocio(socio);
            const nombre = socio.nombre?.toUpperCase() || '';
            const apellido = socio.apellido?.toUpperCase() || '';
            const domicilio = [socio.domicilio, socio.numero].filter(Boolean).join(' ').trim() || '';
            const id = idNorm ?? '';
            const categoria = categorias[socio.id_categoria] || socio.nombre_categoria || '';
            const estado = estados[socio.id_estado] || socio.nombre_estado || '';
            const tel = typeof socio.telefono === 'string' && socio.telefono.trim() !== '' ? socio.telefono.trim() : '';
            const cobro = typeof socio.domicilio_cobro === 'string' ? socio.domicilio_cobro.trim() : '';
            const importe = '$4000';
            const codigoPeriodo = socio.id_periodo || periodoActual || '0';
            const codigoBarra = `${codigoPeriodo}-${id}`;
            const textoPeriodo = periodos[codigoPeriodo] || `Período ${codigoPeriodo}`;

            const contenidoRecibo = (conCodigo) => `
              <div class="recibo-area" style="top: ${top}mm; left: ${conCodigo ? '5mm' : '110mm'};">
                <div class="recibo">
                  <div class="row">
                    <div class="cell cell-full"><strong>Socio:</strong>&nbsp;${id || '-'} - ${apellido} ${nombre}</div>
                  </div>
                  <div class="row">
                    <div class="cell cell-full"><strong>Domicilio:</strong>&nbsp;${domicilio}</div>
                  </div>
                  <div class="row">
                    <div class="cell cell-full"><strong>Domicilio de cobro:</strong>&nbsp;${cobro}</div>
                  </div>
                  <div class="row">
                    <div class="cell"><strong>Tel:</strong>&nbsp;${tel}</div>
                    <div class="cell"><div class="importe">Importe: ${importe}</div></div>
                  </div>
                  <div class="row">
                    <div class="cell periodo-grupo">
                      <div><strong>Período:</strong>&nbsp;${textoPeriodo} / ${anioActual}</div>
                      <div><strong>Grupo:</strong>&nbsp;${categoria}&nbsp;<strong>Estado:</strong>&nbsp;${estado}</div>
                    </div>
                    <div class="cell cell-barcode">
                      ${conCodigo
                        ? `<div class="barcode-container"><svg id="barcode-${indexGlobal}" class="barcode"></svg></div>
                           <div class="barcode-text">${codigoBarra}</div>`
                        : `<div class="firma">Norberto Blesio -<br>Tesorero</div>`}
                    </div>
                  </div>
                </div>
              </div>
            `;

            htmlPaginas += contenidoRecibo(true);
            htmlPaginas += contenidoRecibo(false);
          }

          htmlPaginas += `</div>`;
        }
        return htmlPaginas;
      })()}
      <script>
        window.onload = function() {
          // Códigos precomputados desde React:
          var codigos = ${JSON.stringify(codigosBarra)};
          for (var i = 0; i < codigos.length; i++) {
            try {
              JsBarcode("#barcode-" + i, codigos[i], {
                format: "CODE128",
                lineColor: "#000",
                width: 2.5,
                height: 50,
                displayValue: false
              });
            } catch (e) { /* ignorar si falta el svg (por seguridad) */ }
          }
          window.print();
        };
      </script>
    </body>
  </html>`;

  ventanaImpresion.document.write(html);
  ventanaImpresion.document.close();
};
