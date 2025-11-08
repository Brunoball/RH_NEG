// src/components/Cuotas/modales/GaliciaExport.jsx
// ---------------------------------------------------------
// Exportador Pago Directo Galicia (Empresas 6 dígitos)
// Genera un .txt con registros de longitud fija:
//   Header ("00"), Detalle(s) (tipo 0370) y Trailer ("99").
// Basado en el PDF "Diseño de Pago Directo - Empresas 6 dígitos"
// y la "Guía para rendiciones" (descarga/conciliación).
// ---------------------------------------------------------

import React, { useEffect } from "react";

/**
 * CONFIG – completá una sola vez con tus datos
 * NRO_PRESTACION: número de 6 dígitos asignado por Galicia para Pago Directo
 * SERVICIO: "C" → SNP (Sistema Nacional de Pagos)
 * ORIGEN: "EMPRESA" para archivos que manda la empresa
 * IDENT_ARCHIVO: “1” por defecto; cambiá si enviás más de un archivo el mismo día
 */
const GALICIA_CFG = {
  NRO_PRESTACION: "000123",
  SERVICIO: "C",
  ORIGEN: "EMPRESA",
  IDENT_ARCHIVO: "1",
};

/* ========= Helpers ========= */
const padLeft  = (s, len, ch = "0") => String(s ?? "").slice(0, len).padStart(len, ch);
const padRight = (s, len, ch = " ") => String(s ?? "").slice(0, len).padEnd(len, ch);
const onlyDigits = (s = "") => String(s).replace(/\D+/g, "");

