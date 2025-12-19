<?php
require_once __DIR__ . '/../../config/db.php';
header('Content-Type: application/json; charset=utf-8');

/**
 * ✅ HISTÓRICO REAL:
 * Devuelve montos (mensual/anual) válidos para un AÑO + PERÍODO usando:
 * - categoria_monto (precio base actual)
 * - precios_historicos (cambios: precio_viejo/precio_nuevo + fecha_cambio + tipo)
 *
 * Params:
 * - id_cat_monto (opcional)
 * - id_socio (opcional)
 * - anio (opcional, default año actual)
 * - id_periodo (opcional, default 0 => 31/12 del año)
 */

function readInt($arr, $key) {
  if (!isset($arr[$key])) return null;
  $v = trim((string)$arr[$key]);
  return ctype_digit($v) ? (int)$v : null;
}

function tableHasColumn(PDO $pdo, string $table, string $col): bool {
  try {
    $st = $pdo->prepare("SHOW COLUMNS FROM `{$table}` LIKE :c");
    $st->execute([':c' => $col]);
    return (bool)$st->fetch(PDO::FETCH_ASSOC);
  } catch (Throwable $e) {
    return false;
  }
}

function calcularFechaObjetivo(int $anio, int $idPeriodo): string {
  // Si no hay período: usar fin de año
  if ($idPeriodo <= 0) {
    return sprintf('%04d-12-31', $anio);
  }

  // Anual (id 7)
  if ($idPeriodo === 7) {
    return sprintf('%04d-12-31', $anio);
  }

  // Bimestres 1..6 => fin de mes: 2,4,6,8,10,12
  $mapFinMes = [1 => 2, 2 => 4, 3 => 6, 4 => 8, 5 => 10, 6 => 12];

  if (!isset($mapFinMes[$idPeriodo])) {
    return sprintf('%04d-12-31', $anio);
  }

  $mesFin = $mapFinMes[$idPeriodo];
  $ultimoDia = (int)date('t', strtotime(sprintf('%04d-%02d-01', $anio, $mesFin)));
  return sprintf('%04d-%02d-%02d', $anio, $mesFin, $ultimoDia);
}

function fetchSocioRow(PDO $pdo, string $socTable, int $idSocio): ?array {
  // soportar id_socio o idSocio/idsocio en distintas DB (pero acá asumimos id_socio)
  $st = $pdo->prepare("SELECT * FROM `{$socTable}` WHERE id_socio = :id LIMIT 1");
  $st->execute([':id' => $idSocio]);
  $row = $st->fetch(PDO::FETCH_ASSOC);
  return $row ?: null;
}

