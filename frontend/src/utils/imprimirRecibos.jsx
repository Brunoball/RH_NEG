import BASE_URL from '../config/config';

export const imprimirRecibos = async (listaSocios, periodoActual = '') => {
  const sociosCompletos = [];

  for (let socio of listaSocios) {
    try {
      const res = await fetch(`${BASE_URL}/api.php?action=socio_comprobante&id=${socio.id_socio}`);
      const data = await res.json();
      if (data.exito) {
        sociosCompletos.push(data.socio);
      } else {
        sociosCompletos.push({ ...socio });
      }
    } catch {
      sociosCompletos.push({ ...socio });
    }
  }

  let categorias = {}, estados = {}, cobradores = {};

  try {
    const resListas = await fetch(`${BASE_URL}/api.php?action=listas`);
    const dataListas = await resListas.json();
    if (dataListas.exito) {
      categorias = Object.fromEntries(dataListas.listas.categorias.map(c => [c.id_categoria, c.descripcion]));
      estados = Object.fromEntries(dataListas.listas.estados.map(e => [e.id_estado, e.descripcion]));
      cobradores = Object.fromEntries(dataListas.listas.cobradores.map(c => [c.id_cobrador, c.nombre]));
    }
  } catch (error) {
    console.error("Error obteniendo listas:", error);
  }

  const ventana = window.open('', '', 'width=800,height=600');
  if (!ventana) return;

  const anioActual = new Date().getFullYear();
  const numeroPeriodo = periodoActual.replace(/\D/g, '') || '0';
  const textoPeriodo = `Período: ${numeroPeriodo} / ${anioActual}`;

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
        .contenedor-hoja {
          display: flex;
          flex-direction: column;
          padding: 0;
        }
        .fila {
          display: flex;
          flex-direction: row;
          margin: 0;
          padding: 0;
        }
        .page-break {
          page-break-after: always;
        }
        .recibo {
          width: 106mm;
          height: 49mm;
          box-sizing: border-box;
          border: 1px solid #000;
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
          padding: 18mm 6mm 4mm 6mm;
          margin: 0;
        }
        .linea {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1px;
        }
        .linea-doble {
          width: 100%;
          margin-bottom: 1px;
        }
        .linea-doble p,
        .linea p {
          margin: 0;
          line-height: 1.1em;
        }
        .barcode-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 90px;
        }
        .importe-bloque {
          text-align: right;
        }
        .importe {
          margin: 0;
        }
        .importe-centrado {
          text-align: center;
          font-weight: normal;
          margin-bottom: 2px;
        }
        .firma {
          font-size: 6pt;
          margin: 0;
        }
        .barcode {
          width: 90px;
          height: 28px;
        }
      </style>
    </head>
    <body>
      <div class="contenedor-hoja">
        ${(() => {
          const bloques = [];
          for (let i = 0; i < sociosCompletos.length; i++) {
            const socio = sociosCompletos[i];
            const nombre = socio.nombre?.toUpperCase() || '';
            const apellido = socio.apellido?.toUpperCase() || '';
            const domicilio = [socio.domicilio, socio.numero].filter(Boolean).join(' ').trim() || '';
            const cobro = typeof socio.domicilio_cobro === 'string' && socio.domicilio_cobro.trim() !== '' ? socio.domicilio_cobro.trim() : '';
            const tel = typeof socio.telefono === 'string' && socio.telefono.trim() !== '' ? socio.telefono.trim() : '';
            const id = socio.id_socio || '';

            const categoria = categorias[socio.id_categoria] || socio.nombre_categoria || '';
            const estado = estados[socio.id_estado] || socio.nombre_estado || '';
            const medioPago = cobradores[socio.id_cobrador] || socio.nombre_cobrador || '';

            const importe = '$4000';
            const codigoBarra = `${numeroPeriodo}-${id}`;

            const reciboHTML = (conCodigo, suffix, mostrarFirma) => `
              <div class="recibo">
                <div class="linea-doble">
                  <p><strong>Socio:</strong> ${id} - ${apellido} ${nombre}</p>
                  <p><strong>Domicilio:</strong> ${domicilio}</p>
                </div>
                <div class="linea">
                  <p><strong>Cobro:</strong> ${cobro}</p>
                </div>
                <div class="linea">
                  <div>
                    <p><strong>${textoPeriodo}</strong></p>
                    <p><strong>Tel.:</strong> ${tel}</p>
                    <p><strong>Grupo:</strong> ${categoria} - ${estado}</p>
                    <p><strong>Medio de pago:</strong> ${medioPago}</p>
                  </div>
                  <div class="${conCodigo ? 'barcode-container' : 'importe-bloque'}">
                    ${conCodigo 
                      ? `<p class="importe-centrado">Importe: ${importe}</p><svg id="barcode-${i}${suffix}" class="barcode"></svg>` 
                      : `<p class="importe">Importe: ${importe}</p>
                         ${mostrarFirma ? `<p class="firma">Francisco José Meré - Tesorero</p>` : ''}`
                    }
                  </div>
                </div>
              </div>`;

            const filaHTML = `
              <div class="fila">
                ${reciboHTML(true, 'a', false)}
                ${reciboHTML(false, 'b', true)}
              </div>
            `;

            bloques.push(filaHTML);
            if ((i + 1) % 6 === 0) bloques.push(`<div class="page-break"></div>`);
          }

          return bloques.join('');
        })()}
      </div>
      <script>
        window.onload = function() {
          ${sociosCompletos.map((s, i) => {
            const id = s.id_socio || '-';
            const codigo = `${numeroPeriodo}-${id}`;
            return `
              JsBarcode("#barcode-${i}a", "${codigo}", {
                format: "CODE128",
                lineColor: "#000",
                width: 1.6,
                height: 28,
                displayValue: false
              });
            `;
          }).join('\n')}
          window.print();
        };
      </script>
    </body>
  </html>`;

  ventana.document.write(html);
  ventana.document.close();
};