// AAAAMMDD
const yyyymmdd = (d) => {
  if (!d) return "00000000";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return "00000000";
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${y}${m}${dd}`;
};

// Importe en formato Num-dec (14)V99 → 14 posiciones (12 enteros + 2 decimales)
const moneyV99 = (n) => {
  const cents = Math.round(Number(n || 0) * 100);
  return padLeft(cents, 14, "0");
};

// CBU a 26 dígitos (si viene 22, se left-pad a 26)
const normalizarCBU26 = (cbu) => {
  let raw = onlyDigits(cbu);
  if (raw.length === 26) return raw;
  return padLeft(raw, 26, "0").slice(0, 26);
};

// Referencia unívoca (15 chars). Ej.: "00012-ENERO2025"
const referenciaUnivoca = (cuota, periodoTexto, getId, idnum) => {
  const idStr = padLeft(idnum ?? getId(cuota) ?? "", 5, "0");
  const ref = `${idStr}-${String(periodoTexto || "").replace(/\s+/g, "")}`.slice(0, 15);
  return padRight(ref, 15, " ");
};

/* ========= Registros ========= */
const buildHeader = ({ totalImporte, cantDetalles }) => {
  // 1-2   "00"
  // 3-8   NRO_PRESTACION Num(6)
  // 9     SERVICIO ("C")
  // 10-17 FECHA_GENERACION AAAAMMDD
  // 18    IDENT_ARCHIVO
  // 19-25 ORIGEN (EMPRESA/BANCO) Char(7)
  // 26-39 IMPORTE_TOTAL Num-dec(14)V99
  // 40-46 CANT_REGISTROS Num(7)
  // 47-350 Blancos
  const hoy = yyyymmdd(new Date());
  return (
    padRight("00", 2) +
    padLeft(GALICIA_CFG.NRO_PRESTACION, 6, "0") +
    padRight(GALICIA_CFG.SERVICIO, 1, " ") +
    padLeft(hoy, 8, "0") +
    padRight(GALICIA_CFG.IDENT_ARCHIVO, 1, " ") +
    padRight(GALICIA_CFG.ORIGEN, 7, " ") +
    moneyV99(totalImporte) +
    padLeft(cantDetalles, 7, "0") +
    padRight("", 350 - 46, " ")
  );
};

const buildDetalle = ({
  cuota,
  periodoTexto,
  fechaVto,
  importe,
  getId,
}) => {
  // Tipo registro 1-4   : "0370" (Orden de débito)
  // Id cliente   5-26   : Char(22)
  // CBU          27-52  : Num(26)
  // Referencia   53-67  : Char(15)
  // Fecha 1º Vto 68-75  : AAAAMMDD
  // Importe 1º   76-89  : Num-dec(14)V99
  // 2º,3º vto    90-133 : ceros
  // Moneda       134    : '0'
  // 135-350             : blancos

  const idCliente = padRight(String(cuota.documento || cuota._idnum || getId(cuota) || ""), 22, " ");
  const cbu26 = normalizarCBU26(cuota.cbu || cuota.CBU || "");
  const ref = referenciaUnivoca(cuota, periodoTexto, getId, cuota._idnum);
  const fecha1 = yyyymmdd(fechaVto);
  const imp1 = moneyV99(importe);

  let s = "";
  s += padRight("0370", 4);    // 1-4
  s += idCliente;              // 5-26
  s += cbu26;                  // 27-52
  s += ref;                    // 53-67
  s += fecha1;                 // 68-75
  s += imp1;                   // 76-89
  s += padLeft("", 8, "0");    // 90-97  (2º vto fecha)
  s += padLeft("", 14, "0");   // 98-111 (2º vto importe)
  s += padLeft("", 8, "0");    // 112-119(3º vto fecha)
  s += padLeft("", 14, "0");   // 120-133(3º vto importe)
  s += "0";                    // 134 moneda pesos
  s += padRight("", 350 - 134, " ");
  return s;
};

const buildTrailer = ({ totalImporte, cantDetalles }) => {
  // Igual header pero tipo "99"
  const hoy = yyyymmdd(new Date());
  return (
    padRight("99", 2) +
    padLeft(GALICIA_CFG.NRO_PRESTACION, 6, "0") +
    padRight(GALICIA_CFG.SERVICIO, 1, " ") +
    padLeft(hoy, 8, "0") +
    padRight(GALICIA_CFG.IDENT_ARCHIVO, 1, " ") +
    padRight(GALICIA_CFG.ORIGEN, 7, " ") +
    moneyV99(totalImporte) +
    padLeft(cantDetalles, 7, "0") +
    padRight("", 350 - 46, " ")
  );
};

/**
 * exportPagoDirectoGalicia
 * Genera y descarga el archivo .txt
 *
 * @param {Object} params
 * @param {Array}  params.cuotas             Lista completa (del estado) – se filtrará adentro
 * @param {String} params.periodoId          ID del período seleccionado
 * @param {String} params.periodoTexto       Nombre del período (para referencia unívoca)
 * @param {String|Number} params.anio        Año (string o number)
 * @param {Function} params.getAnualPeriodo  fn que retorna {id, nombre} o null
 * @param {Function} params.normalize        fn para normalizar strings (ANUAL, etc.)
 * @param {Function} params.getId            fn que retorna ID string del socio
 *
 * @returns {Object} { ok:boolean, message?:string, fileName?:string }
 */
export function exportPagoDirectoGalicia({
  cuotas,
  periodoId,
  periodoTexto,
  anio,
  getAnualPeriodo,
  normalize,
  getId,
}) {
  if (!periodoId) {
    return { ok: false, message: "Falta seleccionar período." };
  }
  // Filtrar: período actual, pagados y medio de pago = COBRADOR
  const lista = (cuotas || [])
    .filter((c) => String(c.id_periodo) === String(periodoId))
    .filter((c) => String(c.estado_pago || "").toLowerCase() === "pagado")
    .filter((c) => String(c.medio_pago || "").toLowerCase().includes("cobrador"));

  if (lista.length === 0) {
    return { ok: false, message: "No hay pagos con COBRADOR en el período seleccionado." };
  }

  const anual = getAnualPeriodo ? getAnualPeriodo() : null;
  const esAnual = String(periodoId) === String(anual?.id) ||
                  (normalize && normalize(periodoTexto).includes("anual"));

  // Fecha de débito sugerida: hoy (podés cambiar)
  const fechaDebito = new Date();

  // Monto por socio
  const detalles = lista.map((c) => {
    const mensual = Number(c?.monto_mensual) || 0;
    const anualM  = Number(c?.monto_anual)   || (mensual * 12);
    const importe = esAnual ? anualM : mensual;
    return { c, importe };
  });

  const totalImporte = detalles.reduce((acc, it) => acc + (Number(it.importe) || 0), 0);

  const header = buildHeader({ totalImporte, cantDetalles: detalles.length });
  const body = detalles
    .map(({ c, importe }) =>
      buildDetalle({
        cuota: c,
        periodoTexto,
        fechaVto: fechaDebito,
        importe,
        getId,
      })
    )
    .join("\n");
  const trailer = buildTrailer({ totalImporte, cantDetalles: detalles.length });

  const txt = [header, body, trailer].join("\n");
  const fileName = `galicia_pago_directo_${anio}_${periodoId}.txt`;

  // Descargar
  const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(a.href);

  return { ok: true, fileName };
}

/**
 * Componente “lanzador” opcional:
 * Si lo renderizás como <GaliciaExport open ... />, genera el archivo y se autocierra.
 */
function GaliciaExport({
  open,
  onClose,
  anio,
  periodoId,
  periodoNombre,
  socios,
  getAnualPeriodo,
  normalize,
  getId,
}) {
  useEffect(() => {
    if (!open) return;
    exportPagoDirectoGalicia({
      cuotas: socios || [],
      periodoId,
      periodoTexto: periodoNombre,
      anio,
      getAnualPeriodo,
      normalize,
      getId,
    });
    onClose && onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return null;
}

export default GaliciaExport;