function fetchCategoriaMonto(PDO $pdo, string $catTable, int $idCatMonto): ?array {
  $st = $pdo->prepare("
    SELECT id_cat_monto, nombre_categoria, monto_mensual, monto_anual, fecha_creacion
      FROM `{$catTable}`
     WHERE id_cat_monto = :id
     LIMIT 1
  ");
  $st->execute([':id' => $idCatMonto]);
  $row = $st->fetch(PDO::FETCH_ASSOC);
  return $row ?: null;
}

/**
 * ✅ Regla de historial:
 * - Si hay un cambio con fecha_cambio <= fecha_obj => usar precio_nuevo del ÚLTIMO cambio.
 * - Si NO hay cambio anterior pero hay un primer cambio futuro => usar precio_viejo de ESE primer cambio.
 * - Si no hay historial => usar fallback (precio base actual de categoria_monto).
 */
function precioHistoricoPorTipo(PDO $pdo, string $histTable, int $idCatMonto, string $tipo, string $fechaObj, int $fallback): array {
  // 1) último cambio aplicado (<= fecha_obj)
  $st = $pdo->prepare("
    SELECT id_historial, precio_viejo, precio_nuevo, fecha_cambio
      FROM `{$histTable}`
     WHERE id_cat_monto = :id
       AND tipo = :tipo
       AND fecha_cambio <= :f
  ORDER BY fecha_cambio DESC, id_historial DESC
     LIMIT 1
  ");
  $st->execute([
    ':id' => $idCatMonto,
    ':tipo' => $tipo,
    ':f' => $fechaObj
  ]);
  $row = $st->fetch(PDO::FETCH_ASSOC);
  if ($row) {
    return [
      'precio' => (int)$row['precio_nuevo'],
      'hist'   => $row,
      'modo'   => 'precio_nuevo_por_cambio_aplicado'
    ];
  }

  // 2) no hay cambios aplicados => si existe un primer cambio futuro, antes de ese cambio vale precio_viejo
  $st2 = $pdo->prepare("
    SELECT id_historial, precio_viejo, precio_nuevo, fecha_cambio
      FROM `{$histTable}`
     WHERE id_cat_monto = :id
       AND tipo = :tipo
  ORDER BY fecha_cambio ASC, id_historial ASC
     LIMIT 1
  ");
  $st2->execute([
    ':id' => $idCatMonto,
    ':tipo' => $tipo
  ]);
  $first = $st2->fetch(PDO::FETCH_ASSOC);
  if ($first) {
    // Si la fecha objetivo es ANTES del primer cambio, usamos precio_viejo
    if (strtotime($fechaObj) < strtotime($first['fecha_cambio'])) {
      return [
        'precio' => (int)$first['precio_viejo'],
        'hist'   => $first,
        'modo'   => 'precio_viejo_antes_del_primer_cambio'
      ];
    }
    // Si es después (pero no entró en el query 1 por algún formato raro),
    // igual devolvemos precio_nuevo del primer cambio como fallback coherente.
    return [
      'precio' => (int)$first['precio_nuevo'],
      'hist'   => $first,
      'modo'   => 'precio_nuevo_primer_cambio_fallback'
    ];
  }

  // 3) no hay historial
  return [
    'precio' => (int)$fallback,
    'hist'   => null,
    'modo'   => 'sin_historial_fallback_categoria_monto'
  ];
}

try {
  $idCatReq   = readInt($_GET, 'id_cat_monto') ?? readInt($_POST, 'id_cat_monto');
  $idSocioReq = readInt($_GET, 'id_socio')     ?? readInt($_POST, 'id_socio');

  $anioReq    = readInt($_GET, 'anio')         ?? readInt($_POST, 'anio');
  $periodoReq = readInt($_GET, 'id_periodo')   ?? readInt($_POST, 'id_periodo');

  $anioFinal = ($anioReq !== null && $anioReq >= 2000) ? $anioReq : (int)date('Y');
  $idPeriodoFinal = $periodoReq !== null ? $periodoReq : 0;
  $fechaObjetivo = calcularFechaObjetivo($anioFinal, $idPeriodoFinal); // YYYY-MM-DD

  // Tablas
  $socTable  = 'socios';
  $catTable  = 'categoria_monto';
  $histTable = 'precios_historicos';

  // Detectar columnas
  $socHasIdCatMonto = tableHasColumn($pdo, $socTable, 'id_cat_monto');
  $socHasIdCategoria = tableHasColumn($pdo, $socTable, 'idCategoria') || tableHasColumn($pdo, $socTable, 'id_categoria');

  $catHasIdCatMonto = tableHasColumn($pdo, $catTable, 'id_cat_monto');
  $catHasIdCategoria = tableHasColumn($pdo, $catTable, 'id_categoria');

  // Resolver ids
  $resolvedIdCatMonto = ($idCatReq !== null && $idCatReq > 0) ? $idCatReq : null;
  $resolvedIdCategoria = null;

  if ($resolvedIdCatMonto === null && $idSocioReq !== null && $idSocioReq > 0) {
    $socioRow = fetchSocioRow($pdo, $socTable, $idSocioReq);
    if ($socioRow) {
      if ($socHasIdCatMonto && !empty($socioRow['id_cat_monto'])) {
        $resolvedIdCatMonto = (int)$socioRow['id_cat_monto'];
      }

      if ($resolvedIdCatMonto === null && $socHasIdCategoria) {
        if (isset($socioRow['idCategoria']) && $socioRow['idCategoria'] !== '') {
          $resolvedIdCategoria = (int)$socioRow['idCategoria'];
        } elseif (isset($socioRow['id_categoria']) && $socioRow['id_categoria'] !== '') {
          $resolvedIdCategoria = (int)$socioRow['id_categoria'];
        }
      }
    }
  }

  // Si no tenemos id_cat_monto pero tenemos id_categoria,
  // buscamos el id_cat_monto “actual” (si tu modelo lo permite)
  if ($resolvedIdCatMonto === null && $resolvedIdCategoria !== null && $catHasIdCategoria) {
    // Tomamos el último registro de categoria_monto de esa categoría como id_cat_monto base
    $st = $pdo->prepare("
      SELECT id_cat_monto
        FROM `{$catTable}`
       WHERE id_categoria = :idc
    ORDER BY fecha_creacion DESC, id_cat_monto DESC
       LIMIT 1
    ");
    $st->execute([':idc' => $resolvedIdCategoria]);
    $tmp = $st->fetch(PDO::FETCH_ASSOC);
    if ($tmp && !empty($tmp['id_cat_monto'])) {
      $resolvedIdCatMonto = (int)$tmp['id_cat_monto'];
    }
  }

  if ($resolvedIdCatMonto === null || !$catHasIdCatMonto) {
    echo json_encode([
      'exito' => false,
      'mensaje' => 'No se pudo resolver id_cat_monto (ni por request ni por socio).',
      'debug' => [
        'id_cat_monto_req' => $idCatReq,
        'id_socio_req' => $idSocioReq,
        'resolved_id_categoria' => $resolvedIdCategoria,
        'soc_has_id_cat_monto' => $socHasIdCatMonto,
        'soc_has_idCategoria_or_id_categoria' => $socHasIdCategoria,
        'cat_has_id_cat_monto' => $catHasIdCatMonto,
        'cat_has_id_categoria' => $catHasIdCategoria,
      ]
    ], JSON_UNESCAPED_UNICODE);
    exit;
  }

  // Precio base actual (categoria_monto)
  $catRow = fetchCategoriaMonto($pdo, $catTable, $resolvedIdCatMonto);
  if (!$catRow) {
    echo json_encode([
      'exito' => false,
      'mensaje' => 'No existe categoria_monto para id_cat_monto=' . $resolvedIdCatMonto,
    ], JSON_UNESCAPED_UNICODE);
    exit;
  }

  $baseMensual = (int)($catRow['monto_mensual'] ?? 0);
  $baseAnual   = (int)($catRow['monto_anual'] ?? 0);

  // Histórico real por tipo
  $mens = precioHistoricoPorTipo($pdo, $histTable, $resolvedIdCatMonto, 'mensual', $fechaObjetivo, $baseMensual);
  $anua = precioHistoricoPorTipo($pdo, $histTable, $resolvedIdCatMonto, 'anual',   $fechaObjetivo, $baseAnual);

  echo json_encode([
    'exito' => true,

    // ✅ esto consume tu Modal
    'mensual' => (int)$mens['precio'],
    'anual'   => (int)$anua['precio'],
    'nombre_categoria' => $catRow['nombre_categoria'] ?? null,

    // debug útil (dejalo mientras probás)
    'anio' => $anioFinal,
    'id_periodo' => $idPeriodoFinal,
    'fecha_objetivo' => $fechaObjetivo,
    'id_cat_monto' => $resolvedIdCatMonto,
    'base_categoria_monto' => [
      'monto_mensual' => $baseMensual,
      'monto_anual'   => $baseAnual,
      'fecha_creacion' => $catRow['fecha_creacion'] ?? null,
    ],
    'hist_debug' => [
      'mensual' => [
        'modo' => $mens['modo'],
        'row'  => $mens['hist'],
      ],
      'anual' => [
        'modo' => $anua['modo'],
        'row'  => $anua['hist'],
      ],
    ],
  ], JSON_UNESCAPED_UNICODE);
  exit;

} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode([
    'exito' => false,
    'mensaje' => 'Error al obtener montos: ' . $e->getMessage(),
  ], JSON_UNESCAPED_UNICODE);
  exit;
}
